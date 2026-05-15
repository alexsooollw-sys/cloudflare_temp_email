import { Context } from "hono"
import { Jwt } from "hono/utils/jwt"

import { hashPassword, getAdminPasswords } from "../utils"
import { decryptString, encryptString } from "./encryption"
import { writeAudit } from "./audit_log"
import { checkLockout, getClientIp, recordFailure, recordSuccess } from "./brute_force"

export type AdminAccountRow = {
    id: number
    username: string
    password_hash: string
    totp_secret: string | null
    totp_enabled: number
    failed_attempts: number
    locked_until: string | null
    last_login_at: string | null
    last_login_ip: string | null
}

const PER_ROW_MAX_FAILED = 5
const PER_ROW_LOCKOUT_MIN = 15

const ADMIN_LOGIN_CHALLENGE_TTL_SEC = 5 * 60

/**
 * On the very first admin_login request, if the env-vars list a password
 * but no admin_accounts row exists yet, bootstrap one as `admin` so 2FA
 * and per-row lockout become available.
 */
export const ensureBootstrapAdmin = async (
    c: Context<HonoCustomType>,
): Promise<void> => {
    try {
        const existing = await c.env.DB.prepare(`SELECT count(*) as count FROM admin_accounts`)
            .first<{ count: number }>()
        if (existing && existing.count > 0) return

        const envPasswords = getAdminPasswords(c)
        const bootstrap = (c.env as unknown as Record<string, string | undefined>)
            .BOOTSTRAP_ADMIN_PASSWORD || envPasswords[0]
        if (!bootstrap) return

        const hash = await hashPassword(bootstrap)
        await c.env.DB.prepare(
            `INSERT INTO admin_accounts (username, password_hash) VALUES (?, ?)
             ON CONFLICT(username) DO NOTHING`,
        )
            .bind("admin", hash)
            .run()
    } catch (e) {
        console.warn("bootstrap admin failed:", e)
    }
}

export const findAdmin = async (
    c: Context<HonoCustomType>,
    username: string,
): Promise<AdminAccountRow | null> => {
    const row = await c.env.DB.prepare(
        `SELECT id, username, password_hash, totp_secret, totp_enabled,
                failed_attempts, locked_until, last_login_at, last_login_ip
         FROM admin_accounts WHERE username = ?`,
    )
        .bind(username)
        .first<AdminAccountRow>()
    return row || null
}

export const isRowLocked = (row: AdminAccountRow): boolean => {
    if (!row.locked_until) return false
    return new Date(row.locked_until) > new Date()
}

export const incrementRowFailure = async (
    c: Context<HonoCustomType>,
    row: AdminAccountRow,
): Promise<{ failed_attempts: number; locked_until: string | null }> => {
    const next = row.failed_attempts + 1
    let lockedUntil: string | null = null
    if (next >= PER_ROW_MAX_FAILED) {
        lockedUntil = new Date(Date.now() + PER_ROW_LOCKOUT_MIN * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19)
    }
    await c.env.DB.prepare(
        `UPDATE admin_accounts SET failed_attempts = ?, locked_until = ?,
                                   updated_at = datetime('now')
         WHERE id = ?`,
    )
        .bind(next, lockedUntil, row.id)
        .run()
    return { failed_attempts: next, locked_until: lockedUntil }
}

export const resetRowFailure = async (
    c: Context<HonoCustomType>,
    row: AdminAccountRow,
    ip: string | null,
): Promise<void> => {
    await c.env.DB.prepare(
        `UPDATE admin_accounts SET failed_attempts = 0, locked_until = NULL,
                                   last_login_at = datetime('now'),
                                   last_login_ip = ?,
                                   updated_at = datetime('now')
         WHERE id = ?`,
    )
        .bind(ip, row.id)
        .run()
}

export const issueAdminSessionJwt = async (
    c: Context<HonoCustomType>,
    row: AdminAccountRow,
): Promise<string> => {
    return await Jwt.sign(
        {
            admin_id: row.id,
            admin_username: row.username,
            kind: "admin_session",
            exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        },
        c.env.JWT_SECRET,
        "HS256",
    )
}

/**
 * Sign a short-lived "you must complete TOTP" challenge handed back to
 * the client between the password and TOTP exchange.
 */
export const issueTotpChallenge = async (
    c: Context<HonoCustomType>,
    row: AdminAccountRow,
): Promise<string> => {
    return await Jwt.sign(
        {
            admin_id: row.id,
            admin_username: row.username,
            kind: "admin_totp_challenge",
            exp: Math.floor(Date.now() / 1000) + ADMIN_LOGIN_CHALLENGE_TTL_SEC,
        },
        c.env.JWT_SECRET,
        "HS256",
    )
}

export const verifyTotpChallenge = async (
    c: Context<HonoCustomType>,
    challenge: string,
): Promise<{ admin_id: number; admin_username: string } | null> => {
    try {
        const payload = await Jwt.verify(challenge, c.env.JWT_SECRET, "HS256")
        if (payload?.kind !== "admin_totp_challenge") return null
        if (typeof payload.admin_id !== "number") return null
        if (typeof payload.admin_username !== "string") return null
        return { admin_id: payload.admin_id, admin_username: payload.admin_username }
    } catch {
        return null
    }
}

/**
 * Decrypt a stored TOTP secret.
 */
export const decryptTotpSecret = async (
    c: Context<HonoCustomType>,
    cipherBase64: string,
): Promise<string> => {
    const buf = Uint8Array.from(atob(cipherBase64), (ch) => ch.charCodeAt(0))
    return decryptString(buf, c.env.JWT_SECRET)
}

export const encryptTotpSecret = async (
    c: Context<HonoCustomType>,
    plaintext: string,
): Promise<string> => {
    const cipher = new Uint8Array(await encryptString(plaintext, c.env.JWT_SECRET))
    let bin = ""
    for (const b of cipher) bin += String.fromCharCode(b)
    return btoa(bin)
}

export {
    PER_ROW_MAX_FAILED,
    PER_ROW_LOCKOUT_MIN,
    writeAudit,
    recordFailure,
    recordSuccess,
    checkLockout,
    getClientIp,
}
