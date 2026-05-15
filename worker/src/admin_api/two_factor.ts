import { Context } from "hono"

import i18n from "../i18n"
import {
    decryptTotpSecret, encryptTotpSecret, findAdmin,
} from "../auth/admin_session"
import { writeAudit } from "../auth/audit_log"
import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from "../auth/totp"
import { getStringValue } from "../utils"

const getActor = async (c: Context<HonoCustomType>): Promise<{ id: number; username: string } | null> => {
    // 1) Prefer admin session JWT (issued by admin_login / admin_login_totp).
    const auth = c.req.raw.headers.get("authorization") || c.req.raw.headers.get("x-admin-session") || ""
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth.trim()
    if (token) {
        try {
            const { Jwt } = await import("hono/utils/jwt")
            const payload = await Jwt.verify(token, c.env.JWT_SECRET, "HS256")
            if (payload?.kind === "admin_session" && typeof payload.admin_id === "number" &&
                typeof payload.admin_username === "string") {
                return { id: payload.admin_id, username: payload.admin_username }
            }
        } catch { /* ignore */ }
    }
    // 2) Legacy env-var path — operate on the row created by ensureBootstrapAdmin().
    const row = await findAdmin(c, "admin")
    if (row) return { id: row.id, username: row.username }
    return null
}

const setup = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c)
    const actor = await getActor(c)
    if (!actor) return c.text(msgs.NeedAdminPasswordMsg, 401)

    const secret = generateTotpSecret()
    const issuer = getStringValue(c.env.TITLE) || "Cloudflare Temp Email"
    const otpauth = buildOtpAuthUrl({ issuer, account: actor.username, secret })

    return c.json({
        secret,
        otpauth,
    })
}

const confirm = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c)
    const actor = await getActor(c)
    if (!actor) return c.text(msgs.NeedAdminPasswordMsg, 401)

    let body: { secret?: string; code?: string }
    try {
        body = await c.req.json()
    } catch {
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const { secret, code } = body
    if (!secret || !code) return c.text(msgs.InvalidInputMsg, 400)

    const ok = await verifyTotp(secret, code)
    if (!ok) {
        await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_2fa_confirm", success: false })
        return c.text(msgs.AuthenticationFailedMsg, 401)
    }

    const cipher = await encryptTotpSecret(c, secret)
    await c.env.DB.prepare(
        `UPDATE admin_accounts SET totp_secret = ?, totp_enabled = 1,
                                   updated_at = datetime('now')
         WHERE id = ?`,
    )
        .bind(cipher, actor.id)
        .run()
    await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_2fa_enable", success: true })
    return c.json({ success: true, enabled: true })
}

const disable = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c)
    const actor = await getActor(c)
    if (!actor) return c.text(msgs.NeedAdminPasswordMsg, 401)

    let body: { code?: string }
    try {
        body = await c.req.json()
    } catch {
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const { code } = body
    if (!code) return c.text(msgs.InvalidInputMsg, 400)

    const row = await findAdmin(c, actor.username)
    if (!row || !row.totp_enabled || !row.totp_secret) {
        return c.text(msgs.AuthenticationFailedMsg, 401)
    }

    const secret = await decryptTotpSecret(c, row.totp_secret)
    const ok = await verifyTotp(secret, code)
    if (!ok) {
        await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_2fa_disable", success: false })
        return c.text(msgs.AuthenticationFailedMsg, 401)
    }

    await c.env.DB.prepare(
        `UPDATE admin_accounts SET totp_secret = NULL, totp_enabled = 0,
                                   updated_at = datetime('now')
         WHERE id = ?`,
    )
        .bind(actor.id)
        .run()
    await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_2fa_disable", success: true })
    return c.json({ success: true, enabled: false })
}

const status = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c)
    const actor = await getActor(c)
    if (!actor) return c.text(msgs.NeedAdminPasswordMsg, 401)
    const row = await findAdmin(c, actor.username)
    return c.json({
        enabled: !!(row && row.totp_enabled),
        username: actor.username,
        last_login_at: row?.last_login_at ?? null,
        last_login_ip: row?.last_login_ip ?? null,
    })
}

const changePassword = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c)
    const actor = await getActor(c)
    if (!actor) return c.text(msgs.NeedAdminPasswordMsg, 401)
    let body: { current_password?: string; new_password?: string }
    try {
        body = await c.req.json()
    } catch {
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const { current_password, new_password } = body
    if (!current_password || !new_password) return c.text(msgs.InvalidInputMsg, 400)

    const row = await findAdmin(c, actor.username)
    if (!row || row.password_hash !== current_password) {
        await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_change_password", success: false, details: { reason: "bad_current" } })
        return c.text(msgs.NeedAdminPasswordMsg, 401)
    }

    await c.env.DB.prepare(
        `UPDATE admin_accounts SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    )
        .bind(new_password, actor.id)
        .run()
    await writeAudit(c, { admin_id: actor.id, username: actor.username, action: "admin_change_password", success: true })
    return c.json({ success: true })
}

export default { setup, confirm, disable, status, changePassword }
