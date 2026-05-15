-- Tempmail (anonymous, mail.tm-style) support:
-- Mark addresses that were created via /public_api/v1/accounts so a scheduled
-- cleanup can drop them once they expire. Existing addresses are not affected.

ALTER TABLE address ADD COLUMN is_tempmail INTEGER DEFAULT 0;
ALTER TABLE address ADD COLUMN tempmail_expires_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_address_is_tempmail
    ON address(is_tempmail);

CREATE INDEX IF NOT EXISTS idx_address_tempmail_expires_at
    ON address(tempmail_expires_at)
    WHERE is_tempmail = 1;
