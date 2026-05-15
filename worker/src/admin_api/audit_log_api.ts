import { Context } from "hono"

import { queryAuditLog } from "../auth/audit_log"

const list = async (c: Context<HonoCustomType>) => {
    const url = new URL(c.req.raw.url)
    const action = url.searchParams.get("action") || undefined
    const username = url.searchParams.get("username") || undefined
    const limit = parseInt(url.searchParams.get("limit") || "100", 10)
    const offset = parseInt(url.searchParams.get("offset") || "0", 10)
    const { results, total } = await queryAuditLog(c, { action, username, limit, offset })
    return c.json({
        results: results.map((r) => ({
            ...r,
            details: (() => {
                if (!r.details) return null
                try { return JSON.parse(r.details) } catch { return r.details }
            })(),
        })),
        total,
    })
}

const cleanup = async (c: Context<HonoCustomType>) => {
    const url = new URL(c.req.raw.url)
    const days = Math.max(1, parseInt(url.searchParams.get("days") || "90", 10))
    const { meta } = await c.env.DB.prepare(
        `DELETE FROM admin_audit_log WHERE created_at < datetime('now', '-${days} day')`,
    ).run()
    return c.json({ success: true, deleted: meta?.changes ?? 0 })
}

export default { list, cleanup }
