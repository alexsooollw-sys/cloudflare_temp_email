# SMTP / IMAP proxy

A small Python proxy that lets a regular mail client (Thunderbird, K-9,
Apple Mail, …) read and send messages through a `cloudflare_temp_email`
worker via standard IMAP / SMTP protocols.

## How it talks to the worker

The proxy is a thin shim. It **does not** speak directly to D1 — every
operation goes through the worker's HTTP API:

| Mail client | Proxy | Worker endpoint |
|-------------|-------|-----------------|
| `IMAP LOGIN`           | `POST /api/address_login`    | issues a Bearer JWT |
| `IMAP FETCH` / `LIST`  | `GET /api/parsed_mails`, `GET /api/parsed_mail/:id` | server-parsed messages |
| `IMAP STORE \\Deleted` | `DELETE /api/mails/:id`      | per-message delete |
| `SMTP MAIL FROM:…`     | `POST /api/send_mail`        | sends through worker pipeline |

## v2.0 multi-site notes

Starting with **v2.0.0** the user-facing frontends moved off the single
`<worker-name>.pages.dev` host onto three subdomains:

* `admin.domain.com`    — admin panel
* `mail.domain.com`     — login + mailbox view
* `tempmail.domain.com` — anonymous mailboxes

The proxy is **agnostic** to that split. It only needs the worker URL —
typically `https://api.domain.com` after Stage 2 of the refactor:

```python
# config.py
WORKER_URL = "https://api.domain.com"
```

`address` credentials should be obtained through the new
`mail.domain.com` UI (which still calls the same `/api/address_login`
endpoint backed by `ENABLE_ADDRESS_PASSWORD=true`). Anonymous tempmail
accounts created via `tempmail.domain.com` are also valid: their JWTs
share the same shape as the legacy address JWTs, so they "just work" as
IMAP / SMTP credentials too — bear in mind they are short-lived
(`tempmail.account_ttl_hours`, default 24h).

## Run locally

```bash
pip install -r requirements.txt
WORKER_URL=https://api.domain.com python main.py
```

…or via the bundled `docker-compose.yaml`. See `config.py` for IMAP /
SMTP listening ports and TLS options.

## Compatibility table

| Worker version | Proxy compatibility |
|----------------|---------------------|
| v1.9.x and earlier | ✅ — uses `/api/parsed_mails` / `/api/address_login`, both unchanged in v2.0 |
| v2.0.x         | ✅ — same endpoints; tempmail JWTs newly accepted as well |
