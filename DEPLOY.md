# Multi-site deployment guide

> Deploy `cloudflare_temp_email` v2.x as **three independent Cloudflare
> Pages projects** sharing a single Worker API. This is the new layout
> introduced by [PLAN.md](./PLAN.md) Stage 2.
>
> If you previously ran a single-site deployment from the legacy `frontend/`
> tree, see the [Migration notes](#migration-from-single-site-deployment) at
> the bottom.

---

## 1. Architecture at a glance

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare DNS (domain.com)                                         │
│                                                                      │
│  ├─ admin.domain.com    → Pages: temp-email-admin (Naive UI panel)   │
│  ├─ mail.domain.com     → Pages: temp-email-mail  (mailbox login)    │
│  ├─ tempmail.domain.com → Pages: temp-email-tempmail (anonymous)     │
│  └─ api.domain.com      → Worker (custom_domain) — shared API        │
│                                                                      │
│  MX domain.com           → Cloudflare Email Routing → Worker.email   │
└─────────────────────────────────────────────────────────────────────┘
```

Each Pages project is built from a separate package in the
`frontend/packages/*` workspace and points its API calls at
`api.domain.com` via the `VITE_API_BASE` env var.

---

## 2. Prerequisites

* A Cloudflare account on the **free** plan (paid plans work too).
* A domain whose nameservers are managed by Cloudflare.
* `node >= 24`, `pnpm >= 10`, and `git`.
* `wrangler` (installed automatically as a dev dependency in `worker/` and
  the frontend packages).
* For email delivery: **Cloudflare Email Routing** must be enabled on the
  domain.

---

## 3. DNS records

Set these records in the Cloudflare dashboard for `domain.com`:

| Type | Name      | Content                               | Proxy |
|------|-----------|---------------------------------------|-------|
| MX   | `@`       | (Cloudflare Email Routing default MX) | —     |
| TXT  | `@`       | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — |
| TXT  | (DKIM)    | (provided by Cloudflare Email Routing) | —     |
| CNAME| `admin`   | `temp-email-admin.pages.dev`          | ✅    |
| CNAME| `mail`    | `temp-email-mail.pages.dev`           | ✅    |
| CNAME| `tempmail`| `temp-email-tempmail.pages.dev`       | ✅    |
| CNAME| `api`     | `<worker-name>.<account>.workers.dev` | ✅    |

(After step 6 you can replace the `<worker-name>` CNAME with a Worker custom
domain, which is cleaner.)

---

## 4. Email Routing

1. Cloudflare dashboard → **Email** → **Email Routing**.
2. Click **Get started**, follow the wizard. Cloudflare will automatically
   add the MX, SPF and DKIM records from step 3.
3. Wait until **Email Routing** status is *Active*.
4. **Do not create a Catch-all rule yet** — we'll bind the Worker first.

⚠️ Subdomains do **not** inherit Email Routing from the parent domain. If you
intend to receive email on `mail.domain.com` itself (e.g. for tempmail
accounts on a subdomain), enable Email Routing on that subdomain
separately.

---

## 5. D1 database

```bash
cd worker/
pnpm install
pnpm exec wrangler d1 create temp-email-db
# copy the database_id printed by wrangler
```

Initialise the schema and run the dated migrations:

```bash
pnpm exec wrangler d1 execute temp-email-db --remote --file=../db/schema.sql
# Apply each ../db/YYYY-MM-DD-*.sql in chronological order.
# In particular, Stage 1+2 introduces:
pnpm exec wrangler d1 execute temp-email-db --remote --file=../db/2026-05-14-system-settings.sql
pnpm exec wrangler d1 execute temp-email-db --remote --file=../db/2026-05-14-tempmail.sql
```

---

## 6. Worker (API)

```bash
cd worker/
cp wrangler.toml.template wrangler.toml
```

Edit `wrangler.toml`:

* `name` — give your worker a unique name (e.g. `temp-email-api`).
* `[[d1_databases]]` — fill `database_name` and `database_id` from step 5.
* `JWT_SECRET` — generate a long random string (`openssl rand -hex 32`).
* `BOOTSTRAP_ADMIN_PASSWORD` (any value) — used for the very first admin
  login. After enabling 2FA you can remove this line.
* `DOMAINS` / `DEFAULT_DOMAINS` — list of domains the worker will accept.
* (Optional but recommended) Enable the rate-limit binding:
  ```toml
  [[unsafe.bindings]]
  name = "RATE_LIMITER"
  type = "ratelimit"
  namespace_id = "1001"
  simple = { limit = 10, period = 60 }
  ```
* (Optional) `[[kv_namespaces]] binding = "KV"` if you want IP-based daily
  limits / verification codes.

Deploy and bind a custom domain:

```bash
pnpm install
pnpm deploy
```

Cloudflare dashboard → **Workers & Pages** → your worker → **Custom domains**
→ add `api.domain.com`. The DNS CNAME from step 3 will be replaced by a
custom-domain record.

Finally, go back to **Email Routing** → **Email Workers** and create a
**Catch-all** rule pointing to the deployed worker. Test by sending mail to
any address `*@domain.com` — it should be visible in the admin panel within
a few seconds.

---

## 7. Frontend × 3

```bash
cd frontend/
pnpm install
```

The repo ships three Pages-ready packages (`@cte/admin`, `@cte/mail`,
`@cte/tempmail`). They all read `VITE_API_BASE` from a per-package
`.env.production` file.

For each of them, deploy as a separate Pages project:

```bash
# === Admin panel — admin.domain.com ===
cd packages/admin/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-admin \
    --branch production

# === Mail (mailbox login) — mail.domain.com ===
cd ../mail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-mail \
    --branch production

# === Tempmail (anonymous mailboxes) — tempmail.domain.com ===
cd ../tempmail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-tempmail \
    --branch production
```

For each Pages project, in the Cloudflare dashboard → **Workers & Pages**
→ select the project → **Custom domains** → add the matching subdomain.

---

## 8. Initial admin setup

1. Open `https://admin.domain.com/`.
2. Log in with `BOOTSTRAP_ADMIN_PASSWORD`.
3. Open **Settings** → **General** and adjust the title / announcement.
4. Open **Settings** → **TempMail** and add the domains you want to expose
   for anonymous tempmail account creation. Also tune the daily/per-IP
   limits there. Defaults are conservative (10rpm, 1rps, 100 mailboxes
   per IP per day, 24-hour TTL).
5. (Recommended) Open **Account & Security** and enable TOTP 2FA. Once it
   is set up, remove `BOOTSTRAP_ADMIN_PASSWORD` from `wrangler.toml` and
   redeploy the worker — admin login will then go through the
   `admin_accounts` table only.

---

## 9. Verification checklist

* [ ] `https://admin.domain.com/` loads the admin panel.
* [ ] `https://mail.domain.com/` shows the centered login card.
* [ ] `https://tempmail.domain.com/` shows the landing page.
* [ ] `https://api.domain.com/health_check` returns `OK`.
* [ ] Create a tempmail account → send a test email to it from any
      external mailbox → it shows up in the inbox within ~30 seconds.

---

## Migration from single-site deployment

If you upgrade from a v1.x single-site install:

1. Pull the new code; existing CI workflows still build the admin panel
   (path moved from `frontend/dist/` to `frontend/packages/admin/dist/`).
2. Run the new migrations: `db/2026-05-14-system-settings.sql` and
   `db/2026-05-14-tempmail.sql`.
3. Your existing Pages project keeps working as the **admin** site. Add
   two new Pages projects (`temp-email-mail`, `temp-email-tempmail`) for
   the new subdomains.
4. The mail.* site requires `ENABLE_ADDRESS_PASSWORD=true` — the same flag
   that already powered the legacy "Login with email + password" flow.
5. The tempmail.* site needs at least one entry in
   `tempmail.allowed_domains` (set via admin → Settings → TempMail).

---

## Troubleshooting

* **`Network Error` on every API request** — check that `VITE_API_BASE`
  in the Pages env var points at `https://api.domain.com` (no trailing
  slash) and the API custom domain is configured in the worker.
* **Tempmail account creation always fails with "Invalid domain"** — the
  domain isn't in `tempmail.allowed_domains`. Add it via admin →
  Settings → TempMail.
* **Mail.* login returns 403 "Password login is disabled"** —
  `ENABLE_ADDRESS_PASSWORD` is not enabled. Enable it in `wrangler.toml`
  (or via admin → Settings → Security once the flag is migrated to the
  DB).
* **Worker build fails interactively asking about "Hono framework"** —
  `wrangler.toml` is missing or unreadable. Copy the template and fill in
  the required fields.
