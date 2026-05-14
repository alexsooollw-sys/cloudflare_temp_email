# Глобальный рефакторинг `cloudflare_temp_email`

> Документ описывает поэтапный план рефакторинга проекта: переделка фронтенда в стиле Material Design 3 с тремя темами, разделение на три отдельных сайта (admin / mail / tempmail), миграция настроек из env-vars в БД, добавление 2FA, защиты от брутфорса и публичного REST API.
>
> **Статус:** утверждённый план. Реализация ведётся поэтапно (3 PR).
>
> **Автор плана:** Devin (Claude Opus 4.7 Max Fast), 2026-05-14.

---

## 1. Цели и фиксированные решения

Все решения ниже согласованы с заказчиком в Plan Mode и не подлежат изменению без новой итерации обсуждения.

| # | Параметр | Решение |
|---|----------|---------|
| 1 | Подход к реализации | **Поэтапно**, 3 PR (Этап 1 → 2 → 3) |
| 2 | Multi-site архитектура | **3 отдельных Cloudflare Pages-проекта** (`admin.*`, `mail.*`, `tempmail.*`) + 1 общий Worker как API-бэкенд |
| 3 | Судьба существующих фич (user accounts, OAuth2, passkeys, Telegram bot, AI extract, webhooks) | **Оставить опциональным** — toggles в админке, можно полностью скрыть от пользователей |
| 4 | UI framework | **Vuetify 3** (из коробки MD3); постепенная миграция с Naive UI |
| 5 | 2FA для админа | **TOTP only + IP lockout** (5 неудач → 15 мин), audit log входов |
| 6 | Публичный API tempmail | **Свой REST** под `/public_api/v1/*` + Swagger UI на `/public_api/docs` |
| 7 | Конфигурация | **Максимум в UI** (через БД); в env остаются только `JWT_SECRET` + bootstrap `ADMIN_PASSWORD` |
| 8 | Темы | **Light / Dark / AMOLED** + accent color picker (Material палитра: indigo/blue/green/orange/red/purple/teal/pink) |
| 9 | Лимиты tempmail | **Агрессивные дефолты, всё конфигурится** в админке (дефолты под free tier CF Workers) |
| 10 | Фичи tempmail | **Максимум** (просмотр, вложения, autorefresh, удаление аккаунта, публичные превью последних писем) |
| 11 | Сопутствующие проекты | Обновить всё: `vitepress-docs`, `e2e`, `smtp_proxy_server` |
| 12 | Документация по деплою | `DEPLOY.md` в корне репозитория + полный раздел в `vitepress-docs` (EN + RU) |
| 13 | Локали UI | Только **EN** (default) и **RU**. Удалить `zh`, `es`, `pt-BR`, `ja`, `de` из фронтенда и worker |

---

## 2. Целевая архитектура

```text
┌────────────────────────────────────────────────────────────────────┐
│  Cloudflare DNS (domain.com)                                        │
│                                                                     │
│  ├─ admin.domain.com    →  Pages: temp-email-admin                  │
│  ├─ mail.domain.com     →  Pages: temp-email-mail                   │
│  ├─ tempmail.domain.com →  Pages: temp-email-tempmail               │
│  └─ api.domain.com      →  Worker (custom_domain) — общий API       │
│                                                                     │
│  MX domain.com           →  Cloudflare Email Routing → Worker.email │
└────────────────────────────────────────────────────────────────────┘
```

Все 3 Pages-проекта на этапе boot вызывают `api.domain.com/health_check` и общаются с одним Worker.
Worker по `Host`-header / origin определяет какой публичный/админский endpoint доступен.

### 2.1 Структура frontend (после миграции в monorepo)

```text
frontend/                      ← pnpm workspaces корень
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/                ← общий код для admin/mail/tempmail
│   │   ├── src/
│   │   │   ├── theme/         ← MD3 design tokens, 3 темы, accent color
│   │   │   ├── i18n/          ← en + ru
│   │   │   ├── api/           ← axios клиент
│   │   │   ├── composables/   ← общие хуки (useAuth, useTheme, ...)
│   │   │   └── components/    ← MailBox, AttachmentList, ThemeSwitcher, ...
│   │   └── package.json
│   ├── admin/                 ← admin.domain.com (Vuetify 3 + MD3)
│   ├── mail/                  ← mail.domain.com (login почтового ящика)
│   └── tempmail/              ← tempmail.domain.com (mail.tm-like)
```

