# Обновление v1.x → v2.0 (короткий чеклист)

> **Не для свежей установки.** Если у вас ещё ничего не развёрнуто, читайте
> [DEPLOY.md](./DEPLOY.md). Этот документ — пошаговый апгрейд работающего
> v1.x. Для глубокого описания каждого изменения см.
> [MIGRATION_v1_to_v2.md](./MIGRATION_v1_to_v2.md).

**Сколько времени:** ~15 минут. **Простой:** нет (миграции БД не блокируют
существующие данные, env-vars продолжают работать).

---

## Что меняется (краткий список)

| Что | Было (v1.x) | Стало (v2.0) |
|-----|-------------|--------------|
| Frontend | один Pages-проект | pnpm workspaces: `frontend/packages/{admin,mail,tempmail,shared}` |
| Артефакт сборки | `frontend/dist/` | `frontend/packages/admin/dist/` |
| Frontend deploy | `pnpm deploy` в `frontend/` | `pnpm --filter @cte/admin run deploy` |
| Локали UI | 6 (zh / en / es / ja / de / pt-BR) | **2** (en + ru) |
| Default lang | `zh` | `en` |
| Таблиц в БД | как было | **+3 новых** (`system_settings`, `admin_accounts`, `admin_audit_log`) и **+2 столбца** в `address` |

Всё остальное **остаётся прежним**: Worker URL, env-vars, `JWT_SECRET`,
существующие mailbox JWTs, Email Routing — без изменений.

---

## Шаг 0. Backup (1 мин, рекомендуется)

```bash
# D1 export (Cloudflare dashboard → Workers & Pages → D1 → ваша база → Export)
# Это даст SQL-дамп, к которому можно откатиться в случае проблемы.
```

Также убедитесь, что в `worker/wrangler.toml` записаны все ваши секреты —
файл будет нужен ещё раз на шаге 3.

---

## Шаг 1. Получить v2.0 (1 мин)

```bash
git fetch origin
git pull origin main          # или checkout соответствующего тега v2.0.x
```

Если вы делаете апгрейд через свой fork с GitHub Actions — просто
смерджите `upstream/main`, остальное сделает workflow.

---

## Шаг 2. Миграции БД (2 мин)

В корне репозитория:

```bash
cd worker/

# Если у вас D1 называется иначе — поменяйте `<db-name>`.
DB=<db-name>

pnpm exec wrangler d1 execute "$DB" --remote \
    --file=../db/2026-05-14-system-settings.sql

pnpm exec wrangler d1 execute "$DB" --remote \
    --file=../db/2026-05-14-tempmail.sql

pnpm exec wrangler d1 execute "$DB" --remote \
    --file=../db/2026-05-14-admin-security.sql
```

Все три миграции — `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD
COLUMN`. Они **не переписывают** существующие строки и **не падают**, если
запустить их повторно.

---

## Шаг 3. Redeploy Worker (3 мин)

Если ранее ваш `wrangler.toml` содержал `DEFAULT_LANG = "zh"` — поменяйте
на `"en"` или удалите эту строку.

```bash
cd worker/
pnpm install --no-frozen-lockfile
pnpm deploy
```

После redeploy:

* `https://api.domain.com/health_check` → `OK`.
* `https://api.domain.com/public_api/openapi.json` → JSON со списком
  endpoints (новинка v2.0).
* `https://api.domain.com/public_api/docs` → Swagger UI.

---

## Шаг 4. Redeploy admin Pages (3 мин)

**Путь сборки изменился.** Если у вас своя CI / скрипт — обновите путь на
`frontend/packages/admin/dist/`. Workflow'ы из репо
(`.github/workflows/frontend_deploy.yaml`, `tag_build.yml` и т. д.) уже
обновлены автоматически в v2.0.

Локально:

```bash
cd frontend/
pnpm install --no-frozen-lockfile
pnpm --filter @cte/admin run deploy --project-name=<your-pages-project>
```

После deploy откройте `https://admin.domain.com/`. Должны увидеть:

* Существующие табы работают как в v1.x.
* В табе **Quick Setup** — два новых пункта: *System Settings* и
  *TempMail Settings*.
* В табе **Admin** — два новых пункта: *Account & Security* и *Audit Log*.
* В переключателе языка — только English / Русский.

⚠️ Если ваш браузер был на zh — переключитесь на en/ru вручную (zh больше
не поддерживается).

---

## Шаг 5 (опц.). Mail и TempMail subsites (5 мин каждый)

Эти два — **новые**. Если вам они не нужны (вы используете только
admin), можно пропустить.

### `mail.domain.com` — для существующих mailbox

```bash
cd frontend/packages/mail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-mail \
    --branch production
```

В Cloudflare → Pages → `temp-email-mail` → Custom domains → добавить
`mail.domain.com`.

DNS: `CNAME mail → temp-email-mail.pages.dev`.

Требует `ENABLE_ADDRESS_PASSWORD=true` (вероятно, у вас уже включено,
иначе вход по email/паролю не работал бы и в v1.x).

### `tempmail.domain.com` — для анонимных пользователей

```bash
cd frontend/packages/tempmail/
echo 'VITE_API_BASE=https://api.domain.com' > .env.production
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=temp-email-tempmail \
    --branch production
```

