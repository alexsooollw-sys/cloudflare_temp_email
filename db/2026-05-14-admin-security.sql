-- Admin security (Stage 3 of the multi-stage refactor):
-- 1) `admin_accounts` — DB-backed admin identities so 2FA secrets and
--    per-account lockout state can be stored against a real row, instead
--    of relying on the env-var ADMIN_PASSWORDS list.
-- 2) `admin_audit_log` — append-only log of admin auth and configuration
--    events, surfaced read-only in the admin UI.
--
-- The legacy ADMIN_PASSWORDS env-var auth path is intentionally left in
-- place (worker/src/utils.ts:checkIsAdmin); when a request matches it AND
-- no admin_accounts row exists, the worker auto-bootstraps an
-- `admin_accounts` entry from BOOTSTRAP_ADMIN_PASSWORD. After 2FA is
-- enabled the env-var path can be removed by the operator.

CREATE TABLE IF NOT EXISTS admin_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,            -- SHA-256 hex of the plaintext password
    totp_secret TEXT,                        -- AES-GCM-encrypted base32 secret
    totp_enabled INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_login_at DATETIME,
    last_login_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts(username);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    ip TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 1,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
