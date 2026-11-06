# Hookah Hub — архитектура

> **Для агентов: прочитайте этот файл перед любой задачей.** Он описывает всё приложение,
> чтобы не исследовать код с нуля. После изменений, которые меняют описанное здесь
> (маршруты, таблицы, RPC, env, потоки входа, правила дизайна), **обновите этот файл**
> и синхронизируйте его копию в claude.ai Project «Hookah hub» (doc `claude/ARCHITECTURE.md`).
> Порядок обновления — в разделе [«Как поддерживать этот файл»](#как-поддерживать-этот-файл).

_Последнее обновление: 2026-11-06 (каталог: 17 брендов, 1207 табаков, 78 миксов; починка деплоя на Netlify; загрузка каталога без лимита в 1000 строк)._

---

## 1. Что это

**Hookah Hub** — «IMDb для кальяна»: каталог кальянных **миксов** и **табаков** с оценками сообщества.

Что умеет пользователь:
- смотреть каталог миксов и табаков: поиск, фильтры по вкусу и бренду, сортировка;
- открывать «Топ» со взвешенным рейтингом (как IMDb Top);
- открывать карточку микса: состав с процентами, распределение оценок, автор;
- открывать карточку табака: оценки и «Миксы с этим табаком»;
- ставить оценку по шкале из 5 ступеней и добавлять в избранное (нужен вход);
- **создавать свои миксы**: они подписаны автором, у автора есть своя страница;
- входить через Telegram-бота, Google или код на почту;
- менять имя и тему (тёмная, светлая, авто).

Продакшн: `https://hookahhub.netlify.app`. Репозиторий: `github.com/l1lG1tPain/Hookah-hub` (публичный).
Язык интерфейса: русский. Основная аудитория: мобильные пользователи; приложение ставится как PWA.

---

## 2. Стек и хостинг (всё бесплатно, своего сервера нет)

| Слой | Технология | Где |
|---|---|---|
| Фронтенд | Vanilla JS (ES-модули, без фреймворка), Vite 5, PWA (workbox) | Netlify (static) |
| БД, авторизация, файлы | Supabase (Postgres + Auth + Storage), проект `oounhljncukihkoseufq` | Supabase Free |
| Серверный код | 3 Netlify Functions, только для входа через Telegram | Netlify Functions |
| Шрифты | `@fontsource-variable/unbounded` (заголовки), `@fontsource-variable/manrope` (текст) | в бандле |
| Прочее | `qrcode-generator` (QR для входа через Telegram на десктопе) | в бандле |

**Главный принцип: «почти без бэкенда».** Браузер ходит прямо в Supabase с anon-ключом:
- **каталог** читается через SQL-представления;
- **личные действия** идут через RPC-функции `hh_*` (`SECURITY DEFINER`), которые сами проверяют `auth.uid()`;
- **приватные таблицы** закрыты RLS без политик, поэтому из браузера их не прочитать и не изменить.

Netlify-функции нужны только там, где требуется секрет: service-role ключ и токен бота.

```
Браузер ──(anon key)──► Supabase REST/RPC ──► views: mixes_with_stats, tobaccos_api, mix_ingredients_api
   │                                       └► rpc:  hh_me, hh_rate, hh_toggle_favorite, hh_create_mix, …
   │
   ├─► Supabase Auth (Google OAuth / email OTP, PKCE)
   │
   └─► /api/auth-start, /api/auth-wait ──(service role)──► login_states, users, auth.admin
                                   ▲
Telegram ──► /api/tg-webhook ──────┘  (бот подтверждает вход)
```

---

## 3. Структура репозитория

```
index.html                 оболочка; inline-скрипт ставит тему до загрузки (без мигания)
package.json               скрипты: dev, dev:demo, build (vite + build-sw), netlify:dev
build-sw.mjs               генерирует dist/sw.js (workbox): precache оболочки + кэш картинок
netlify.toml               publish=dist, functions=netlify/functions, /api/* → functions, заголовки кэша,
                           SECRETS_SCAN_OMIT_KEYS для публичных значений Supabase (см. раздел 9)
.env.example               список переменных окружения
README.md                  запуск и первичная настройка (для людей)
ARCHITECTURE.md            этот файл (для агентов и людей)
CLAUDE.md                  короткая инструкция агентам: читать/обновлять ARCHITECTURE.md

public/
  icons/192.png, 512.png   логотип: акула с кальяном (используется и как аватар «Hookah Hub»)
  manifest.webmanifest

src/
  main.js                  точка входа: шрифты, CSS, оболочка (шапка + нижняя навигация), hash-роутер,
                           initAuth, защита медиа (contextmenu/drag), регистрация SW
  theme.js                 getTheme/setTheme/applyTheme; localStorage 'hh-theme' (по умолчанию 'dark')
  components.js            card, rowItem, scoreBadge, favButton, distribution,
                           installFavHandler (глобальные клики по ♥), syncFavButtons
  lib/
    supabase.js            createClient (flowType 'pkce', storageKey 'hh-auth'); флаг DEMO
    api.js                 ВЕСЬ доступ к данным: каталог, RPC, авторы, создание/удаление миксов;
                           нормализация строк БД → объекты фронта; демо-ветки
    store.js               состояние: user, favs (Set 'mix:<id>'), ratings (Map → 1..5); подписки;
                           вход (Google/email/Telegram), выход; оптимистичные toggleFav/setRating
    ui.js                  html`` (автоэкранирование), raw, setHTML, toNode, icon(), brandIcon,
                           SCORES, fmtScore, plural, votesText, cover() (генеративная обложка),
                           toast, sheet (шторка/модалка), avatar() (как в Telegram), shareLink, copyText
    tastes.js              TASTES — единый список вкусовых тегов (фильтры и конструктор)
    demo.js                встроенные демо-данные
  pages/
    home.js                «/»: приветствие, «Микс дня», табы Миксы/Табаки, кнопки 🔍 и ＋,
                           выезжающий поиск, сортировка, чипсы вкусов/брендов, сетка карточек
    top.js                 «/top»: взвешенный рейтинг (Bayesian, m=5), топ-50
    detail.js              «/mix?id=», «/tobacco?id=»: hero, автор, состав, описание,
                           блок оценки, шаринг, удаление своего микса, похожие миксы для табака
    favorites.js           «/favorites»
    profile.js             «/profile»: вход (гость) или профиль: статистика, мои миксы, мои оценки, тема, выход
    create.js              «/create»: конструктор микса + шторка выбора табака
    author.js              «/author?id=»: публичная страница автора и его миксы
  styles/app.css           ВСЯ стилизация (дизайн-токены, компоненты, адаптив)

netlify/functions/
  auth-start.js            POST: создаёт login_states(state), возвращает deep-link на бота
  auth-wait.js             GET ?state=: при status='ok' создаёт/находит auth-пользователя,
                           возвращает одноразовый token_hash (magiclink) → фронт делает verifyOtp
  tg-webhook.js            вебхук бота: /start login_<state> → upsert users по tg_id, аватар в Storage,
                           login_states.status='ok'

supabase/
  migrations/20261106_supabase_auth.sql   Supabase Auth, RPC hh_*, RLS, админ-схема hh_admin
  migrations/20261106_user_mixes.sql      свои миксы, автор, hh_create_mix/hh_delete_mix
  seed/20261106_catalog.sql               каталог: Darkside 35, Black Burn 33, MustHave 38 + 26 миксов
  seed/20261106_catalog_expansion.sql     расширение: +8 брендов, 24 линейки, +1089 табаков, +40 миксов
                                          (применён в прод 2026-11-06; идемпотентный).
                                          ⚠️ В папке пользователя и в git этого файла НЕТ: его применила
                                          другая сессия прямо в базе. Данные в БД есть; файл при
                                          необходимости восстановить выгрузкой из БД.
```

`_old/` — локальный бэкап прежней версии (в `.gitignore`), не используется.

---

## 4. Маршрутизация (hash-роутер в `src/main.js`)

| Hash | Страница | Доступ |
|---|---|---|
| `#/` | HomePage | все |
| `#/top` | TopPage | все |
| `#/favorites` | FavoritesPage | гость видит призыв войти |
| `#/profile` | ProfilePage | гость → экран входа |
| `#/create` | CreatePage | гость → призыв войти |
| `#/author?id=<users.id>` | AuthorPage | все |
| `#/mix?id=<uuid>` | DetailPage('mix') | все; оценка требует входа |
| `#/tobacco?id=<uuid>` | DetailPage('tobacco') | все |

Контракт страницы: `PageFn(containerEl, URLSearchParams) → cleanup?`.
**На каждый переход роутер создаёт новый `<main id="view">`** (`replaceWith`), поэтому обработчики
прошлой страницы не накапливаются. Страница может вернуть функцию очистки, обычно отписку `subscribe(...)`.
На `#/mix` и `#/tobacco` верхняя шапка на мобильных скрыта: у страницы свой hero с кнопками.

---

## 5. Данные (Supabase, схема `public`)

### Таблицы

| Таблица | Ключевые колонки | Примечание |
|---|---|---|
| `users` | `id uuid PK`, `tg_id bigint unique null`, `name text not null`, `avatar_url`, `auth_id uuid unique → auth.users`, `email`, `provider`, `name_changed`, `created_at`, `last_seen_at` | профиль; RLS вкл., политик нет |
| `brands` | `id uuid`, `name unique` | RLS + публичный SELECT. 17 брендов: `DarkSide`, `MustHave`, `Black Burn`, `BURN`, `Element`, `Tangiers`, `Fumari`, `Al Fakher`, `Serbetli`, `Adalya`, `Daily Hookah`, `Spectrum`, `Bonche`, `Satyr`, `Chabacco`, `Afzal`, `Nakhla`. Фронт берёт список брендов отсюда (`listBrands`) |
| `lines` | `id`, `brand_id`, `name`, unique (brand_id,name) | 24 линейки: DarkSide Core/Base/Shake/Xperience, Element Water/Earth/Air, Tangiers Noir, Black Burn HiT, Serbetli Hard Line, Spectrum Classic/Hard Line/Mix/Kitchen, Daily Hookah Formula/Starline, Satyr Aroma/Brilliant/Old School, Chabacco Medium/Emotions/Mix, Nakhla Classic/Mizo. Фронт линейки пока не показывает |
| `tobaccos` | `id uuid`, `brand_id`, `line_id`, `name`, `taste_tags text[]`, `image_url`, `created_at` | RLS + публичный SELECT. **unique (brand_id, name)**. 1207 позиций. Названия английские, как на банках (у Daily Hookah — русские). У Element один вкус выходит в нескольких линейках, поэтому линейка входит в название: `Raspberry (Water)`, `Raspberry (Earth)` |
| `mixes` | `id uuid`, `author_id → users.id`, `title`, `description`, `taste_tags text[]`, `image_url`, `is_published`, `created_at`, `updated_at` | RLS + публичный SELECT; unique (author_id,title) |
| `mix_ingredients` | `mix_id → mixes`, `tobacco_id → tobaccos null`, `custom_title`, `percent numeric`, `pos int` | PK (mix_id,pos), unique (mix_id,tobacco_id). Без tobacco_id используется custom_title («свой табак») |
| `mix_ratings` | `mix_id`, `user_id`, `score score_enum`, `updated_at` | PK (mix_id,user_id); RLS, политик нет |
| `tobacco_ratings` | `tobacco_id`, `user_id`, `score score_enum`, `updated_at` | unique (tobacco_id,user_id); RLS |
| `favorites` | `user_id`, `item_type text ('mix'/'tobacco')`, `item_id uuid`, `created_at` | RLS |
| `login_states` | `state text PK`, `status ('new','ok','consumed','expired')`, `user_id`, `tg_id`, `created_at` | вход через Telegram; TTL 10 мин |
| `sessions` | устаревшая (старые токены x-session) | не используется, закрыта RLS |

`score_enum` = `excellent | good | ok | bad | notgood` ↔ на фронте **5..1**
(`hh_score_int` / `hh_score_label`). Подписи в UI: 💯 Отлично, 🔥 Хорошо, 😎 Пойдёт, 🙂 Так себе, 😐 Не зашло.

**Вкусовые теги** (`taste_tags` у табаков и миксов, совпадают с `TASTES`): `ананасовый, десертный, кислосладкий,
кислый, мятный, напиток, пряный, свежий, сладкий, табачный, травяной, тропический, фруктовый, цветочный,
цитрус, яблочный, ягодный`. Новые табаки размечены по названию и описаниям магазинов (до 3 тегов);
у ~85 позиций с «говорящими» названиями (Satyr Aroma, Tangiers Kosmik и т. п.) теги пустые.

### Представления (читает браузер, `security_invoker = false`, grant anon)
- `mixes_with_stats`: mixes + `votes, excellent..notgood, avg_score` (из `mix_rating_stats`).
- `tobaccos_api`: `id, name, cover_url, tags, brand_name, created_at, votes, excellent..notgood, avg_score`.
- `mix_ingredients_api`: `mix_id, pos, percent, brand, tobacco, custom_title`.
- `mix_rating_stats`, `tobacco_rating_stats`, `mixes_api`: служебные и старые.

**Лимит PostgREST:** один запрос отдаёт максимум 1000 строк. Всё, что может превысить этот объём
(например, полный список табаков), грузится постранично через `.range()` (см. `listAllTobaccos`).

### RPC-функции (`SECURITY DEFINER`, `search_path = public`)

| Функция | Кому | Что делает |
|---|---|---|
| `hh_uid()` | внутр. | `auth.uid()` → `users.id` (создаёт или привязывает профиль), обновляет `last_seen_at`; без входа: ошибка `unauthorized` |
| `hh_link_profile(auth_id)` | внутр. | привязка auth-пользователя к `users`: по `tg_id` из метаданных или создаёт новую строку |
| `hh_me()` | authenticated | профиль + счётчики `favorites, ratings, mixes`, `short` (последние 6 символов id) |
| `hh_update_name(text)` | authenticated | 2–40 символов |
| `hh_my_favorites()` | authenticated | `(item_type, item_id, created_at)` |
| `hh_toggle_favorite(type, id)` | authenticated | возвращает `true`, если добавлено |
| `hh_rate(type, id, 1..5)` | authenticated | upsert оценки микса или табака |
| `hh_my_ratings()` | authenticated | `(item_type, item_id, score 1..5)` |
| `hh_mix_distribution(mix_id)` | anon | `{excellent..notgood}` |
| `hh_author(id)` | anon | `{id, name, avatar_url, created_at, mixes}` — только безопасные поля |
| `hh_authors(uuid[])` | anon | имена и аватары пачкой |
| `hh_create_mix(title, description, tags[], ingredients jsonb)` | authenticated | проверки: название 2–60, 1–6 строк, сумма = 100, % > 0, табак существует, до 10 миксов в сутки. `ingredients: [{tobacco_id, percent} \| {custom_title, percent}]`. Публикует сразу |
| `hh_delete_mix(id)` | authenticated | только свой микс; удаляет состав, оценки и избранное |
| `mix_rating_aggregate(uuid)` | старая | не используется фронтом |

Триггер `hh_on_auth_user_created` на `auth.users` при регистрации вызывает `hh_link_profile`.
Ошибки в нём глушатся, профиль создаётся лениво при первом вызове RPC.

### Админка
Схема `hh_admin` недоступна из API, смотреть через SQL Editor:
- `select * from hh_admin.users order by last_seen_at desc nulls last;`: кто пользуется, способ входа, активность.
- `select * from hh_admin.daily_signups;`
- Supabase → Authentication → Users: все аккаунты и последний вход.

Служебный автор каталога: пользователь с именем **`Hookah Hub`** (бывшие `Seeder`/`Demo`).
В `users` таких строк две (`ea8c18a6-…` и `63fb2801-…`); миксы каталога принадлежат той, у которой их больше
(seed выбирает автора запросом, а не по id). На фронте у него аватар-логотип.

---

## 6. Авторизация

Все способы входа ведут к **обычной сессии Supabase Auth**. Её хранит supabase-js
(`localStorage['hh-auth']`) и обновляет сам. Профиль приложения — строка в `public.users`,
связанная через `users.auth_id`.

| Способ | Поток |
|---|---|
| **Google** | `signInWithOAuth({provider:'google', redirectTo: origin/#/profile})` → PKCE `?code=` → `detectSessionInUrl` → `main.js` чистит URL. Нужен провайдер Google в Supabase (Client ID/Secret из Google Cloud). Callback: `https://oounhljncukihkoseufq.supabase.co/auth/v1/callback` |
| **Почта (код)** | `signInWithOtp({email, shouldCreateUser:true})` → письмо с 6-значным кодом и кнопкой → `verifyOtp({email, token, type:'email'})`. Шаблоны «Magic link» и «Confirm sign up» на русском, с `{{ .Token }}`. Встроенный SMTP Supabase — несколько писем в час; для продакшна нужен свой SMTP (например, Resend) |
| **Telegram** | фронт `POST /api/auth-start` → `{state, httpsLink, tgLink}`; на мобильном открывается бот, на десктопе показывается QR. Пользователь жмёт Start, `tg-webhook` ставит `login_states.status='ok'` и upsert `users` по `tg_id` (имя из приложения не перетирается). Фронт каждые 1,5 с опрашивает `GET /api/auth-wait?state=`. Функция создаёт auth-пользователя `tg<ID>@telegram.hookahhub.app` (`email_confirm`, metadata `tg_id`), вызывает `generateLink('magiclink')` и возвращает `token_hash`. Фронт делает `verifyOtp({token_hash, type:'magiclink'})` |

Supabase → URL Configuration: Site URL `https://hookahhub.netlify.app`;
Redirect URLs: `https://hookahhub.netlify.app/**`, `http://localhost:8888/**`, `http://localhost:5173/**`.

Старые пользователи из Telegram (до миграции) привязываются автоматически по `tg_id` при первом входе.
Их оценки и избранное сохраняются.

---

## 7. Фронтенд: ключевые механики

- **Шаблоны:** только `html\`...\`` из `ui.js`. Подстановки экранируются автоматически.
  Сырой HTML вставляется только через `raw()`. Не используйте `innerHTML` с пользовательскими данными.
- **Состояние:** `store.state` и `subscribe(fn)`. Сердечки синхронизируются глобально (`installFavHandler` + `syncFavButtons`).
  Оценки и избранное меняются оптимистично, при ошибке откатываются.
- **Нормализация** (`api.js`): микс → `{type:'mix', id, name, cover_url, tags, description, votes, avg_score, created_at, author_id, dist}`;
  табак → `{type:'tobacco', id, name, cover_url, brand_name, tags, votes, avg_score, dist}`;
  `dist = {5..1: count}`.
- **Обложки:** если `cover_url`/`image_url` пуст (так у большинства позиций), `cover()` рисует
  градиент с «дымом» и большой первой буквой; цвет зависит от хеша id и названия.
- **Аватары (как в Telegram):** если есть `avatar_url`, показывается фото, иначе градиент из 7 цветов
  по хешу **имени** и инициалы (до 2 букв). Цвет меняется вместе с именем. У `Hookah Hub` — логотип.
- **Оценка:** кнопки идут **слева направо от худшей к лучшей** (😐 → 💯).
  Распределение оценок выводится сверху вниз от лучшей к худшей.
- **Топ:** `WR = v/(v+m)·R + m/(v+m)·C`, `m = 5`, C — средняя по каталогу; берутся 100 позиций по числу голосов.
- **«Микс дня»:** детерминированно по номеру дня из топ-10 миксов с голосами.
- **Поиск на главной:** кнопка 🔍 справа от табов раскрывает панель `.searchbar.open`
  (в закрытом виде `max-height:0; visibility:hidden`). Повторное нажатие закрывает панель и сбрасывает запрос.
  Фильтры главной хранятся в памяти модуля и переживают переходы между страницами.
  Списки на главной ограничены 60 карточками на запрос (сортировка и фильтры работают на сервере).
- **Поделиться:** своё окно `shareLink()`: Telegram (`t.me/share/url`), WhatsApp (`wa.me`),
  «Ссылка», «Текст и ссылка», при наличии ещё системное меню. Копирование через `copyText` с фоллбеком на `execCommand`.
- **Защита контента:** `user-select: none` на body (кроме input/textarea), картинки с `pointer-events:none`,
  `draggable=false`, без контекстного меню.
- **Конструктор микса:** 1–6 строк, проценты кнопками ±5 или вручную, «Поровну», полоска состава,
  до 4 вкусов из `TASTES`. Выбор табака — шторка с поиском по `listAllTobaccos()` или «свой табак» (custom_title).
  `listAllTobaccos()` грузит все 1207+ табаков **постранично по 1000** и кэширует в модуле;
  в шторке без запроса показываются первые 80, поиск идёт по всему списку.
- **Демо-режим:** `npm run dev:demo` или отсутствие `VITE_SUPABASE_*`. Данные из `demo.js`,
  вход мгновенный, своё хранится в `localStorage` (`hh-demo-*`). Сверху показывается баннер.

---

## 8. Дизайн-система «Ember Lounge» (`src/styles/app.css`)

- Тёплый угольный фон и акцент цвета тлеющего угля; поверхности матовые, **без стекла и blur** — это требование заказчика.
- Токены: `--bg, --bg-2, --surface, --surface-2, --surface-3, --line, --line-2, --text, --text-2, --muted, --accent (#ff7a3d), --accent-2 (#ffb547), --accent-soft`;
  цвета состава `--c1..--c6`; радиусы `--r-sm/--r/--r-lg/--r-xl`; `--ease`.
- Темы: `html[data-theme=dark|light]`. По умолчанию тёмная.
- Шрифты: заголовки `Unbounded` (`.display`, `.h2`, названия карточек, цифры рейтинга), текст `Manrope`.
- Адаптив: до 559px карточки в 2 колонки; от 860px верхняя навигация, нижний таббар скрыт,
  у детальной страницы сайдбар со sticky-оценкой.
- Компоненты: `.card`, `.row`, `.seg`, `.pills`, `.chip`, `.tool-btn`, `.btn(--accent|--tg|--light|--ghost|--danger)`,
  `.panel`, `.sheet`, `.toast`, `.avatar(--xs|--sm|--xl)`, `.empty`, `.skel`.

---

## 9. Окружение, запуск и деплой

| Переменная | Где | Зачем |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | фронт (бандл) | клиент Supabase |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` | Netlify Functions | admin-доступ (вход через Telegram). **Секрет** |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (`hookah_akulka_bot`) | Netlify Functions | бот |
| `TG_WEBHOOK_SECRET` | Netlify Functions | необязательно; проверка `x-telegram-bot-api-secret-token` |

```bash
npm install
npm run dev:demo      # без базы
npm run dev           # Vite :5173, Supabase из .env (Telegram-вход не работает: нет функций)
npm run netlify:dev   # :8888 — фронт + функции (полный локальный стенд)
npm run build         # dist/ + sw.js
```

**Деплой:** push в `main` на GitHub → Netlify собирает `npm run build` и публикует `dist/` и функции.
Статус и логи — Netlify → hookahhub → Deploys.

**Сканер секретов Netlify.** Netlify ищет значения env-переменных в готовой сборке. URL и anon-ключ Supabase
публичны и обязаны быть в бандле, поэтому они исключены через `SECRETS_SCAN_OMIT_KEYS` в `netlify.toml`.
Без этого деплой падает с «Secrets scanning found secrets in build» (так упал первый деплой коммита `fc97899`).
**Никогда не добавляйте в это исключение `SUPABASE_SERVICE_ROLE` или `TELEGRAM_BOT_TOKEN`**: если сканер
нашёл их в `dist`, это настоящая утечка.

---

## 10. Работа с базой (важно для агентов)

- Схему меняем **только SQL-файлами** в `supabase/migrations/` (идемпотентно: `if not exists`,
  `create or replace`, DO-блоки с проверками). Файл добавляется в репозиторий и применяется в Supabase SQL Editor.
- Перед изменениями **сначала прочитайте реальную схему** read-only запросом (`pg_class`/`pg_attribute`/`pg_proc`).
- Если среда агента не достаёт до Supabase (allowlist), проверяйте SQL на локальном Postgres с мок-схемой
  по разделу 5 (роли `anon`/`authenticated`, схема `auth` с `auth.users` и `auth.uid()`). Прогоняйте миграцию
  дважды, чтобы проверить идемпотентность.
- В SQL Editor Supabase:
  - на `drop`/`delete` (даже внутри тела функции) и на создание таблиц без RLS (включая temp)
    появляется окно «Potential issue detected». **Его подтверждает пользователь сам**,
    агентам подтверждать изменения в рабочей базе нельзя.
  - Temp-таблицы с `on commit drop` работают, но после них редактор пишет ошибку `relation "_t" does not exist`
    на служебном шаге, при этом данные записываются. Всегда проверяйте результат отдельным SELECT.
    Лучше избегать temp-таблиц и использовать `VALUES`/CTE.
  - Результаты в гриде виртуализированы (видно ~13 строк): агрегируйте вывод в одну строку (`string_agg`/`json_agg`).
  - Агент в браузере: вставлять SQL через `monaco.editor.getEditors()[0].setValue(sql)` (не через `getModels()[0]` —
    редактор может откатить текст к сохранённому сниппету), затем кнопка Run; результат читать из
    `[role="gridcell"]`. Большой SQL передавать gzip+base64 и распаковывать `DecompressionStream`, сверяя контрольную сумму.
- Новые таблицы с данными пользователей: включайте RLS и давайте доступ только через `hh_*` RPC с `hh_uid()`.
- Новые представления для каталога: `security_invoker = false` + `grant select … to anon, authenticated`.

---

## 11. Безопасность и известные проблемы

- ⚠️ `SUPABASE_SERVICE_ROLE` утёк в публичную историю git (коммит `8fd4e9d`) и **ещё не перевыпущен** на 2026-11-06.
  Нужно перевыпустить в Supabase → API Keys и обновить в Netlify и `.env`.
- Закрыто: старые функции принимали `x-tg-id` (можно было действовать от имени любого пользователя);
  `users`/`sessions` раньше читались anon-ключом. Теперь RLS.
- **Состояние git и деплоя (2026-11-06):** новая версия запушена коммитом `fc97899`, но его деплой упал
  на сканере секретов. Исправление (`SECRETS_SCAN_OMIT_KEYS` в `netlify.toml`) и пагинация каталога лежат
  в рабочей копии пользователя и **ждут коммита и push**. До этого прод работает на старой версии
  (старый UI и старые функции, включая дыру с `x-tg-id`).
- Микс «Citrus Punch» в базе встречается дважды (дубль был до миграций). Удалять по решению владельца.
- Есть пользовательский микс с оскорбительным названием (автор с именем «.»). Модерации нет; удалять по решению владельца.
- Бренд «Everest» запрошен заказчиком, но такой кальянный табак не нашёлся. Ждём уточнения.
- Google-вход: в Supabase провайдер ещё **не включён** (нет Client ID/Secret).
- Supabase Free засыпает после 7 дней без запросов.
- У большинства табаков и миксов нет фото (`image_url` пуст), используются генеративные обложки.
- Файлы `.idea/*` и `netlify/functions/auth-start.js` в рабочей копии отличаются от git только переводами строк
  (CRLF/LF); коммитить их не нужно.
- Запись файлов агентом в папку пользователя (`device_commit_files`) может подставить **старую версию**,
  если тот же `stagedPath` уже использовался раньше. Для каждой записи берите **новый промежуточный путь**
  (например, `/mnt/user-data/outputs/<задача>-vN/…`) и **после записи сверяйте md5** с проверенной версией.

---

## 12. Чеклист типовых задач

- **Новая страница:** `src/pages/<name>.js` (`export function XPage(el, params)`), маршрут в `routes` в `main.js`,
  при необходимости пункт в `NAV`, стили в `app.css`, этот файл (раздел 4).
- **Новое поле в карточке:** колонка или представление в БД (миграция) → нормализация в `api.js` → `components.js`/страница.
- **Новое личное действие:** RPC `hh_*` в новой миграции (`hh_uid()`, revoke anon, grant authenticated) →
  функция в `api.js` (+ демо-ветка) → при необходимости `store.js`.
- **Новый вкусовой тег:** `src/lib/tastes.js`.
- **Пополнение каталога:** seed-SQL в `supabase/seed/` по образцу `20261106_catalog_expansion.sql`:
  `insert … select from (values …)` + `where not exists` по brand + нормализованному имени
  (`regexp_replace(lower(name),'[^a-zа-яё0-9]','','g')`), `on conflict do nothing`, без DELETE/DROP/temp.
  Названия вкусов брать из реальных источников (каталоги магазинов), не выдумывать; бренды писать как в `brands`.
  **Файл seed обязательно сохраняйте в репозиторий**, а не только применяйте в базе.
- **Большие выборки:** всё, что может превысить 1000 строк, грузите постранично (`.range()`).
- **Проверка UI:** `npx vite build --mode demo && npx vite preview --mode demo` и скриншоты 390×844 и 1440×900.

---

## Как поддерживать этот файл

1. Изменили маршруты, таблицы, RPC, env, потоки входа или правила дизайна → правьте соответствующий раздел здесь.
2. Обновите дату в шапке.
3. Синхронизируйте с claude.ai Project «Hookah hub»: `Projects.project_write(path: "claude/ARCHITECTURE.md", local_path: <файл>)` — именно этот путь, чтобы заменить документ, а не создать новый.
   **Перед записью сделайте `project_read`**: документ могла обновить другая сессия; объединяйте правки, а не затирайте их.
   Пишите только при реальных изменениях: каждая запись сбрасывает кэш промптов проекта.
4. Держите копию в репозитории (`ARCHITECTURE.md`) и в проекте одинаковыми.
5. Мелкие правки (текст, стили одного компонента) этот файл не требуют.
