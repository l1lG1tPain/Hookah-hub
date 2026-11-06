# Hookah Hub

> Полное описание устройства приложения — в [ARCHITECTURE.md](ARCHITECTURE.md).

Каталог кальянных миксов и табаков с оценками сообщества (как IMDb, только для кальяна).

**Стек — всё бесплатно, свой сервер не нужен:**

| Что | Где | Бесплатный лимит |
|---|---|---|
| Фронтенд (Vite, vanilla JS, PWA) | Netlify | 100 ГБ трафика/мес |
| База, авторизация, картинки | Supabase | 500 МБ БД, 50 000 активных пользователей/мес, 1 ГБ файлов |
| Вход через Telegram | 3 Netlify Functions | 125 000 вызовов/мес |

Каталог, избранное и оценки идут **напрямую из браузера в Supabase**. Безопасность обеспечивают RLS и RPC-функции,
которые сами проверяют `auth.uid()`. Netlify-функции остались только для входа через Telegram-бота
(им нужен секретный ключ).

```
браузер ──► Supabase (каталог через представления, личное через RPC hh_*)
   │
   └─► /api/auth-start, /api/auth-wait ──► Supabase Admin  ◄── /api/tg-webhook ◄── Telegram
```

## Запуск локально

```bash
npm install
npm run dev:demo     # демо-данные, база не нужна
npm run dev          # с вашей Supabase (нужен .env, см. .env.example)
npm run netlify:dev  # вместе с функциями входа через Telegram
```

## Первичная настройка (один раз)

### 1. Перевыпустить утёкший ключ ⚠️
В публичной истории git (коммит `8fd4e9d`) лежит `.env` с `SUPABASE_SERVICE_ROLE`.
Supabase → **Project Settings → API Keys** → перевыпустить service_role / secret key →
вписать новое значение в Netlify (**Site configuration → Environment variables**) и в локальный `.env`.

### 2. Миграция базы
Supabase → **SQL Editor** → вставить `supabase/migrations/20261106_supabase_auth.sql` → **Run**.
Скрипт можно запускать повторно. Старые пользователи из Telegram сохраняются и привязываются автоматически
при следующем входе, их оценки и избранное остаются.

### 3. Авторизация в Supabase
**Authentication → URL Configuration**
- Site URL: `https://ваш-сайт.netlify.app`
- Redirect URLs: `https://ваш-сайт.netlify.app/**` и `http://localhost:5173/**`

**Authentication → Sign In / Providers**
- **Email** — включён. Чтобы приходил 6-значный код (а не только ссылка):
  **Authentication → Emails → Magic Link** → добавить в шаблон `Ваш код: {{ .Token }}`.
  Встроенная почта Supabase отправляет всего несколько писем в час — для реальных пользователей подключите
  бесплатный SMTP (например, Resend: 3 000 писем/мес) в **Authentication → Emails → SMTP Settings**.
- **Google** — создайте OAuth Client в Google Cloud Console (тип *Web application*),
  Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
  Client ID и Secret вставьте в провайдер Google в Supabase.

### 4. Telegram-бот
Переменные в Netlify: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
и для фронта `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Вебхук (один раз, подставьте свои значения):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://ваш-сайт.netlify.app/api/tg-webhook&secret_token=<любая-строка>
```
и ту же строку положите в `TG_WEBHOOK_SECRET`.

## Кто пользуется приложением
- **Authentication → Users** в Supabase — все аккаунты, способ входа, дата последнего входа.
- **SQL Editor** — подробнее, со статистикой активности:
  ```sql
  select * from hh_admin.users order by last_seen_at desc nulls last;
  select * from hh_admin.daily_signups;
  ```
  Схема `hh_admin` недоступна из браузера — только из панели Supabase.

## Бесплатный тариф Supabase: на что обратить внимание
Проект на Free засыпает после 7 дней **без запросов к базе**. Пока приложением пользуются — не уснёт.
Если боитесь простоя — подойдёт любой бесплатный пинг раз в пару дней (например, cron-job.org на
`https://<project-ref>.supabase.co/rest/v1/mixes_with_stats?select=id&limit=1` с заголовком `apikey: <anon key>`).

## Структура
```
src/
  main.js            оболочка, роутер, навигация
  components.js      карточки, бейдж рейтинга, сердечко, распределение оценок
  theme.js           тёмная / светлая / авто
  lib/supabase.js    клиент (PKCE, постоянная сессия), демо-режим
  lib/api.js         каталог и RPC
  lib/store.js       пользователь, избранное, оценки, вход (Google / почта / Telegram)
  lib/ui.js          безопасные шаблоны, иконки, тосты, шторки
  pages/             home, top, detail (микс/табак), favorites, profile
  styles/app.css     дизайн-система «Ember Lounge»
netlify/functions/   auth-start, auth-wait, tg-webhook
supabase/migrations/ SQL для базы
```