### 2.2 Структура worker (изменения)

```text
worker/src/
├── public_api/                ← НОВЫЙ (Этап 3)
│   ├── index.ts               ← Hono sub-router /public_api/v1/*
│   ├── accounts.ts            ← create / login / delete account
│   ├── messages.ts            ← list / get / delete сообщения
│   ├── openapi.ts             ← OpenAPI 3.1 schema generator (hono-openapi)
│   └── docs.ts                ← Swagger UI handler (/public_api/docs)
├── admin_api/
│   ├── two_factor.ts          ← НОВЫЙ (Этап 3) — TOTP setup/disable
│   ├── audit_log.ts           ← НОВЫЙ (Этап 3) — лог входов и действий
│   ├── system_settings.ts     ← НОВЫЙ (Этап 1) — get/save/test всех настроек
│   └── ...
├── auth/                      ← НОВЫЙ (Этап 3)
│   ├── brute_force.ts         ← KV-based счётчик попыток + lockout
│   ├── admin_session.ts       ← JWT сессии админа (отличается от user)
│   └── totp.ts                ← RFC 6238 на Web Crypto (Workers-compat)
├── i18n/
│   ├── en.ts
│   ├── ru.ts                  ← НОВЫЙ
│   └── (zh.ts удалён)
├── utils.ts                   ← добавлен getEnvOrSetting()
└── ...
```

---

## 3. Этап 1 — Фундамент (PR #1)

**Цель:** подготовить инфраструктуру и базу для последующего редизайна, не ломая текущих пользователей. Существующий Naive UI продолжает работать рядом.

### 3.1 Worker — миграция настроек env → БД

