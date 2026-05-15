# 公开 API（`/public_api/v1/*`）

> 阶段 2 为 `tempmail.domain.com` 引入了一组公开 REST 接口，挂载在与
> admin / address API 同一个 Worker 下的 `/public_api/v1/*`。
>
> **交互式文档：** 部署后 Worker 同时在 `/public_api/docs` 提供
> [Swagger UI](https://swagger.io/tools/swagger-ui/) 页面，
> 原始 OpenAPI 3.1 规范位于 `/public_api/openapi.json`。
>
> 认证：
> * `/domains`、`/accounts`、`/token`、`/public/*` —— **无需认证**，仅按 IP 限流。
> * 其他端点 —— `Authorization: Bearer <jwt>`，token 来自 `/accounts` 或 `/token`。

## 端点

### `GET /public_api/v1/domains`

返回管理员允许匿名创建邮箱的域名列表：

```json
{ "domains": [ { "id": "example.com", "domain": "example.com", "isActive": true } ] }
```

### `POST /public_api/v1/accounts`

创建匿名邮箱。`password` 必须是用户明文密码的 SHA-256 十六进制散列。

```json
{
  "address": "johndoe@example.com",
  "password": "<sha256-hex>",
  "captcha_token": "<turnstile>"
}
```

成功返回：

```json
{
  "id": 42,
  "address": "johndoe@example.com",
  "token": "<jwt>",
  "expires_at": "2026-05-15 12:00:00"
}
```

错误：

* `400` — 邮箱格式错误 / 域名不在 `tempmail.allowed_domains`。
* `400` — Turnstile 校验失败。
* `429` — 触发每日 IP 限额（`tempmail.accounts_per_day_per_ip`）。

### `POST /public_api/v1/token`

使用已有匿名邮箱登录。请求体同 `/accounts`（无 captcha）。返回 token + 过期时间。

### `GET /public_api/v1/me`

返回当前账号信息。

### `DELETE /public_api/v1/me`

永久删除该账号及其全部数据。

### `GET /public_api/v1/me/messages?page=1&limit=20`

服务器端解析的收件箱。`limit` 范围 `[1, 100]`。返回数据结构包含 `sender`/
`subject`/`text`/`html`/`attachments` 字段。

### `GET /public_api/v1/me/messages/:id`

单封邮件，已解析。

### `GET /public_api/v1/me/messages/:id/source`

原始 RFC822 邮件源，`Content-Type: message/rfc822; charset=utf-8`。

### `DELETE /public_api/v1/me/messages/:id`

删除单封邮件。

### `GET /public_api/v1/public/recent_messages`

可选的着陆页预览（仅主题 + 时间，不返回正文）。管理员关闭
`tempmail.enable_public_preview` 时返回 `{ "messages": [], "enabled": false }`。

## 限流

所有限流配置均在 **管理后台 → Settings → TempMail** 中可调：

| 设置项 | 默认值 | 含义 |
|--------|--------|------|
| `tempmail.rpm` | 10 | Cloudflare ratelimit 绑定的每分钟请求数 |
| `tempmail.rps` | 1 | 同上，瞬时峰值 |
| `tempmail.accounts_per_day_per_ip` | 100 | `/accounts` 每 IP 每天硬上限（KV 计数） |
| `tempmail.account_ttl_hours` | 24 | 新匿名邮箱的存活时间 |
| `tempmail.max_messages_per_account` | 50 | 收件箱软上限 |
| `tempmail.max_attachment_mb` | 1 | 单附件大小限制 |
| `tempmail.max_body_mb` | 1 | 单封邮件正文大小限制 |

新增的定时任务（`worker/src/scheduled.ts`）会自动清理 `tempmail_expires_at`
已过期的邮箱，包括其全部邮件、发件箱等数据。
