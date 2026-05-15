import { Context } from "hono";
import { Jwt } from "hono/utils/jwt";

import i18n from "../i18n";
import { newAddress } from "../common";
import { checkCfTurnstile, getStringValue, hashPassword } from "../utils";
import { getTempmailSettings, incTempmailDailyCount, getTempmailDailyCount } from "./settings";

const getClientIp = (c: Context<HonoCustomType>): string =>
    c.req.raw.headers.get("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

/**
 * POST /public_api/v1/accounts — create an anonymous tempmail mailbox.
 *
 * Body:
 *   {
 *     "address": "johndoe@example.com",  // full email; domain MUST be in
 *                                        // tempmail.allowed_domains
 *     "password": "<sha256-hash>",       // pre-hashed by frontend
 *     "captcha_token": "<turnstile>"
 *   }
 *
 * Daily per-IP limit and TTL are enforced.
 */
const create = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);

    let body: { address?: string; password?: string; captcha_token?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    const { address: rawAddress, password, captcha_token } = body;
    if (!rawAddress || !password) return c.text(msgs.EmailPasswordRequiredMsg, 400);

    try {
        await checkCfTurnstile(c, captcha_token);
    } catch {
        return c.text(msgs.TurnstileCheckFailedMsg, 400);
    }

    const settings = await getTempmailSettings(c);
    if (settings.allowedDomains.length === 0) {
        return c.text(msgs.DomainsNotSetMsg, 400);
    }

    // Parse email
    const at = rawAddress.lastIndexOf("@");
    if (at < 0) return c.text(msgs.InvalidAddressMsg, 400);
    const localPart = rawAddress.slice(0, at).trim();
    const domain = rawAddress.slice(at + 1).trim().toLowerCase();
    if (!localPart || !domain) return c.text(msgs.InvalidAddressMsg, 400);
    if (!settings.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
        return c.text(msgs.InvalidDomainMsg, 400);
    }

    // Daily per-IP throttle (KV-based)
    const ip = getClientIp(c);
    const used = await getTempmailDailyCount(c, ip, "accounts");
    if (used >= settings.accountsPerDayPerIp) {
        return c.text(`IP=${ip} daily account creation limit reached (${settings.accountsPerDayPerIp})`, 429);
    }

    let created: { address: string; address_id: number; jwt: string };
    try {
        const result = await newAddress(c, {
            name: localPart,
            domain,
            enablePrefix: false,
            checkLengthByConfig: false,
            enableCheckNameRegex: false,
            checkAllowDomains: false,
            sourceMeta: `tempmail:${ip}`,
        });
        created = { address: result.address, address_id: result.address_id, jwt: result.jwt };
    } catch (e) {
        return c.text(`${msgs.FailedCreateAddressMsg}: ${(e as Error).message}`, 400);
    }

    // Persist tempmail flag + expiry + password
    const ttlHours = Math.max(settings.accountTtlHours, 1);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
    // password is sha256(plaintext) from frontend already, store directly.
    try {
        await c.env.DB.prepare(
            `UPDATE address
             SET password = ?,
                 is_tempmail = 1,
                 tempmail_expires_at = ?
             WHERE id = ?`,
        )
            .bind(password, expiresAt, created.address_id)
            .run();
    } catch (e) {
        console.error("tempmail account create: failed to set tempmail flags", e);
        return c.text(msgs.OperationFailedMsg, 500);
    }

    // Bump daily counter (best-effort)
    await incTempmailDailyCount(c, ip, "accounts");

    return c.json({
        id: created.address_id,
        address: created.address,
        token: created.jwt,
        expires_at: expiresAt,
    });
};

/**
 * POST /public_api/v1/token — login to an existing tempmail mailbox.
 *
 * Body: { "address": "...", "password": "<sha256>" }
 */