#### Новая таблица
```sql
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,               -- открытые значения (JSON)
    encrypted_value BLOB,     -- AES-GCM зашифрованные секреты
    category TEXT,            -- general / domains / tempmail / email / telegram / oauth / ai / webhook / security
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Шифрование: AES-GCM, ключ выводится из `JWT_SECRET` через `crypto.subtle.deriveKey` (PBKDF2 / 100k iterations, salt = SHA-256(`JWT_SECRET`)).

#### Хелпер
```typescript
// worker/src/utils.ts
export const getEnvOrSetting = async <T = string>(
  c: Context<HonoCustomType>,
  envKey: string,
  settingKey?: string,
  defaultValue?: T,
): Promise<T | undefined>
```

Приоритет: **env var → DB setting → default**. Это безопасный rollout: пока env задана, она побеждает; при удалении env используется значение из БД.

#### Новые admin endpoints
- `GET  /admin/system/settings?category=...` — все настройки (секреты маскируются `***`)
- `POST /admin/system/settings` — сохранение (JSON Schema валидация)
- `POST /admin/system/test` — `{ type: 'telegram' | 'smtp' | 'webhook', payload }` для проверки токенов/URL

#### Категории настроек в UI
| Категория | Параметры |
|-----------|-----------|
| `general` | `TITLE`, `ANNOUNCEMENT`, `ALWAYS_SHOW_ANNOUNCEMENT`, `COPYRIGHT`, `DEFAULT_LANG`, `STATUS_URL`, `ADMIN_CONTACT` |
| `domains` | `DOMAINS`, `DEFAULT_DOMAINS`, `DOMAIN_LABELS`, `ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH`, `RANDOM_SUBDOMAIN_DOMAINS`, `RANDOM_SUBDOMAIN_LENGTH`, `PREFIX`, `ADDRESS_REGEX`, `MIN/MAX_ADDRESS_LEN`, `ADDRESS_CHECK_REGEX`, `DISABLE_CUSTOM_ADDRESS_NAME` |
| `tempmail` | (НОВЫЕ) `tempmail.allowed_domains`, `tempmail.account_ttl_hours`, `tempmail.max_messages_per_account`, `tempmail.rpm`, `tempmail.rps`, `tempmail.accounts_per_day_per_ip`, `tempmail.max_attachment_mb`, `tempmail.max_body_mb`, `tempmail.enable_public_preview`, `tempmail.public_preview_count`, `tempmail.enable_autorefresh`, `tempmail.autorefresh_interval_sec` |
| `email` | `ENABLE_CHECK_JUNK_MAIL`, `JUNK_MAIL_CHECK_LIST`, `JUNK_MAIL_FORCE_PASS_LIST`, `REMOVE_EXCEED_SIZE_ATTACHMENT`, `REMOVE_ALL_ATTACHMENT`, `ENABLE_MAIL_GZIP`, `FORWARD_ADDRESS_LIST`, `SUBDOMAIN_FORWARD_ADDRESS_LIST`, `ENABLE_AUTO_REPLY` |
| `telegram` | `TG_BOT_TOKEN` (🔒), `TG_MAX_ADDRESS`, `TG_BOT_INFO`, `TG_ALLOW_USER_LANG`, `ENABLE_TG_PUSH_ATTACHMENT` |
| `oauth` | `OAUTH2_SETTINGS` (массив провайдеров, секреты 🔒) |
| `ai` | `ENABLE_AI_EMAIL_EXTRACT`, `AI_EXTRACT_MODEL` |
| `webhook` | `ENABLE_WEBHOOK`, глобальные/admin/user webhook URLs |
| `security` | `CF_TURNSTILE_SITE_KEY`, `CF_TURNSTILE_SECRET_KEY` (🔒), `ENABLE_GLOBAL_TURNSTILE_CHECK`, `PASSWORDS` (🔒), `DISABLE_ADMIN_PASSWORD_CHECK`, `ENABLE_ADDRESS_PASSWORD`, `ENABLE_USER_CREATE_EMAIL`, `DISABLE_ANONYMOUS_USER_CREATE_EMAIL`, `ENABLE_USER_DELETE_EMAIL`, IP blacklist/whitelist/ASN/fingerprint |

#### В `wrangler.toml.template` остаются только
- `[d1_databases]` binding
- `[[kv_namespaces]]` binding (опц.)
- `[[unsafe.bindings]]` ratelimit (опц.)
- `JWT_SECRET = "..."` (обязательно)
- `BOOTSTRAP_ADMIN_PASSWORD = "..."` (для первого входа; после установки 2FA можно удалить)
- Всё остальное удалено из шаблона; есть кнопка в UI "Import from environment" для миграции.

### 3.2 i18n — только EN + RU

#### Frontend (`frontend/packages/shared/src/i18n/`)
- Удалить файлы: `locales/source/{zh,es,ja,de,ptBR}.ts`
- Оставить `en.ts`, добавить `ru.ts` (полный перевод всех ключей)
- `locale-registry.ts` сократить до:
  ```typescript
  export const LOCALE_REGISTRY = [
    { locale: 'en', label: 'English', naive: {locale: enUS, dateLocale: dateEnUS}, turnstileLocale: 'en' },
    { locale: 'ru', label: 'Русский', naive: {locale: ruRU, dateLocale: dateRuRU}, turnstileLocale: 'ru' },
  ]
  ```
- Дефолтная локаль `en`, fallback `en`
- В роутере убрать `:lang/` aliases (теперь либо `/` либо `/ru/`)

#### Worker (`worker/src/i18n/`)
- Удалить `zh.ts`
- Оставить `en.ts`, добавить `ru.ts`
- `index.ts`: `DEFAULT_LANG` = `en`

### 3.3 Темы — Light / Dark / AMOLED + Accent

#### `frontend/packages/shared/src/theme/`
```typescript
export const THEMES = {
  light:  { surface: '#FFFFFF', background: '#FAFAFA', onSurface: '#1C1B1F', ... },
  dark:   { surface: '#1C1B1F', background: '#141218', onSurface: '#E6E1E5', ... },
  amoled: { surface: '#000000', background: '#000000', onSurface: '#FFFFFF', elevated: '#0A0A0A', ... },
}

