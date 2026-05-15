# Migrating from v1.x → v2.0

> v2.0 is the result of [PLAN.md](./PLAN.md) — a multi-stage refactor
> introducing a multi-site frontend layout, a public REST API for
> tempmail accounts, AES-GCM-encrypted DB-backed configuration, admin
> TOTP 2FA + brute-force protection, an audit log and Swagger UI.
>
> **Existing v1.x deployments keep working unchanged on v2.0** — every
> breaking-looking change ships a backwards-compatible escape hatch. The
> sections below describe each one in increasing risk order.

## TL;DR

1. Pull `main`, run two new D1 migrations and the existing one (Stage 1
   `system_settings`, Stage 2 `tempmail`, Stage 3 `admin_security`).
2. Redeploy worker and the **admin** Pages project (path moved from
   `frontend/dist/` to `frontend/packages/admin/dist/` — workflow
   updated automatically).
3. (Optional) Deploy the two new Pages projects (`mail`, `tempmail`).
4. (Optional) Move secrets from `wrangler.toml` to `system_settings` via
   the new admin UI.
5. (Optional) Enable admin TOTP 2FA.

---

## 1. Database migrations

Run, in order, against your D1:

```bash
pnpm exec wrangler d1 execute <db-name> --remote --file=db/2026-05-14-system-settings.sql
pnpm exec wrangler d1 execute <db-name> --remote --file=db/2026-05-14-tempmail.sql
pnpm exec wrangler d1 execute <db-name> --remote --file=db/2026-05-14-admin-security.sql
```

All three are pure `CREATE TABLE` / `ALTER TABLE … ADD COLUMN` —
non-destructive. No existing data is rewritten.

---

## 2. Worker changes

* `worker/src/i18n/zh.ts` was deleted; the worker now ships English
  (default) + Russian. If your `wrangler.toml` had `DEFAULT_LANG = "zh"`,
  switch it to `"en"` (or remove the line).
* No env-var was renamed or removed.
* New optional env-vars used by the new auth flows:
  - `BOOTSTRAP_ADMIN_PASSWORD` — used to bootstrap the new
    `admin_accounts` row on the first admin login. After 2FA is enabled
    you can remove this line.
* Worker bundle grew from ~1850 KiB to ~1885 KiB (+35 KiB across
  Stages 1 → 4); still well below the 10 MiB Workers limit.

---

## 3. Frontend (Pages)

### CI / artifact paths

The `frontend/` tree is now a pnpm workspaces monorepo. The artifact
path moved:

| Before          | After                              |
|-----------------|------------------------------------|
| `frontend/dist/`| `frontend/packages/admin/dist/`    |

The shipped GitHub Actions workflows (`frontend_deploy.yaml`,
`frontend_pagefunction_deploy.yaml`, `tag_build.yml`) were updated to
the new path **and** to use `pnpm --filter @cte/admin run <script>`
instead of the bare scripts at the workspace root. If you have local
deployment scripts, mirror those changes.

### New Pages projects

Two brand-new Pages projects ship in v2.0:

* `frontend/packages/mail/` → `mail.domain.com` — notletters-style
  centered login card + mailbox view + change-password page. Powered by
  `ENABLE_ADDRESS_PASSWORD=true` (unchanged since v1.x).
* `frontend/packages/tempmail/` → `tempmail.domain.com` — mail.tm-style
  anonymous mailbox creation, login and inbox. Powered by the new
  `/public_api/v1/*` endpoints.

Both are 100% optional; existing v1.x deployments do not need to add
them. See [`DEPLOY.md`](./DEPLOY.md) for the full setup.

### i18n

Six locales were collapsed to two (English + Russian). If you forked the
admin panel and added strings to the deleted source files
(`zh.ts` / `es.ts` / `ja.ts` / `de.ts` / `ptBR.ts`), port them into
`packages/admin/src/i18n/message-registry.ts` under the new `en`/`ru`
keys.

The Russian column initially mirrors the English text — proper RU
translations are a separate, dedicated PR.

### Theme

