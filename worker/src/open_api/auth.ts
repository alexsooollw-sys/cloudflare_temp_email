import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

import utils, { checkCfTurnstile, getPasswords, getAdminPasswords, hashPassword } from '../utils';
import i18n from '../i18n';
import {
    checkLockout, ensureBootstrapAdmin, findAdmin, getClientIp, incrementRowFailure,
    isRowLocked, issueAdminSessionJwt, issueTotpChallenge, recordFailure, recordSuccess,
    resetRowFailure, verifyTotpChallenge, decryptTotpSecret,
} from '../auth/admin_session'
import { writeAudit } from '../auth/audit_log'
import { verifyTotp } from '../auth/totp'

const api = new Hono<HonoCustomType>()

api.post('/open_api/site_login', async (c) => {
    const { password, cf_token } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    if (utils.isGlobalTurnstileEnabled(c)) {
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
    }
    const passwords = getPasswords(c);
    const hashedPasswords = await Promise.all(passwords.map(p => hashPassword(p)));
    if (!hashedPasswords.length || !password || !hashedPasswords.includes(password)) {
        return c.text(msgs.CustomAuthPasswordMsg, 401)
    }
    return c.json({ success: true })
})

api.post('/open_api/admin_login', async (c) => {
    const msgs = i18n.getMessagesbyContext(c);
    let body: { username?: string; password?: string; cf_token?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const { username: rawUsername, password, cf_token } = body;

    if (utils.isGlobalTurnstileEnabled(c)) {
        try {
            await checkCfTurnstile(c, cf_token);
        } catch {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
    }
    if (!password) return c.text(msgs.NeedAdminPasswordMsg, 401)

    await ensureBootstrapAdmin(c);

    const username = (rawUsername || "admin").trim();
    const ip = getClientIp(c);

    const lockedUntilKv = await checkLockout(c, "admin", username);
    if (lockedUntilKv) {
        await writeAudit(c, { username, action: "admin_login", success: false, details: { reason: "ip_locked", until: lockedUntilKv } });
        c.header("Retry-After", "900");
        return c.text(`Locked until ${lockedUntilKv}`, 429)
    }

    const row = await findAdmin(c, username);
    if (!row) {
        // legacy env-var fallback (no admin_accounts row exists at all and
        // BOOTSTRAP_ADMIN_PASSWORD wasn't provided either)
        const adminPasswords = getAdminPasswords(c);
        const hashes = await Promise.all(adminPasswords.map(p => hashPassword(p)));
        if (hashes.length && hashes.includes(password)) {
            await writeAudit(c, { username, action: "admin_login", success: true, details: { via: "env_fallback" } });
            return c.json({ success: true });
        }
        await recordFailure(c, "admin", username);
        await writeAudit(c, { username, action: "admin_login", success: false, details: { reason: "no_account" } });
        return c.text(msgs.NeedAdminPasswordMsg, 401)
    }

    if (isRowLocked(row)) {
        await writeAudit(c, { admin_id: row.id, username, action: "admin_login", success: false, details: { reason: "row_locked", until: row.locked_until } });
        c.header("Retry-After", "900");
        return c.text(`Locked until ${row.locked_until}`, 429)
    }

    if (row.password_hash !== password) {
        const failure = await incrementRowFailure(c, row);
        await recordFailure(c, "admin", username);
        await writeAudit(c, { admin_id: row.id, username, action: "admin_login", success: false, details: { reason: "bad_password", attempts: failure.failed_attempts } });
        return c.text(msgs.NeedAdminPasswordMsg, 401)
    }

    if (row.totp_enabled === 1 && row.totp_secret) {
        const challenge = await issueTotpChallenge(c, row);
        await writeAudit(c, { admin_id: row.id, username, action: "admin_login", success: true, details: { stage: "password_ok_totp_required" } });
        return c.json({ require_totp: true, challenge });
    }

    await recordSuccess(c, "admin", username);
    await resetRowFailure(c, row, ip);
    const sessionJwt = await issueAdminSessionJwt(c, row);
    await writeAudit(c, { admin_id: row.id, username, action: "admin_login", success: true });
    return c.json({ success: true, session: sessionJwt });
})

api.post('/open_api/admin_login_totp', async (c) => {
    const msgs = i18n.getMessagesbyContext(c);
    let body: { challenge?: string; code?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const { challenge, code } = body;
    if (!challenge || !code) return c.text(msgs.InvalidInputMsg, 400);

    const claims = await verifyTotpChallenge(c, challenge);
    if (!claims) return c.text(msgs.UserTokenExpiredMsg, 401);

    const row = await findAdmin(c, claims.admin_username);
    if (!row || !row.totp_enabled || !row.totp_secret) {
        return c.text(msgs.AuthenticationFailedMsg, 401);
    }
    if (isRowLocked(row)) {
        c.header("Retry-After", "900");
        return c.text(`Locked until ${row.locked_until}`, 429);
    }

    const secret = await decryptTotpSecret(c, row.totp_secret);
    const ok = await verifyTotp(secret, code);
    if (!ok) {
        const failure = await incrementRowFailure(c, row);
        await recordFailure(c, "admin", claims.admin_username);
        await writeAudit(c, { admin_id: row.id, username: claims.admin_username, action: "admin_login_totp", success: false, details: { attempts: failure.failed_attempts } });
        return c.text(msgs.AuthenticationFailedMsg, 401);
    }

    await recordSuccess(c, "admin", claims.admin_username);
    await resetRowFailure(c, row, getClientIp(c));
    const sessionJwt = await issueAdminSessionJwt(c, row);
    await writeAudit(c, { admin_id: row.id, username: claims.admin_username, action: "admin_login_totp", success: true });
    return c.json({ success: true, session: sessionJwt });
})

api.post('/open_api/credential_login', async (c) => {
    const { credential, cf_token } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    if (utils.isGlobalTurnstileEnabled(c)) {
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
    }
    if (!credential) {
        return c.text(msgs.InvalidAddressCredentialMsg, 401)
    }
    try {
        const payload = await Jwt.verify(credential, c.env.JWT_SECRET, "HS256");
        if (!payload.address) {
            return c.text(msgs.InvalidAddressCredentialMsg, 401)
        }
    } catch (error) {
        return c.text(msgs.InvalidAddressCredentialMsg, 401)
    }
    return c.json({ success: true })
})

export { api }