export const ACCENT_COLORS = {
  indigo: '#3F51B5',  // default
  blue:   '#1976D2',
  green:  '#388E3C',
  orange: '#F57C00',
  red:    '#D32F2F',
  purple: '#7B1FA2',
  teal:   '#00796B',
  pink:   '#C2185B',
}
```

- VueUse `useColorMode({ modes: ['light', 'dark', 'amoled', 'auto'] })` + `accentColor` в `useStorage`
- Vuetify `defaultTheme` динамически меняется через computed
- Темы применяются в `App.vue` каждого пакета (admin/mail/tempmail)

### 3.4 Monorepo миграция

- Перенести `frontend/` → `frontend/packages/admin/` (минимум изменений: переменные путей, `vite.config.js`, `package.json`)
- Создать `frontend/packages/shared/` с экспортом: api client, i18n, theme, общие компоненты, утилиты
- Создать stub-пакеты `frontend/packages/mail/` и `frontend/packages/tempmail/` (минимальный Vue3+Vuetify3 app, login screen + "coming soon")
- `frontend/pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'packages/*'
  ```
- В корне `frontend/package.json` команды:
  ```json
  {
    "scripts": {
      "dev:admin": "pnpm --filter admin dev",
      "dev:mail": "pnpm --filter mail dev",
      "dev:tempmail": "pnpm --filter tempmail dev",
      "build:admin": "pnpm --filter admin build",
      "build:mail": "pnpm --filter mail build",
      "build:tempmail": "pnpm --filter tempmail build",
      "build:all": "pnpm -r build"
    }
  }
  ```

### 3.5 Установка Vuetify 3 в `shared`

- `pnpm add vuetify @mdi/font @fontsource/roboto`
- Vuetify plugin с MD3-styled defaults (`VBtn` rounded='lg', `VCard` rounded='xl', density='comfortable')
- **НЕ** переписывать пока компоненты — Naive UI продолжает жить в `admin/`. Только новые компоненты (например в `mail/` и `tempmail/`) сразу на Vuetify.

### 3.6 Файлы Этапа 1 (оценка)

| Категория | Кол-во файлов |
|-----------|---------------|
| Worker — новые/изменённые | ~25 |
| Frontend — monorepo миграция | ~30 |
| i18n cleanup | ~12 удалить + 2 новых |
| Тема + Vuetify shared | ~10 |
| DB migration + schema | ~2 |
| CHANGELOG + docs | ~4 |
| **Итого** | **~85** |

### 3.7 Acceptance criteria Этапа 1

- [ ] `worker/pnpm build && pnpm lint` без ошибок
- [ ] `frontend/pnpm -r build` все 4 пакета собираются
- [ ] Текущая админка (Naive UI) работает как раньше
- [ ] В новой админке появилась секция "System Settings" с категориями, можно сохранять настройки
- [ ] При удалении env var настройка читается из БД
- [ ] При переключении локали EN ↔ RU все строки переведены
- [ ] Три темы (Light/Dark/AMOLED) переключаются, accent color сохраняется
- [ ] CHANGELOG.md + CHANGELOG_EN.md обновлены
- [ ] Существующие e2e тесты проходят

---

## 4. Этап 2 — Multi-site + UI редизайн (PR #2)

**Цель:** полноценный редизайн UI на Vuetify 3 + MD3 + три отдельных Pages-проекта.

### 4.1 Admin Pages (`admin.domain.com`)

Полный редизайн всех экранов:

**Layout:**
- `v-navigation-drawer` слева (rail или expanded)
- `v-app-bar` сверху с темой/локалью/выход
- `v-main` контент
- FAB для быстрых действий
- Адаптив: на мобиле — `v-bottom-navigation`

**Login screen:**
- Центрированная карточка
- Лого
- Email/username + password
- Turnstile (если включён)
- Кнопка "Login"
- Заготовка под 2FA (раскрывается на Этапе 3)

**Все секции (новые/переписанные):**
| Секция | Компонент | Описание |
|--------|-----------|----------|
| Dashboard | `Dashboard.vue` | Statistics + recent activity (cards с метриками) |
| Mailboxes | `Mailboxes.vue` | Account + CreateAccount объединены |
| Inbox | `Mails.vue` | Все письма с фильтрами |
| Unknown | `MailsUnknow.vue` | Письма для несуществующих адресов |
| Sendbox | `SendBox.vue` | Отправленные |
| Compose | `SendMail.vue` | Отправка письма |
| Users | `Users.vue` | + UserSettings + Role config объединены в табы |
| **Settings** | `Settings.vue` | **НОВОЕ** — единый UI всех настроек (категории табами): General / Domains / TempMail / Email / Telegram / OAuth2 / AI / Webhook / Security |
| Appearance | `Appearance.vue` | Тема + accent + локаль |
| Account & Security | `Account.vue` | Свой пароль + 2FA (заготовка, активируется Этап 3) |
| About | `About.vue` | Версия + ссылки |

### 4.2 Mail Pages (`mail.domain.com`)

Стиль как `notletters.com/email` (см. Image 5):

**Login screen:**
- Лого по центру
- Карточка с заголовком "Log in to mail"
- Email + Password (показ/скрытие)
- Кнопка "Log in"
- Использует существующий endpoint `/api/address_login` (требует `ENABLE_ADDRESS_PASSWORD=true`)

**Layout после входа:**
- Левый sidebar (как notletters):
  - `Main` (inbox)
  - `Change password`
  - `Support` (ссылка на ADMIN_CONTACT из settings)
  - `News channel` (опц. из settings)
  - `Log out`
- Контент: MailBox component из `shared/` (Vuetify)
- Read mail dialog, attachments

**Что НЕТ:**
- Создание адресов
- Регистрация
- Публичные превью
- Tempmail-фичи

### 4.3 Tempmail Pages (`tempmail.domain.com`)

Стиль как `mail.tm` (см. Image 4):

**Landing (неавторизованный):**
- Hero section: "Temp Mail" + описание
- 3 cards: Secure / Instant / Fast
- Кнопки "Create" / "Login"
- Опционально: публичный preview последних писем (если `tempmail.enable_public_preview = true`) — subject + from + timestamp, без content

**Create modal** (см. Image 3):
- Username input + домен dropdown (только из `tempmail.allowed_domains`)
- Password input
- Turnstile (обязателен)
- Кнопка "Create"
- POST `/public_api/v1/accounts`

**Login modal** (см. Image 2):
- Email (full email) + Password
- POST `/public_api/v1/token`

**Inbox (авторизованный):**
- Layout `mail.tm`-style:
  - Sidebar: `Inbox`, `Refresh`, `Delete account` (с confirm)
  - Top bar: email + theme/lang switcher + logout
- MailBox с autorefresh (если включено)
- Read mail / attachments

### 4.4 Worker — multi-site auth flow

#### mail.domain.com → существующий `/api/address_login`
Уже работает, нужно только убедиться что `ENABLE_ADDRESS_PASSWORD=true` и Turnstile валиден.

#### tempmail.domain.com → новый `/public_api/v1/*`

**Anonymous create:**
```http
POST /public_api/v1/accounts
{
  "address": "johndoe@example.com",
  "password": "sha256-hash-from-frontend",
  "captcha_token": "..."
}
```
- Создаёт address с `metadata.is_tempmail = true`, `expires_at = now() + TTL`
- Rate limit: 100/day/IP (или из settings)
- Возвращает `{ id, address, expires_at }`

**Login:**
```http
POST /public_api/v1/token
{
  "address": "johndoe@example.com",
  "password": "sha256-hash"
}
```
Возвращает `{ token, expires_at }`.

**Messages:**
```http
GET    /public_api/v1/me/messages?page=1&limit=20
GET    /public_api/v1/me/messages/:id
DELETE /public_api/v1/me/messages/:id
GET    /public_api/v1/me/messages/:id/source
```

**Account:**
```http
GET    /public_api/v1/me
DELETE /public_api/v1/me
```

**Domains:**
```http
GET /public_api/v1/domains
```
Возвращает только `tempmail.allowed_domains`.

**Public preview** (если включён):
```http
GET /public_api/v1/public/recent_messages?limit=10
```
Возвращает массив без `content`, без `to`, только `from`, `subject`, `timestamp` (рандомные адреса для демонстрации работы сервиса).

#### Host header validation
- `/public_api/*` доступен только с `Host: tempmail.*` (или CORS-разрешённых origin)
- `/api/address_login` доступен только с `Host: mail.*`
- `/admin/*` доступен только с `Host: admin.*` или local dev
- Middleware `checkHostOrigin(c, allowedHosts: string[])`

#### Auto-cleanup tempmail accounts
- Scheduled cron (`worker/src/scheduled.ts`):
  ```sql
  DELETE FROM address
  WHERE json_extract(metadata, '$.is_tempmail') = true
    AND datetime(json_extract(metadata, '$.expires_at')) < datetime('now');
  ```
- Каскадно удаляются связанные `raw_mails`, `address_sender`, и т.д. (или triggers / explicit cleanup)

### 4.5 БД миграция (Этап 2)

```sql
-- 2026-05-XX-multi-site.sql
ALTER TABLE address ADD COLUMN metadata TEXT;  -- JSON {is_tempmail, expires_at, created_via}
CREATE INDEX IF NOT EXISTS idx_address_metadata_tempmail
  ON address(json_extract(metadata, '$.is_tempmail'))
  WHERE json_extract(metadata, '$.is_tempmail') = 1;
```

### 4.6 Документация деплоя

#### `DEPLOY.md` (корень репозитория)
Разделы:
1. **Prerequisites** — CF account, домен, wrangler, pnpm
2. **DNS setup** — A/CNAME записи для 4 поддоменов
3. **Email Routing** — MX, SPF, DKIM, маршрутизация на Worker
4. **Worker deploy** — `worker/wrangler.toml` с custom_domain
5. **Pages deploy × 3** — отдельно admin / mail / tempmail
6. **Initial admin setup** — bootstrap password, создание первого админа, 2FA setup
7. **Settings migration** — кнопка "Import from environment" в админке
8. **Troubleshooting**

#### `vitepress-docs/docs/{en,ru}/guide/multi-site-setup.md`
Расширенная версия с скриншотами, диаграммами архитектуры, примерами `wrangler.toml`.

### 4.7 Файлы Этапа 2 (оценка)

| Категория | Кол-во файлов |
|-----------|---------------|
| Admin redesign (Vuetify) | ~25 |
| Mail Pages (новый пакет) | ~15 |
| Tempmail Pages (новый пакет) | ~20 |
| Worker — public API + auth | ~10 |
| DB migration | ~2 |
| Shared components / MailBox refactor | ~10 |
| Docs (DEPLOY.md + vitepress EN+RU) | ~6 |
| **Итого** | **~88** |

### 4.8 Acceptance criteria Этапа 2

- [ ] 3 Pages-проекта собираются и деплоятся независимо
- [ ] Admin полностью на Vuetify, все экраны работают (CRUD)
- [ ] Mail.domain.com: вход по email/паролю работает, инбокс отображается
- [ ] Tempmail.domain.com: создание/вход/удаление аккаунта работает
- [ ] Auto-cleanup tempmail accounts работает (тест: создать с TTL=1мин, дождаться)
- [ ] DEPLOY.md содержит пошаговую инструкцию
- [ ] Vitepress документация обновлена на EN и RU
- [ ] E2E тесты для каждого Pages-проекта (минимум smoke tests)

---

## 5. Этап 3 — Security + Public API + Polish (PR #3)

**Цель:** включить production-grade безопасность для админки и завершить публичный API для tempmail.

### 5.1 TOTP 2FA для админа

#### Зависимости
- `otpauth` (npm, Workers-compat) или ручная реализация на Web Crypto (RFC 6238 HMAC-SHA1)

#### БД
```sql
CREATE TABLE IF NOT EXISTS admin_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,       -- SHA-256 (как сейчас) или Argon2
    totp_secret TEXT,                  -- base32, зашифровано AES-GCM
    totp_enabled INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_login_at DATETIME,
    last_login_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Bootstrap миграция
При первом логине с env `BOOTSTRAP_ADMIN_PASSWORD` или старым `ADMIN_PASSWORDS[0]`:
- Создать запись в `admin_accounts` с `username='admin'`
- Удалить env var из шаблона
- Показать в UI предупреждение: "Установите 2FA"

#### Endpoints
```http
POST /open_api/admin_login
  body: { username, password, captcha_token }
  resp: { require_totp: true, challenge_token } | { jwt }

POST /open_api/admin_login_totp
  body: { challenge_token, totp_code }
  resp: { jwt }

POST /admin/2fa/setup
  resp: { secret, otpauth_url, qr_svg }

POST /admin/2fa/confirm
  body: { secret, totp_code }
  resp: { enabled: true, recovery_note }

POST /admin/2fa/disable
  body: { totp_code }
  resp: { enabled: false }

POST /admin/account/change_password
  body: { current_password, new_password }
```

#### UI
- Новая страница "Account & Security" в админке:
  - Изменить пароль
  - Setup 2FA: QR код + проверка кодом
  - Disable 2FA (требует код)
- Login screen: после правильного пароля, если 2FA включена → запрос TOTP

### 5.2 Brute-force защита

#### KV-based счётчик
- Ключ: `login_attempts:{type}:{ip}:{username|email}`
- `type`: `admin` | `mail` | `tempmail`
- Инкремент при неудаче, TTL 15мин
- При `count >= max_attempts` (configurable, default 5):
  - Запись `locked_until = now + 15min` в KV
  - Возврат 429 + `Retry-After` header
- Сброс счётчика при успешном входе

#### Middleware
```typescript
// worker/src/auth/brute_force.ts
export const bruteForceGuard = (
  type: 'admin' | 'mail' | 'tempmail'
) => async (c, next) => { ... }
```

Применяется на все login endpoints.

#### Turnstile обязателен
- На admin login — всегда (после первой неудачи или по конфигу)
- На mail login — настраивается админом
- На tempmail create/login — обязательно

### 5.3 Audit log

#### БД
```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,         -- login_success | login_failure | 2fa_setup | settings_change | ...
    target TEXT,                  -- что было затронуто (имя настройки, ID юзера и т.д.)
    ip TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 1,
    details TEXT,                 -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at);
```

#### UI
- Новая секция "Audit Log" в админке с фильтрами (action / date / IP)
- Автоочистка > 90 дней (cron)

### 5.4 Public REST API + Swagger

#### Структура
```
worker/src/public_api/
├── index.ts          ← Hono sub-router, монтирует все public endpoints
├── accounts.ts
├── messages.ts
├── domains.ts
├── public_preview.ts ← публичные превью если включены
├── openapi.ts        ← OpenAPI 3.1 schema (генерится из Hono routes)
└── docs.ts           ← Swagger UI handler
```

#### OpenAPI generation
Используем `@hono/zod-openapi` или `hono-openapi`:
- Каждый endpoint описывается с zod-схемой request/response
- Автогенерация `openapi.json`
- Swagger UI рендерится через CDN (`https://cdn.jsdelivr.net/npm/swagger-ui-dist/`)

#### Endpoint structure
```http
GET    /public_api/v1/domains
GET    /public_api/v1/public/recent_messages
POST   /public_api/v1/accounts
POST   /public_api/v1/token
GET    /public_api/v1/me
DELETE /public_api/v1/me
GET    /public_api/v1/me/messages
GET    /public_api/v1/me/messages/:id
DELETE /public_api/v1/me/messages/:id
GET    /public_api/v1/me/messages/:id/source

GET    /public_api/docs           ← Swagger UI
GET    /public_api/openapi.json   ← OpenAPI schema
```

### 5.5 Лимиты tempmail (дефолты)

| Параметр (settings key) | Default | Описание |
|-------------------------|---------|----------|
| `tempmail.rpm` | 10 | Запросов в минуту на IP |
| `tempmail.rps` | 1 | Запросов в секунду на IP |
| `tempmail.accounts_per_day_per_ip` | 100 | Создание аккаунтов |
| `tempmail.account_ttl_hours` | 24 | TTL аккаунта |
| `tempmail.max_messages_per_account` | 50 | Лимит писем в инбоксе |
| `tempmail.max_attachment_mb` | 1 | Размер attachment |
| `tempmail.max_body_mb` | 1 | Размер тела письма |
| `tempmail.enable_public_preview` | true | Показывать ли публичные превью |
| `tempmail.public_preview_count` | 10 | Сколько превью показывать |
| `tempmail.enable_autorefresh` | true | Autorefresh инбокса |
| `tempmail.autorefresh_interval_sec` | 30 | Интервал |

Всё конфигурится через админку → секция "TempMail Settings".

### 5.6 E2E тесты

Добавить в `e2e/tests/`:
- `admin/auth.spec.ts` — login, 2FA setup, 2FA login, brute force lockout
- `admin/settings.spec.ts` — CRUD всех категорий настроек
- `mail/login.spec.ts` — login по email/password
- `tempmail/full_flow.spec.ts` — create → login → receive (через `seed_mail`) → delete account
- `tempmail/rate_limits.spec.ts` — превышение лимитов → 429
- `public_api/swagger.spec.ts` — Swagger UI рендерится, openapi.json валиден

### 5.7 SMTP proxy server обновление

`smtp_proxy_server/`:
- README обновить: получение address credentials теперь через mail.* UI
- Конфиг указывает на новый `api.domain.com` endpoint
- Возможно — добавить health check endpoint в Python

### 5.8 Файлы Этапа 3 (оценка)

| Категория | Кол-во файлов |
|-----------|---------------|
| Worker auth (2FA, brute force, audit) | ~10 |
| Public API + Swagger | ~10 |
| Admin UI (Account & Security, Audit Log) | ~6 |
| Tempmail UI лимитов | ~3 |
| DB migrations | ~3 |
| E2E тесты | ~10 |
| Docs (vitepress + DEPLOY.md update) | ~6 |
| SMTP proxy update | ~2 |
| **Итого** | **~50** |

### 5.9 Acceptance criteria Этапа 3

- [ ] Admin 2FA: setup + login + disable работают
- [ ] Brute force lockout: 5 неудач → блок 15 мин (тест на 3 разных эндпоинтах)
- [ ] Audit log: видны записи о входах и изменениях настроек
- [ ] Public API: Swagger UI доступен и валиден
- [ ] Public API: все endpoints работают, rate limits срабатывают
- [ ] Tempmail: agressive default лимиты применяются, можно конфигурить
- [ ] Все e2e тесты проходят
- [ ] Документация публичного API на EN+RU
- [ ] SMTP proxy README обновлён
- [ ] CHANGELOG обновлён на обоих языках

---

## 6. Риски и митигации

| Риск | Митигация |
|------|-----------|
| Огромный диф, сложно ревьюить | Поэтапно (3 PR), каждый PR < 5000 LOC |
| Сломаем текущих юзеров | Этап 1 не ломает UI; редизайн только Этап 2; deprecation period |
| 2FA блокирует админа при потере телефона | `BOOTSTRAP_ADMIN_PASSWORD` env-var как recovery (bypass 2FA); admin CLI команда для disable 2FA |
| Tempmail abuse | Все лимиты + IP/ASN blacklist + Turnstile обязателен на create |
| Vuetify bundle size | Tree-shaking (`vite-plugin-vuetify`) + lazy routes + только используемые компоненты |
| Миграция настроек env → DB | Приоритет env > DB на read; кнопка "Import from environment" в UI; postponed deprecation env vars |
| Pages × 3 — лимит free tier (1 проект = 1 deploy/мин) | Деплои разнесены или sequential в CI |
| OpenAPI generation в Workers | Использовать lightweight `@hono/zod-openapi`; pre-generate JSON в build-time если нужно |
| RU перевод качество | Профессиональный перевод вместе с разработчиком на финальном ревью |

---

## 7. Глобальная верификация и пост-релиз

После каждого этапа:
- [ ] `worker/pnpm lint && pnpm build`
- [ ] `frontend/pnpm -r build`
- [ ] `e2e/npm test`
- [ ] Manual smoke test на dev окружении (worker dev + 3 Pages dev)
- [ ] `CHANGELOG.md` + `CHANGELOG_EN.md` обновить (под `(main)` секцию)
- [ ] `vitepress-docs/docs/{en,ru}/` обновить
- [ ] Bump version: 1.9.0 → 2.0.0 (major, breaking changes для мульти-сайта)
- [ ] Release notes с migration guide

После Этапа 3:
- [ ] Финальный релиз v2.0.0 на GitHub
- [ ] Telegram notify (через `cf-temp-mail-release-notify` skill)
- [ ] Обновление README с новыми скриншотами

---

## 8. Что делаем дальше

Этот документ — утверждённый план. Реализация ведётся **поэтапно**:

1. **Сейчас** — план сохранён, кода нет.
2. **Когда заказчик готов** — стартует Этап 1 (отдельный PR / cloud Devin handoff). Эстимейт по объёму: ~85 файлов.
3. После мерджа Этапа 1 — стартует Этап 2 (~88 файлов).
4. После мерджа Этапа 2 — стартует Этап 3 (~50 файлов).

Каждый этап завершается:
- Зелёным CI
- Обновлёнными changelog и docs
- Релизом minor/major версии

---

> 📌 **Изменения в плане** требуют отдельной итерации обсуждения. Любые рефакторинги, выходящие за рамки этого документа, обсуждаются отдельно.