const login = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);

    let body: { address?: string; password?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    const { address, password } = body;
    if (!address || !password) return c.text(msgs.EmailPasswordRequiredMsg, 400);

    const row = await c.env.DB.prepare(
        `SELECT id, name, password, is_tempmail, tempmail_expires_at
         FROM address WHERE name = ?`,
    )
        .bind(address)
        .first<{
            id: number;
            name: string;
            password: string | null;
            is_tempmail: number | null;
            tempmail_expires_at: string | null;
        }>();

    if (!row || !row.is_tempmail) {
        return c.text(msgs.AddressNotFoundMsg, 404);
    }
    if (row.tempmail_expires_at && new Date(row.tempmail_expires_at) < new Date()) {
        return c.text(msgs.AddressNotFoundMsg, 404);
    }
    if (!row.password || row.password !== password) {
        return c.text(msgs.InvalidEmailOrPasswordMsg, 401);
    }

    const jwt = await Jwt.sign(
        { address: row.name, address_id: row.id },
        c.env.JWT_SECRET,
        "HS256",
    );
    return c.json({
        token: jwt,
        address: row.name,
        expires_at: row.tempmail_expires_at,
    });
};

/**
 * GET /public_api/v1/me — profile.
 */
const me = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address_id } = c.get("jwtPayload");
    if (!address_id) return c.text(msgs.InvalidAddressTokenMsg, 401);

    const row = await c.env.DB.prepare(
        `SELECT id, name, is_tempmail, tempmail_expires_at, created_at
         FROM address WHERE id = ?`,
    )
        .bind(address_id)
        .first<{
            id: number;
            name: string;
            is_tempmail: number | null;
            tempmail_expires_at: string | null;
            created_at: string;
        }>();
    if (!row || !row.is_tempmail) {
        return c.text(msgs.AddressNotFoundMsg, 404);
    }
    return c.json({
        id: row.id,
        address: row.name,
        expires_at: row.tempmail_expires_at,
        created_at: row.created_at,
    });
};

/**
 * DELETE /public_api/v1/me — delete account and all its data.
 */
const deleteMe = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address, address_id } = c.get("jwtPayload");
    if (!address_id || !address) return c.text(msgs.InvalidAddressTokenMsg, 401);

    const row = await c.env.DB.prepare(
        `SELECT is_tempmail FROM address WHERE id = ?`,
    )
        .bind(address_id)
        .first<{ is_tempmail: number | null }>();
    if (!row || !row.is_tempmail) return c.text(msgs.AddressNotFoundMsg, 404);

    // Cascade delete: mails, sendbox, address. auto_reply / users_address are
    // not used by tempmail accounts but cleaned up defensively anyway.
    await c.env.DB.prepare(`DELETE FROM raw_mails WHERE address = ?`).bind(address).run();
    await c.env.DB.prepare(`DELETE FROM sendbox WHERE address = ?`).bind(address).run();
    await c.env.DB.prepare(`DELETE FROM auto_reply_mails WHERE address = ?`).bind(address).run();
    await c.env.DB.prepare(`DELETE FROM address_sender WHERE address = ?`).bind(address).run();
    await c.env.DB.prepare(`DELETE FROM users_address WHERE address_id = ?`).bind(address_id).run();
    await c.env.DB.prepare(`DELETE FROM address WHERE id = ?`).bind(address_id).run();

    return c.json({ success: true });
};

/**
 * Helper for other handlers: assert the JWT belongs to an active tempmail
 * account. Returns the address row on success, throws { status, message } on
 * failure.
 */
export const requireTempmailAddress = async (
    c: Context<HonoCustomType>,
): Promise<{ id: number; name: string; expires_at: string | null }> => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address_id } = c.get("jwtPayload");
    if (!address_id) {
        const err = new Error(msgs.InvalidAddressTokenMsg) as Error & { status: number };
        err.status = 401;
        throw err;
    }
    const row = await c.env.DB.prepare(
        `SELECT id, name, is_tempmail, tempmail_expires_at
         FROM address WHERE id = ?`,
    )
        .bind(address_id)
        .first<{
            id: number;
            name: string;
            is_tempmail: number | null;
            tempmail_expires_at: string | null;
        }>();
    if (!row || !row.is_tempmail) {
        const err = new Error(getStringValue(msgs.AddressNotFoundMsg)) as Error & { status: number };
        err.status = 404;
        throw err;
    }
    if (row.tempmail_expires_at && new Date(row.tempmail_expires_at) < new Date()) {
        const err = new Error(getStringValue(msgs.AddressNotFoundMsg)) as Error & { status: number };
        err.status = 410;
        throw err;
    }
    return { id: row.id, name: row.name, expires_at: row.tempmail_expires_at };
};

// hashPassword is re-exported only to keep the import surface tidy for tests.
export { hashPassword };

export default { create, login, me, deleteMe };
