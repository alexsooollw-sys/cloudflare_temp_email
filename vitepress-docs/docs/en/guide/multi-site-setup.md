# Multi-site setup (admin / mail / tempmail)

> Stage 2 of the [refactor plan](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/PLAN.md)
> splits the frontend into **three independent Cloudflare Pages projects**
> sharing one Worker API. This page covers DNS, deploys and post-install
> configuration.
>
> The full step-by-step guide also lives in the project root as
> [`DEPLOY.md`](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/DEPLOY.md).

## 1. Architecture

```text
admin.domain.com    → Pages: temp-email-admin     (Naive UI panel)
mail.domain.com     → Pages: temp-email-mail      (mailbox login + inbox)
tempmail.domain.com → Pages: temp-email-tempmail  (anonymous, mail.tm-style)
api.domain.com      → Worker (custom_domain) — shared API
MX  domain.com      → Cloudflare Email Routing → Worker
```

Each Pages project lives in `frontend/packages/{admin,mail,tempmail}` and
talks to the Worker through `VITE_API_BASE`.

## 2. DNS records

| Type  | Name      | Content                               | Proxy |
|-------|-----------|---------------------------------------|-------|
| MX    | `@`       | (Cloudflare Email Routing default MX) | —     |
| TXT   | `@`       | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — |
| TXT   | (DKIM)    | (provided by Email Routing)           | —     |
| CNAME | `admin`   | `temp-email-admin.pages.dev`          | ✅    |
| CNAME | `mail`    | `temp-email-mail.pages.dev`           | ✅    |
| CNAME | `tempmail`| `temp-email-tempmail.pages.dev`       | ✅    |
| CNAME | `api`     | `<worker-name>.<account>.workers.dev` | ✅    |

## 3. Deploy each Pages project

```bash
cd frontend/
pnpm install

# admin.domain.com
cd packages/admin/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-admin --branch production

# mail.domain.com
cd ../mail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-mail --branch production

# tempmail.domain.com
cd ../tempmail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-tempmail --branch production
```

Then in the Cloudflare dashboard, attach the matching custom domain to
each Pages project.

## 4. Worker

Run the new migrations after pulling Stage 2 code:

```bash
pnpm exec wrangler d1 execute <db-name> --remote \
    --file=db/2026-05-14-system-settings.sql
pnpm exec wrangler d1 execute <db-name> --remote \
    --file=db/2026-05-14-tempmail.sql
```

`system_settings` is the new typed/categorised configuration store
introduced in Stage 1; `tempmail` adds two columns to `address` so the
scheduled cleanup task can drop expired anonymous mailboxes.

Bind the worker to `api.domain.com` via **Workers & Pages → Custom
domains** and finally enable the Email Routing **Catch-all** rule pointing
at the worker.

## 5. Initial admin setup

1. Log in at `https://admin.domain.com/` with the bootstrap admin password.
2. Open **Settings → TempMail** and add the domains you want exposed for
   anonymous account creation. Without at least one entry, the
   `tempmail.*` site cannot create accounts.
3. Defaults are conservative (10 rpm, 1 rps, 100 mailboxes per IP per day,
   24-hour TTL) so a fresh deployment stays inside Cloudflare's free tier.

## 6. Public API

The tempmail site is backed by a new `/public_api/v1/*` REST surface:

```
GET    /public_api/v1/domains
POST   /public_api/v1/accounts
POST   /public_api/v1/token
GET    /public_api/v1/me
DELETE /public_api/v1/me
GET    /public_api/v1/me/messages
GET    /public_api/v1/me/messages/:id
GET    /public_api/v1/me/messages/:id/source
DELETE /public_api/v1/me/messages/:id
GET    /public_api/v1/public/recent_messages   (when public preview enabled)
```

See the dedicated [Public API reference](feature/public-api.md) page for
request/response shapes and per-endpoint rate limits.

## 7. Migration from a single-site v1.x install

* Existing CI workflows still build the admin panel; the dist path moved
  from `frontend/dist/` to `frontend/packages/admin/dist/`. The shipped
  `.github/workflows/*.yml` files have been updated.
* The mail site requires `ENABLE_ADDRESS_PASSWORD=true` — same flag as the
  legacy "Login with email + password" feature.
* The tempmail site needs at least one entry in `tempmail.allowed_domains`
  (admin → Settings → TempMail).
* No data migration is required; new tempmail mailboxes coexist with the
  legacy mailbox-by-JWT flow.
