# 多站点部署（admin / mail / tempmail）

> [重构计划](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/PLAN.md)
> 阶段 2 将前端拆分为 **三个独立的 Cloudflare Pages 项目**，共用同一个 Worker
> 后端。仓库根目录的 [`DEPLOY.md`](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/DEPLOY.md)
> 提供完整逐步指引，本页给出简明概览。

## 1. 架构

```text
admin.domain.com    → Pages: temp-email-admin     (Naive UI 管理面板)
mail.domain.com     → Pages: temp-email-mail      (邮箱登录 + 收件箱)
tempmail.domain.com → Pages: temp-email-tempmail  (匿名 mail.tm 风格)
api.domain.com      → Worker (custom_domain) — 共享 API
MX  domain.com      → Cloudflare Email Routing → Worker
```

三个 Pages 项目分别位于 `frontend/packages/{admin,mail,tempmail}`，通过
`VITE_API_BASE` 指向同一个 Worker。

## 2. DNS

| 类型  | 名称       | 内容                                  | 代理 |
|-------|-----------|---------------------------------------|------|
| MX    | `@`       | Cloudflare Email Routing 默认 MX      | —    |
| TXT   | `@`       | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — |
| TXT   | (DKIM)    | Email Routing 自动配置                | —    |
| CNAME | `admin`   | `temp-email-admin.pages.dev`          | ✅   |
| CNAME | `mail`    | `temp-email-mail.pages.dev`           | ✅   |
| CNAME | `tempmail`| `temp-email-tempmail.pages.dev`       | ✅   |
| CNAME | `api`     | `<worker-name>.<account>.workers.dev` | ✅   |

## 3. 部署三个 Pages

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

之后在 Cloudflare 控制台为每个 Pages 项目绑定对应子域名。

## 4. Worker 与数据库迁移

拉取阶段 2 代码后执行：

```bash
pnpm exec wrangler d1 execute <db-name> --remote \
    --file=db/2026-05-14-system-settings.sql
pnpm exec wrangler d1 execute <db-name> --remote \
    --file=db/2026-05-14-tempmail.sql
```

`system_settings` 是阶段 1 引入的分类配置表；`tempmail` 迁移给 `address`
表增加两列，便于定时清理过期匿名邮箱。

最后通过 **Workers & Pages → Custom domains** 将 Worker 绑定到
`api.domain.com`，并在 **Email Routing** 中创建指向该 Worker 的 Catch-all
规则。

## 5. 初次配置

1. 用 `BOOTSTRAP_ADMIN_PASSWORD` 登录 `admin.domain.com`。
2. **Settings → TempMail**：填入允许匿名创建邮箱的域名列表，并按需调整
   配额（默认 10 rpm / 1 rps / 100 mailboxes/IP/day / TTL 24 小时）。
3. 没有任何 `tempmail.allowed_domains` 时，`tempmail.*` 站无法创建账号。

## 6. 公开 API

tempmail 站基于新的 `/public_api/v1/*` REST 接口，详见
[公开 API](feature/public-api.md)。
