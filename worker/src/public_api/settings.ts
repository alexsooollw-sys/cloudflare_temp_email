import { Context } from "hono";

import { CONSTANTS } from "../constants";
import { getSystemSetting } from "../utils";

/**
 * Tempmail runtime settings, resolved from system_settings table.
 *
 * Defaults are intentionally conservative ("aggressive lockdown") so a fresh
 * deployment stays well within Cloudflare free-tier limits (100k Worker
 * requests / day, 1 GB D1) until the admin opts in to higher quotas via the
 * admin UI.
 */
export type TempmailSettings = {
    allowedDomains: string[]
    accountTtlHours: number
    maxMessagesPerAccount: number
    rpm: number
    rps: number
    accountsPerDayPerIp: number
    maxAttachmentMb: number
    maxBodyMb: number
    enablePublicPreview: boolean
    publicPreviewCount: number
    enableAutorefresh: boolean
    autorefreshIntervalSec: number
}

export const DEFAULT_TEMPMAIL_SETTINGS: TempmailSettings = {
    allowedDomains: [],
    accountTtlHours: 24,
    maxMessagesPerAccount: 50,
    rpm: 10,
    rps: 1,
    accountsPerDayPerIp: 100,
    maxAttachmentMb: 1,
    maxBodyMb: 1,
    enablePublicPreview: true,
    publicPreviewCount: 10,
    enableAutorefresh: true,
    autorefreshIntervalSec: 30,
}

const KEYS = CONSTANTS.TEMPMAIL_SETTINGS

const intOr = <T extends number>(value: unknown, fallback: T): number => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed >= 0) return parsed
    }
    return fallback
}

const boolOr = (value: unknown, fallback: boolean): boolean => {
    if (typeof value === "boolean") return value
    if (typeof value === "string") return value === "true"
    return fallback
}

const stringArrayOr = (value: unknown, fallback: string[]): string[] => {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string")
    if (typeof value === "string" && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
        } catch { /* fall through */ }
        return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    }
    return fallback
}

export const getTempmailSettings = async (c: Context<HonoCustomType>): Promise<TempmailSettings> => {
    const [
        allowedDomains, accountTtlHours, maxMessagesPerAccount,
        rpm, rps, accountsPerDayPerIp,
        maxAttachmentMb, maxBodyMb,
        enablePublicPreview, publicPreviewCount,
        enableAutorefresh, autorefreshIntervalSec,
    ] = await Promise.all([
        getSystemSetting<unknown>(c, KEYS.ALLOWED_DOMAINS),
        getSystemSetting<unknown>(c, KEYS.ACCOUNT_TTL_HOURS),
        getSystemSetting<unknown>(c, KEYS.MAX_MESSAGES_PER_ACCOUNT),
        getSystemSetting<unknown>(c, KEYS.RPM),
        getSystemSetting<unknown>(c, KEYS.RPS),
        getSystemSetting<unknown>(c, KEYS.ACCOUNTS_PER_DAY_PER_IP),
        getSystemSetting<unknown>(c, KEYS.MAX_ATTACHMENT_MB),
        getSystemSetting<unknown>(c, KEYS.MAX_BODY_MB),
        getSystemSetting<unknown>(c, KEYS.ENABLE_PUBLIC_PREVIEW),
        getSystemSetting<unknown>(c, KEYS.PUBLIC_PREVIEW_COUNT),
        getSystemSetting<unknown>(c, KEYS.ENABLE_AUTOREFRESH),
        getSystemSetting<unknown>(c, KEYS.AUTOREFRESH_INTERVAL_SEC),
    ])

    return {
        allowedDomains: stringArrayOr(allowedDomains, DEFAULT_TEMPMAIL_SETTINGS.allowedDomains),
        accountTtlHours: intOr(accountTtlHours, DEFAULT_TEMPMAIL_SETTINGS.accountTtlHours),
        maxMessagesPerAccount: intOr(maxMessagesPerAccount, DEFAULT_TEMPMAIL_SETTINGS.maxMessagesPerAccount),
        rpm: intOr(rpm, DEFAULT_TEMPMAIL_SETTINGS.rpm),
        rps: intOr(rps, DEFAULT_TEMPMAIL_SETTINGS.rps),
        accountsPerDayPerIp: intOr(accountsPerDayPerIp, DEFAULT_TEMPMAIL_SETTINGS.accountsPerDayPerIp),
        maxAttachmentMb: intOr(maxAttachmentMb, DEFAULT_TEMPMAIL_SETTINGS.maxAttachmentMb),
        maxBodyMb: intOr(maxBodyMb, DEFAULT_TEMPMAIL_SETTINGS.maxBodyMb),
        enablePublicPreview: boolOr(enablePublicPreview, DEFAULT_TEMPMAIL_SETTINGS.enablePublicPreview),
        publicPreviewCount: intOr(publicPreviewCount, DEFAULT_TEMPMAIL_SETTINGS.publicPreviewCount),
        enableAutorefresh: boolOr(enableAutorefresh, DEFAULT_TEMPMAIL_SETTINGS.enableAutorefresh),
        autorefreshIntervalSec: intOr(autorefreshIntervalSec, DEFAULT_TEMPMAIL_SETTINGS.autorefreshIntervalSec),
    }
}

/**
 * Increment a per-day, per-IP counter used to enforce account-creation
 * quotas. Returns the new count.
 */
export const incTempmailDailyCount = async (
    c: Context<HonoCustomType>,
    ip: string,
    kind: "accounts" | "logins",
): Promise<number> => {
    if (!c.env.KV) return 0
    const key = `${CONSTANTS.TEMPMAIL_KV_PREFIX}${kind}:${ip}:${new Date().toISOString().slice(0, 10)}`
    const prev = parseInt((await c.env.KV.get(key)) || "0", 10) || 0
    const next = prev + 1
    await c.env.KV.put(key, next.toString(), { expirationTtl: 24 * 60 * 60 })
    return next
}

export const getTempmailDailyCount = async (
    c: Context<HonoCustomType>,
    ip: string,
    kind: "accounts" | "logins",
): Promise<number> => {
    if (!c.env.KV) return 0
    const key = `${CONSTANTS.TEMPMAIL_KV_PREFIX}${kind}:${ip}:${new Date().toISOString().slice(0, 10)}`
    return parseInt((await c.env.KV.get(key)) || "0", 10) || 0
}