Custom domain: `tempmail.domain.com`. CNAME аналогично.

**Не забудьте:** после deploy в админке откройте *TempMail Settings* и
добавьте хотя бы один домен в *Allowed domains* — иначе
`tempmail.domain.com` не сможет создавать ящики.

---

## Шаг 6 (опц., но рекомендуется). 2FA (2 мин)

1. Зайдите в админку.
2. **Admin → Account & Security → Enable 2FA**.
3. Добавьте отображаемую `otpauth://` ссылку в Google Authenticator /
   Authy / 1Password.
4. Введите 6-значный код, нажмите *Confirm and enable*.
5. Выйдите и зайдите снова — после ввода пароля система спросит TOTP.

Бонус: после первого успешного входа в `admin_accounts` появится строка,
автоматически созданная из `BOOTSTRAP_ADMIN_PASSWORD` или первого
значения из `ADMIN_PASSWORDS`. Эту env-var из `wrangler.toml` теперь
можно удалить (опционально) — DB-учётка работает дальше.

---

## Verify (3 мин)

| Что проверить | Где | Ожидание |
|---------------|-----|----------|
| Worker жив | `https://api.domain.com/health_check` | `OK` |
| OpenAPI | `https://api.domain.com/public_api/openapi.json` | JSON 3.1 |
| Swagger UI | `https://api.domain.com/public_api/docs` | HTML страница |
| Admin грузится | `https://admin.domain.com/` | Naive UI как раньше |
| Логин в admin работает | старый пароль из `ADMIN_PASSWORDS` | вход успешен |
| Получение почты работает | отправить тестовое письмо на любой адрес | приходит в течение ~30 сек |
| Существующие mailbox JWTs работают | старая ссылка из v1.x | открывает почтовый ящик |
| 2FA включается | Admin → Account & Security | `Enabled` после подтверждения |
| Аудит лог пишется | Admin → Audit Log | минимум одна строка `admin_login` |

---

## Rollback (если что-то пошло не так)

Все три миграции — **non-destructive ADD-only**. Откат в большинстве
случаев = redeploy старой версии Worker и Pages:

```bash
# 1. Откатить код
git checkout <предыдущий-tag>   # напр. v1.9.0

# 2. Worker — пересобрать со старого кода
cd worker/
pnpm install --no-frozen-lockfile
pnpm deploy

# 3. Admin Pages — старый путь dist (frontend/dist/)
cd ../frontend/
pnpm install --no-frozen-lockfile
pnpm build
pnpm exec wrangler pages deploy ./dist \
    --project-name=<your-pages-project> --branch production
```

Новые таблицы (`system_settings`, `admin_accounts`, `admin_audit_log`) и
новые столбцы в `address` останутся в БД, но не будут использоваться
старым кодом — это безопасно.

Если хотите удалить новые объекты из БД полностью:

```sql
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS admin_accounts;
DROP TABLE IF EXISTS admin_audit_log;
ALTER TABLE address DROP COLUMN is_tempmail;
ALTER TABLE address DROP COLUMN tempmail_expires_at;
```

(D1 поддерживает `DROP COLUMN` начиная с SQLite 3.35.)

---

## FAQ

**Q: Я использую GitHub Actions деплой, надо ли что-то править?**
Нет. Workflow'ы (`frontend_deploy.yaml`, `frontend_pagefunction_deploy.yaml`,
`tag_build.yml`) обновлены в v2.0 — путь сборки и команды поменяются
автоматически после `git pull`.

**Q: У меня в `wrangler.toml` много env-vars, что-то надо удалять?**
Нет. Все старые env-vars продолжают работать. В v2.0 появилась таблица
`system_settings` с тем же набором конфигов и приоритетом *env → DB →
default*. Можете оставить env как есть, или постепенно переносить
секреты (TG bot token, OAuth client secrets) в админку → System Settings
с галочкой *Encrypted*.

**Q: Что с TG-ботом — нужно перенастраивать webhook?**
Нет. Сам endpoint `/telegram/webhook` без изменений. Только `/lang`
команда теперь принимает `en` / `ru` вместо `en` / `zh`.

**Q: Почему zh-локаль удалили?**
Так попросил автор задачи на рефактор. Если вам нужен китайский в UI —
форкните и верните `zh.ts` в frontend `LOCALE_REGISTRY`. Доки на zh
(`vitepress-docs/docs/zh/`) при этом сохранены полностью.

**Q: Старые mailbox JWTs ещё работают?**
Да. JWT-формат не менялся.

**Q: Я не вижу новых табов в админке.**
Очистите кэш браузера / hard refresh — старый JS bundle кэширован
PWA service worker'ом.

**Q: Tempmail аккаунты не создаются — `400 Domains not set`.**
Это нормально на свежем v2.0. Зайдите в админку → *TempMail Settings* →
заполните *Allowed domains* (например, `temp.example.com`) → Save.

---

## Что осталось для будущих минор-релизов

* Полный редизайн admin на Vuetify 3 + Material Design 3.
* Перевод `vitepress-docs/docs/` на русский (сейчас только en + zh).

Эти пункты не блокируют v2.0 и не появятся "случайно" — будут в
отдельных PR. v2.0 admin продолжит работать на Naive UI без изменений.
