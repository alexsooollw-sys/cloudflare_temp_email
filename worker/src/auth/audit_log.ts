import { Context } from "hono"

import { getClientIp } from "./brute_force"

/**
 * Append a row to admin_audit_log. Best-effort — failures are logged to
 * console but never propagate to callers (the action that triggered the
 * audit entry must always succeed regardless).
 */
export const writeAudit = async (
    c: Context<HonoCustomType>,
    entry: {
        admin_id?: number | null
        username?: string | null
        action: string
        target?: string | null
        success?: boolean
        details?: unknown
    },
): Promise<void> => {
    try {
        const ip = getClientIp(c)
        const ua = c.req.raw.headers.get("user-agent") || null
        const detailsJson = entry.details === undefined ? null : JSON.stringify(entry.details)
        await c.env.DB.prepare(
            `INSERT INTO admin_audit_log
                (admin_id, username, action, target, ip, user_agent, success, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
            .bind(
                entry.admin_id ?? null,
                entry.username ?? null,
                entry.action,
                entry.target ?? null,
                ip,
                ua,
                entry.success === false ? 0 : 1,
                detailsJson,
            )
            .run()
    } catch (e) {
        console.warn("audit log write failed:", e)
    }
}

export type AuditLogEntry = {
    id: number
    admin_id: number | null
    username: string | null
    action: string
    target: string | null
    ip: string | null
    user_agent: string | null
    success: number
    details: string | null
    created_at: string
}

export const queryAuditLog = async (
    c: Context<HonoCustomType>,
    {
        action,
        username,
        limit = 100,
        offset = 0,
    }: { action?: string; username?: string; limit?: number; offset?: number } = {},
): Promise<{ results: AuditLogEntry[]; total: number }> => {
    const where: string[] = []
    const binds: unknown[] = []
    if (action) {
        where.push("action = ?")
        binds.push(action)
    }
    if (username) {
        where.push("username = ?")
        binds.push(username)
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const total = await c.env.DB.prepare(
        `SELECT count(*) as count FROM admin_audit_log ${whereClause}`,
    )
        .bind(...binds)
        .first<{ count: number }>()
    const rows = await c.env.DB.prepare(
        `SELECT * FROM admin_audit_log ${whereClause}
         ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
        .bind(...binds, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0))
        .all<AuditLogEntry>()
    return { results: (rows.results || []) as AuditLogEntry[], total: total?.count || 0 }
}