The admin panel keeps Naive UI for now. The shared package (and the new
mail / tempmail apps) ship a Material Design 3 theme layer with three
modes (Light / Dark / **AMOLED**) plus eight accent colours, exposed via
`useColorMode` / `useAccentColor` / `useThemeSync` from
`@cte/shared/theme/composables`.

---

## 4. Admin security

### Bootstrapping `admin_accounts`

The very first call to `/open_api/admin_login` after deploying v2.0
auto-creates an `admin_accounts` row from either:

1. `BOOTSTRAP_ADMIN_PASSWORD` env-var (preferred), **or**
2. the first password in the legacy `ADMIN_PASSWORDS` array.

After that row exists, the env-var path keeps working in parallel — you
can drop `BOOTSTRAP_ADMIN_PASSWORD` on the next deploy.

### TOTP 2FA

Optional. Once you've logged in once and bootstrapped `admin_accounts`:

```
admin → Account & Security → Setup 2FA
```

The admin panel UI for this is still on Naive UI; the underlying
endpoints (`/admin/2fa/setup`, `/admin/2fa/confirm`, `/admin/2fa/disable`)
already work and can be exercised via curl if needed.

### Brute-force protection

KV-backed. Always-on if your worker has the `KV` binding. Defaults:

* admin login: 5 failures → 15-minute lock per (IP, username)
* mail / tempmail login: 10 failures → 15-minute lock

`admin_accounts.failed_attempts` / `locked_until` provide row-level
protection against env-var-only attempts.

### Audit log

`/admin/audit_log` is now a paginated, filterable read-only view. The
table is filled automatically by Stage 3 endpoints; older deployments
will simply have an empty table until the next admin action.

---

## 5. Public API (tempmail)

`/public_api/v1/*` is brand-new and lives on the same worker:

```
GET    /public_api/v1/domains
POST   /public_api/v1/accounts          (rate-limited, daily IP cap)
POST   /public_api/v1/token
GET    /public_api/v1/me
DELETE /public_api/v1/me
GET    /public_api/v1/me/messages
GET    /public_api/v1/me/messages/:id
GET    /public_api/v1/me/messages/:id/source
DELETE /public_api/v1/me/messages/:id
GET    /public_api/v1/public/recent_messages
GET    /public_api/openapi.json
GET    /public_api/docs        (Swagger UI)
```

Disabled by default — until the admin sets at least one entry in
`tempmail.allowed_domains` (admin → Settings → TempMail), `/accounts`
returns 400 ("domains not set").

All quotas (`tempmail.rpm` / `tempmail.rps` /
`tempmail.accounts_per_day_per_ip` / `tempmail.account_ttl_hours` / etc.)
default to conservative values that fit comfortably inside the
Cloudflare free-tier limits.

---

## 6. Suggested deploy order

1. **Pull** the v2.0 tag.
2. **D1 migrations** (3 SQL files).
3. **Worker** redeploy.
4. **Admin Pages** redeploy from the new path.
5. Verify `https://admin.domain.com/` still loads and all existing
   functionality works exactly as in v1.x.
6. (Optional) Set up TOTP 2FA.
7. (Optional) Add `tempmail.allowed_domains` and deploy the
   `temp-email-mail` and `temp-email-tempmail` Pages projects.
8. (Optional) Move secrets (TG bot token, OAuth client secrets, …) from
   `wrangler.toml` into `system_settings` via admin → Settings.

If any step misbehaves, the previous step is independently reversible
(no destructive migrations, env-var paths still authenticate).

---

## What is *not* in v2.0

The following items are explicitly out of scope of the v2.0 release and
will land in subsequent minor / patch releases:

* **Admin UI on Vuetify 3** — the admin panel keeps its Naive UI look.
  All 18+ admin views keep working unchanged.
* **Native Russian admin translations** — RU column structurally exists
  for every key, but is initially equal to English. A dedicated
  translation PR is the next step.
* **vitepress Russian locale** — the docs site still ships only en + zh.
  The two brand-new pages (`multi-site-setup` / `feature/public-api`)
  are available in both EN and ZH.

These three items are tracked in [PLAN.md](./PLAN.md) and will be picked
up after the v2.0 PR series merges.
