/**
 * Brute-force protection for login endpoints.
 *
 * Strategy: per-IP, per-username failure counter stored in KV. When the
 * counter exceeds `maxAttempts`, subsequent requests from that IP for that
 * username are rejected with HTTP 429 + Retry-After until `windowSec` ago
 * regardless of whether the password is now correct.
 *
 * Identical logic is applied to the `admin_accounts.failed_attempts` /
 * `locked_until` columns by the admin-login handler — the KV-side guard
 * adds an IP dimension and survives admin row deletes.
 */

import { Context } from "hono"

import { CONSTANTS } from "../constants"

export type LoginKind = "admin" | "mail" | "tempmail"

export type BruteForceConfig = {
    maxAttempts: number
    windowSec: number
}

export const DEFAULT_BRUTE_FORCE: Record<LoginKind, BruteForceConfig> = {
    admin:    { maxAttempts: 5,  windowSec: 15 * 60 },
    mail:     { maxAttempts: 10, windowSec: 15 * 60 },
    tempmail: { maxAttempts: 10, windowSec: 15 * 60 },
}

const keyPrefix = "brute:"

const buildKey = (kind: LoginKind, ip: string, identifier: string): string =>
    `${keyPrefix}${kind}:${ip}:${identifier}`

const lockKey = (kind: LoginKind, ip: string, identifier: string): string =>
    `${keyPrefix}lock:${kind}:${ip}:${identifier}`

export const getClientIp = (c: Context<HonoCustomType>): string =>
    c.req.raw.headers.get("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"

/**
 * Check whether the (kind, ip, identifier) tuple is currently locked out.
 * Returns the locked_until ISO timestamp string when blocked, or null when
 * the request may proceed.
 *
 * No-op when KV binding is not present (returns null).
 */
export const checkLockout = async (
    c: Context<HonoCustomType>,
    kind: LoginKind,
    identifier: string,
): Promise<string | null> => {
    if (!c.env.KV) return null
    const ip = getClientIp(c)
    const lockedUntil = await c.env.KV.get(lockKey(kind, ip, identifier))
    if (!lockedUntil) return null
    if (new Date(lockedUntil) <= new Date()) {
        // expired — clean up
        await c.env.KV.delete(lockKey(kind, ip, identifier))
        await c.env.KV.delete(buildKey(kind, ip, identifier))
        return null
    }
    return lockedUntil
}

/**
 * Record a failed attempt. Returns the new attempt count and the
 * locked_until ISO timestamp if the threshold was crossed.
 */
export const recordFailure = async (
    c: Context<HonoCustomType>,
    kind: LoginKind,
    identifier: string,
    config: BruteForceConfig = DEFAULT_BRUTE_FORCE[kind],
): Promise<{ attempts: number; lockedUntil: string | null }> => {
    if (!c.env.KV) return { attempts: 0, lockedUntil: null }
    const ip = getClientIp(c)
    const key = buildKey(kind, ip, identifier)
    const prev = parseInt((await c.env.KV.get(key)) || "0", 10) || 0
    const next = prev + 1
    await c.env.KV.put(key, next.toString(), { expirationTtl: config.windowSec })

    if (next >= config.maxAttempts) {
        const lockedUntil = new Date(Date.now() + config.windowSec * 1000).toISOString()
        await c.env.KV.put(lockKey(kind, ip, identifier), lockedUntil, {
            expirationTtl: config.windowSec,
        })
        return { attempts: next, lockedUntil }
    }
    return { attempts: next, lockedUntil: null }
}

/**
 * Reset the counter on a successful auth.
 */
export const recordSuccess = async (
    c: Context<HonoCustomType>,
    kind: LoginKind,
    identifier: string,
): Promise<void> => {
    if (!c.env.KV) return
    const ip = getClientIp(c)
    await c.env.KV.delete(buildKey(kind, ip, identifier))
    await c.env.KV.delete(lockKey(kind, ip, identifier))
}

export { CONSTANTS }
