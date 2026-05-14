-- system_settings: typed, categorised key/value store with optional AES-GCM
-- encryption for secrets. Separate from the legacy `settings` table to keep
-- migration risk low — the old `settings` (getSetting/saveSetting) is left
-- untouched.

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    encrypted_value BLOB,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
