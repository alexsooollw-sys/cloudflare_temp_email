# Public API (`/public_api/v1/*`)

> Stage 2 of the refactor introduces a public REST surface for the
> tempmail site (`tempmail.domain.com`). The endpoints are mounted under
> `/public_api/v1/*` on the same Worker that powers the admin / address
> APIs.
>
> **Interactive docs:** once deployed, the worker also serves
> [Swagger UI](https://swagger.io/tools/swagger-ui/) at
> `/public_api/docs` and the raw OpenAPI 3.1 specification at
> `/public_api/openapi.json`.
>
> Auth model:
> * `/domains`, `/accounts`, `/token`, `/public/*` — **no auth**, only
>   per-IP rate limits.
> * everything else — `Authorization: Bearer <jwt>` returned from
>   `/accounts` or `/token`.

## Endpoints

### `GET /public_api/v1/domains`

List of domains the admin has white-listed for anonymous tempmail account
creation.

```json
{
  "domains": [
    { "id": "example.com", "domain": "example.com", "isActive": true }
  ]
}
```

### `POST /public_api/v1/accounts`

Create an anonymous tempmail mailbox. The password **must** be the
SHA-256 hex digest of the user's plaintext password — the server compares
the hash directly.

Request:

```json
{
  "address": "johndoe@example.com",
  "password": "<sha256-hex>",
  "captcha_token": "<turnstile token if Turnstile is enabled>"
}
```

Response (`200 OK`):

```json
{
  "id": 42,
  "address": "johndoe@example.com",
  "token": "<jwt>",
  "expires_at": "2026-05-15 12:00:00"
}
```

Errors:

* `400` — invalid email / domain not in `tempmail.allowed_domains`.
* `400` — Turnstile failed.
* `429` — daily per-IP creation limit reached
  (`tempmail.accounts_per_day_per_ip`).

### `POST /public_api/v1/token`

Login to an existing tempmail mailbox. Same password format as `/accounts`.

```json
{ "address": "johndoe@example.com", "password": "<sha256-hex>" }
```

Response: `{ "token": "...", "address": "...", "expires_at": "..." }`.

Errors: `404` if the mailbox doesn't exist or has expired; `401` on bad
password.

### `GET /public_api/v1/me`

Returns the profile of the authenticated tempmail account.

```json
{
  "id": 42,
  "address": "johndoe@example.com",
  "expires_at": "2026-05-15 12:00:00",
  "created_at": "2026-05-14 12:00:00"
}
```

### `DELETE /public_api/v1/me`

Permanently remove the mailbox and **all** of its mail / sent items /
auto-reply / bindings. Returns `{ "success": true }`.

### `GET /public_api/v1/me/messages?page=1&limit=20`

Paginated, server-parsed inbox. `limit` is clamped to `[1, 100]`.

```json
{
  "page": 1,
  "limit": 20,
  "total": 3,
  "messages": [
    {
      "id": 5,
      "created_at": "2026-05-14 12:00:00",
      "sender": "noreply@github.com",
      "subject": "Verify your email",
      "text": "Click the link to verify…",
      "html": "<html>…</html>",
      "attachments": [
        { "filename": "logo.png", "mimeType": "image/png", "disposition": "inline", "size": 1234 }
      ]
    }
  ]
}
```

### `GET /public_api/v1/me/messages/:id`

Single message, parsed.

### `GET /public_api/v1/me/messages/:id/source`

Raw RFC822 source. `Content-Type: message/rfc822; charset=utf-8`.

### `DELETE /public_api/v1/me/messages/:id`

Delete one message. `{ "success": true }`.

### `GET /public_api/v1/public/recent_messages`

Optional landing-page preview of subjects across all tempmail mailboxes.
Returns `{ "messages": [...], "enabled": false }` when the admin has
`tempmail.enable_public_preview` disabled.

## Rate limits

Per-IP. All values configurable in **admin → Settings → TempMail**.

| Setting key | Default | Effect |
|-------------|---------|--------|
| `tempmail.rpm` | 10 | Cloudflare unsafe ratelimit (when `RATE_LIMITER` binding present) |
| `tempmail.rps` | 1 | Same binding, burst limit |
| `tempmail.accounts_per_day_per_ip` | 100 | Hard daily cap on `/accounts` per IP (KV-backed) |
| `tempmail.account_ttl_hours` | 24 | TTL of a fresh tempmail mailbox |
| `tempmail.max_messages_per_account` | 50 | Soft cap; older messages are not auto-trimmed yet |
| `tempmail.max_attachment_mb` | 1 | Per-attachment size cap (enforced by the email pipeline) |
| `tempmail.max_body_mb` | 1 | Per-message body cap |

A scheduled cron task (added to `worker/src/scheduled.ts`) deletes
mailboxes whose `tempmail_expires_at` is in the past, including all of
their messages.
