# Hookah Hub — архитектура

> **Для агентов: прочитайте этот файл перед любой задачей.** Он описывает всё приложение,
> чтобы не исследовать код с нуля. После изменений, которые меняют описанное здесь
> (маршруты, таблицы, RPC, env, потоки входа, правила дизайна), **обновите этот файл**
> и синхронизируйте его копию в claude.ai Project «Hookah hub» (doc `claude/ARCHITECTURE.md`).
> Порядок обновления — в разделе [«Как поддерживать этот файл»](#как-поддерживать-этот-файл).

_Последнее обновление: 2026-11-07 (личная страница `/u/<ник>` и стильный QR; ранее: ключ перевыпущен, пуши настроены; ранее: пуши, загрузка фото, свои табаки и бренды, новый подсчёт оценок, ссылки /m/ и /t/ с превью, «Забить», сравнение, подборки; ранее: Google-вход, PWA-установка, лоадер)._

---

## 1. Что это

**Hookah Hub** — «IMDb для кальяна»: каталог кальянных **миксов** и **табаков** с оценками сообщества.

Что умеет пользователь:
- смотреть каталог миксов и табаков: поиск, фильтры по вкусу и бренду, сортировка;
- открывать «Топ» со взвешенным рейтингом (как IMDb Top);
- открывать карточку микса: состав с процентами, распределение оценок, автор;
- открывать карточку табака: бренд · линейка, описание, оценки и «Миксы с этим табаком»;
- ставить оценку по шкале из 5 ступеней и добавлять в избранное (нужен вход);
- **создавать свои миксы**: они подписаны автором, у автора есть своя страница;
- входить через Telegram-бота, Google или код на почту;
- менять имя и тему (тёмная, светлая, авто);
- **установить приложение**: на Android/desktop кнопка «Установить» (нативный диалог), на iOS подсказка «Поделиться → На экран Домой»; карточка видна в профиле и (с крестиком на 7 дней) на главной, пока приложение не установлено;
- делиться миксом/табаком: Telegram, WhatsApp, ссылка, текст, **картинка-карточка** (canvas, с QR);
- **добавлять свои табаки и бренды** (шторка «Добавить табак»: бренд из списка или новый) и **загружать фото** к своим миксам и табакам (сжатие на устройстве до ≤200 КБ);
- включать **пуш-уведомления** (оценки моих миксов, «Микс дня», новинки каталога);
- нажать **«Забить»** на миксе: граммовка по размеру чаши и таймеры (угли, прогрев, сессия);
- **сравнить два микса** (`#/compare`); на главной горизонтальные **подборки**.

Продакшн: `https://hookahhub.netlify.app`. Репозиторий: `github.com/l1lG1tPain/Hookah-hub` (публичный).
Язык интерфейса: русский. Основная аудитория: мобильные пользователи; приложение ставится как PWA.

---

## 2. Стек и хостинг (всё бесплатно, своего сервера нет)

| Слой | Технология | Где |
|---|---|---|
| Фронтенд | Vanilla JS (ES-модули, без фреймворка), Vite 5, PWA (workbox) | Netlify (static) |
| БД, авторизация, файлы | Supabase (Postgres + Auth + Storage), проект `oounhljncukihkoseufq` | Supabase Free |
| Серверный код | Netlify Functions: вход через Telegram (3), share-превью `/m/` `/t/`, 3 расписанные рассылки пушей | Netlify Functions |
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
  push-sw.js               обработчик push/notificationclick; подключён в sw.js через importScripts
  og.png                   1200×630, превью сайта для мессенджеров
  privacy.html, terms.html страницы для Google OAuth (Branding)
  icons/192.png, 512.png   логотип: акула с кальяном (используется и как аватар «Hookah Hub»)
  icons/shark.webp         акула в худи (прозрачный фон): лоадер, карточка установки, картинка шаринга
  manifest.webmanifest

src/
  main.js                  точка входа: шрифты, CSS, оболочка (шапка + нижняя навигация), hash-роутер,
                           initAuth, защита медиа (contextmenu/drag), регистрация SW
  splash.js                лоадер: ротация фраз, минимум 1,6 с, скрывается после initAuth
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
    pwa.js                 установка PWA: beforeinstallprompt, iOS-инструкция, installCard/bindInstall,
                           dismiss в localStorage 'hh-pwa-dismiss' (7 дней)
    phrases.js             LOADING (15 фраз лоадера) и makeGreeting() — приветствия по времени суток, {n} = имя
    sharecard.js           makeShareCard(): PNG 1080×1440 через canvas (подгружается лениво), makeProfileCard() — визитка автора
    qr.js                  drawQr()/makeQrCanvas(): стильный QR (круглые точки, глаза цвета углей, логотип, ECC H)
    profileShare.js        шторка «QR и ссылка» личной страницы (превью визитки, поделиться, скачать)
    rating.js              MIN_VOTES=3, hasRating, rankItems/sortTop: взвешенный рейтинг (см. «Оценки»)
    photo.js               compressImage (canvas → WebP/JPEG ≤1024px, ≤200 КБ), photoField/bindPhoto
    tobaccoForm.js         openTobaccoSheet(): бренд + табак + фото; createBrand → createTobacco → attachImage
    push.js                Web Push на клиенте: pushMode/pushState/enablePush/disablePush/setPrefs
    cook.js                openCook(mix): граммовка и таймеры «Забить» (Wake Lock)
    tastes.js              TASTES — единый список вкусовых тегов (фильтры и конструктор)
    demo.js                встроенные демо-данные
  pages/
    home.js                «/»: приветствие, «Микс дня», табы Миксы/Табаки, кнопки 🔍 и ＋,
                           выезжающий поиск, сортировка, чипсы вкусов/брендов, сетка карточек
    top.js                 «/top»: взвешенный рейтинг (Bayesian, m=5), топ-50
    detail.js              «/mix?id=», «/tobacco?id=»: hero (у табака: «Табак · Бренд · Линейка»), автор,
                           состав, описание (у миксов и табаков), блок оценки, шаринг,
                           удаление своего микса, похожие миксы для табака
    favorites.js           «/favorites»
    profile.js             «/profile»: вход (гость) или профиль: статистика, мои миксы, мои оценки, тема, выход
    create.js              «/create»: конструктор микса + шторка выбора табака
    compare.js             «/compare?a=&b=»: два микса рядом; pickMix() — шторка выбора
    author.js              «/author?id=» или «?h=<ник>»: публичная страница автора, его миксы, кнопка «QR и ссылка»
  styles/app.css           ВСЯ стилизация (дизайн-токены, компоненты, адаптив)

netlify/functions/
  share.js                 /m/<id>, /t/<id>, /u/<ник> (редиректы в netlify.toml): HTML с Open Graph для превью в мессенджерах
                           + мгновенный переход на `/#/mix?id=…` / `/#/tobacco?id=…`; данные берёт REST-запросом с anon-ключом
  push-ratings.js          расписание */15 мин: авторам «ваш микс оценили»
  push-daily.js            расписание 0 14 * * * (19:00 Ташкент): «Микс дня»
  push-news.js             расписание 0 15 * * 5: «Новое в каталоге», если за неделю добавились табаки
  _lib/push.js             init() (VAPID + service role), send() (удаляет подписки с 404/410)
  auth-start.js            POST: создаёт login_states(state), возвращает deep-link на бота
  auth-wait.js             GET ?state=: при status='ok' создаёт/находит auth-пользователя,
                           возвращает одноразовый token_hash (magiclink) → фронт делает verifyOtp
  tg-webhook.js            вебхук бота: /start login_<state> → upsert users по tg_id, аватар в Storage,
                           login_states.status='ok'

supabase/
  migrations/20261106_supabase_auth.sql   Supabase Auth, RPC hh_*, RLS, админ-схема hh_admin
  migrations/20261106_user_mixes.sql      свои миксы, автор, hh_create_mix/hh_delete_mix
  migrations/20261108_push_uploads_tobaccos.sql  push_subscriptions + hh_push_*, корзина Storage `user-images`
                                          (300 КБ, webp/jpeg/png, ≤40 файлов на пользователя), hh_set_image,
                                          hh_create_brand, hh_create_tobacco, hh_delete_tobacco, brands/tobaccos.created_by.
                                          Применить в SQL Editor (потребует подтвердить окно из-за DELETE внутри функции)
  seed/20261106_catalog.sql               каталог: Darkside 35, Black Burn 33, MustHave 38 + 26 миксов
  seed/20261106_catalog_expansion.sql     расширение: +8 брендов, 24 линейки, +1089 табаков, +40 миксов
                                          (применён в прод 2026-11-06; идемпотентный).
                                          ⚠️ В папке пользователя и в git этого файла НЕТ: его применила
                                          другая сессия прямо в базе. Данные в БД есть; файл передан
                                          пользователю в чате — положить в репозиторий.
  seed/20261107_tobacco_descriptions.sql  колонка tobaccos.description + описания у всех табаков,
                                          tobaccos_api (+description, line_name), DarkSide Sabotage/Shot,
                                          +84 табака (применён в прод 2026-11-07; идемпотентный).
                                          ⚠️ Тоже пока только в чате — положить в репозиторий.
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
| `#/author?id=<users.id>` или `#/author?h=<ник>` | AuthorPage | все (публичная ссылка `/u/<ник>` → share.js → `?h=`) |
| `#/venue?s=<slug>` | VenuePage | все (публичная ссылка `/v/<slug>` → share.js → `?s=`; управление в профиле, `src/lib/venueManage.js`) |
| `#/compare?a=<mix>&b=<mix>` | ComparePage | все |
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
| `users` | `id uuid PK`, `tg_id bigint unique null`, `name text not null`, `avatar_url`, `handle text` (уникальный по lower), `bio text`, `auth_id uuid unique → auth.users`, `email`, `provider`, `name_changed`, `created_at`, `last_seen_at` | профиль; RLS вкл., политик нет |
| `brands` | `id uuid`, `name unique` | RLS + публичный SELECT. 17 брендов: `DarkSide`, `MustHave`, `Black Burn`, `BURN`, `Element`, `Tangiers`, `Fumari`, `Al Fakher`, `Serbetli`, `Adalya`, `Daily Hookah`, `Spectrum`, `Bonche`, `Satyr`, `Chabacco`, `Afzal`, `Nakhla`. Фронт берёт список брендов отсюда (`listBrands`) |
| `lines` | `id`, `brand_id`, `name`, unique (brand_id,name) | 27 линеек: DarkSide Core/Base/Shake/Xperience/Sabotage/Shot, Element Water/Earth/Air, Tangiers Noir, Black Burn HiT, Serbetli Hard Line, Spectrum Classic/Hard Line/Mix/Kitchen, Daily Hookah Formula/Starline, Satyr Aroma/Brilliant/Old School, Chabacco Medium/Emotions/Mix, Nakhla Classic/Mizo. У DarkSide линейка проставлена всем 187 позициям (Core 78, Shot 33, Xperience 30, Sabotage 22, Shake 16, Base 8). Фронт показывает линейку на странице табака (в eyebrow «Табак · Бренд · Линейка»); фильтра по линейкам нет |
| `tobaccos` | `id uuid`, `brand_id`, `line_id`, `name`, `taste_tags text[]`, `image_url`, `description text`, `created_at` | RLS + публичный SELECT. **unique (brand_id, name)**. 1291 позиция. Названия английские, как на банках (у Daily Hookah и DarkSide Shot — русские). У Element один вкус выходит в нескольких линейках, поэтому линейка входит в название: `Raspberry (Water)`, `Raspberry (Earth)`. `description` заполнен у всех: «Вкус: <ноты>. <характер линейки/бренда>»; у ~204 вкусов с неизвестным составом — «Авторский вкус бренда. …» |
| `mixes` | `id uuid`, `author_id → users.id`, `title`, `description`, `taste_tags text[]`, `image_url`, `is_published`, `created_at`, `updated_at` | RLS + публичный SELECT; unique (author_id,title) |
| `mix_ingredients` | `mix_id → mixes`, `tobacco_id → tobaccos null`, `custom_title`, `percent numeric`, `pos int` | PK (mix_id,pos), unique (mix_id,tobacco_id). Без tobacco_id используется custom_title («свой табак») |
| `mix_ratings` | `mix_id`, `user_id`, `score score_enum`, `updated_at` | PK (mix_id,user_id); RLS, политик нет |
| `tobacco_ratings` | `tobacco_id`, `user_id`, `score score_enum`, `updated_at` | unique (tobacco_id,user_id); RLS |
| `favorites` | `user_id`, `item_type text ('mix'/'tobacco')`, `item_id uuid`, `created_at` | RLS |
| `login_states` | `state text PK`, `status ('new','ok','consumed','expired')`, `user_id`, `tg_id`, `created_at` | вход через Telegram; TTL 10 мин |
| `push_subscriptions` | `user_id`, `endpoint` unique, `p256dh`, `auth`, `notify_ratings/daily/news`, `last_rating_check`, `user_agent` | RLS без политик; доступ через `hh_push_*` и service role в функциях |
| `venues` | `id`, `slug` (уникальный по lower), `name`, `logo_url`, `description`, `city`, `owner_id → users`, `verified`, `verified_at`, `archived_at`, `created_at`, `updated_at` | заведения (миграция `20261111_venues.sql`); RLS без политик; удаление мягкое (`archived_at`). `verified` ставит админ в SQL Editor: `update public.venues set verified = true, verified_at = now() where lower(slug) = '…'` |
| `venue_members` | PK (`venue_id`, `user_id`), `role owner/staff`, `added_by`, `removed_at` | команда; сейчас пишется только `staff` (UI для staff нет, RPC есть) |
| `venue_mixes` | PK (`venue_id`, `mix_id`), `pos`, `note`, `added_by`, `removed_at` | меню; `mix_id` с `on delete cascade` (иначе `hh_delete_mix` падает) |
| `sessions` | устаревшая (старые токены x-session) | не используется, закрыта RLS |

`score_enum` = `excellent | good | ok | bad | notgood` ↔ на фронте **5..1**
(`hh_score_int` / `hh_score_label`). Подписи в UI: 💯 Отлично, 🔥 Хорошо, 😎 Пойдёт, 🙂 Так себе, 😐 Не зашло.

**Вкусовые теги** (`taste_tags` у табаков и миксов, совпадают с `TASTES`): `ананасовый, десертный, кислосладкий,
кислый, мятный, напиток, пряный, свежий, сладкий, табачный, травяной, тропический, фруктовый, цветочный,
цитрус, яблочный, ягодный`. Табаки размечены по названию и описаниям магазинов (до 3 тегов);
пустые теги остались только у вкусов с неизвестным составом.

### Представления (читает браузер, `security_invoker = false`, grant anon)
- `mixes_with_stats`: mixes + `votes, excellent..notgood, avg_score` (из `mix_rating_stats`).
- `tobaccos_api`: `id, name, cover_url, tags, brand_name, created_at, votes, excellent..notgood, avg_score, description, line_name`.
  `description` и `line_name` добавлены 2026-11-07; фронт читает их через `select('*')` и выводит с коммита `0c3ce5d`
  (нормализация в `api.js`, eyebrow и блок «Описание» в `detail.js`).
- `mix_ingredients_api`: `mix_id, pos, percent, brand, tobacco, custom_title`.
- `mix_rating_stats`, `tobacco_rating_stats`, `mixes_api`: служебные и старые.
- `venues_api`: `id, slug, name, logo_url, city, verified, mixes_count` — незаархивированные заведения.

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
| `hh_author(id)` | anon | `{id, name, handle, bio, avatar_url, created_at, mixes}` — только безопасные поля |
| `hh_author_by_handle(handle)` | anon | то же по нику (для `/u/<ник>`) |
| `hh_set_profile(handle, bio)` | auth | ник 3–20 `[a-z0-9_]`, зарезервированные слова запрещены, занят → ошибка; bio ≤160 |
| `hh_authors(uuid[])` | anon | имена и аватары пачкой |
| `hh_create_mix(title, description, tags[], ingredients jsonb)` | authenticated | проверки: название 2–60, 1–6 строк, сумма = 100, % > 0, табак существует, до 10 миксов в сутки. `ingredients: [{tobacco_id, percent} \| {custom_title, percent}]`. Публикует сразу |
| `hh_delete_mix(id)` | authenticated | только свой микс; удаляет состав, оценки и избранное |
| `hh_create_brand(name)` | authenticated | 2–40 символов; дубль (без регистра/знаков) возвращает существующий; до 5 новых в сутки |
| `hh_create_tobacco(brand_id, name, line, tags[], description)` | authenticated | 2–60 символов; дубль в бренде возвращает существующий; линейка создаётся при необходимости; до 20 в сутки; `created_by` = автор |
| `hh_delete_tobacco(id)` | authenticated | только свой и пока нет ингредиентов/оценок |
| `hh_set_image(type, id, url)` | authenticated | `url` обязан быть из `user-images/<auth.uid()>/…`; микс — автор, табак — `created_by` |
| `hh_push_subscribe/status/prefs/unsubscribe` | authenticated | подписки Web Push текущего устройства и их настройки |
| `hh_venue_create(slug, name, city, description)` | authenticated | адрес 3–30 `[a-z0-9_-]` (без `-`/`_` по краям), зарезервированные запрещены; до 3 активных заведений и 1 создание в сутки |
| `hh_venue_update(id, slug, name, city, description)` | owner | смена адреса/названия снимает `verified` |
| `hh_venue_set_logo(id, url)` | owner/staff | `url` только из `user-images/<auth.uid()>/…` |
| `hh_venue_archive(id, archived)` | owner | мягкое удаление |
| `hh_venue_add_mix / remove_mix / reorder / set_note` | owner/staff | меню до 100 миксов, заметка ≤140; remove = `removed_at` |
| `hh_venue_add_staff(venue, handle)` / `hh_venue_remove_staff(venue, user)` | owner | до 10 сотрудников |
| `hh_my_venues()` | authenticated | заведения, где я owner или staff, с `role` и числом миксов |
| `hh_venue_by_slug(slug)` | anon | публичная страница: поля заведения + `mixes[]` со статистикой оценок (без `owner_id`) |
| `hh_venue_role`, `hh_venue_check` | внутр. | execute отозван у всех ролей |
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
  табак → `{type:'tobacco', id, name, cover_url, brand_name, line_name, description, tags, votes, avg_score, dist}`;
  `dist = {5..1: count}`.
- **Обложки:** если `cover_url`/`image_url` пуст (так у большинства позиций), `cover()` рисует
  градиент с «дымом» и большой первой буквой; цвет зависит от хеша id и названия.
- **Аватары (как в Telegram):** если есть `avatar_url`, показывается фото, иначе градиент из 7 цветов
  по хешу **имени** и инициалы (до 2 букв). Цвет меняется вместе с именем. У `Hookah Hub` — логотип.
- **Оценка:** кнопки идут **слева направо от худшей к лучшей** (😐 → 💯).
  Распределение оценок выводится сверху вниз от лучшей к худшей.
- **Оценки (`lib/rating.js`, как у IMDb):** средняя показывается только при `votes ≥ 3` (`MIN_VOTES`), иначе бейдж «new» и подсказка «нужно ещё N». Топ и сортировка «Лучшие» используют `WR = v/(v+m)·R + m/(v+m)·C`, `m = 5`, C — средняя по загруженной выборке; для «Лучших» берётся 300 строк по сырой средней и переупорядочивается на клиенте. Позиции с <3 голосами в Топ не попадают.
- **«Микс дня»:** детерминированно по номеру дня из топ-10 миксов с голосами.
- **Поиск на главной:** кнопка 🔍 справа от табов раскрывает панель `.searchbar.open`
  (в закрытом виде `max-height:0; visibility:hidden`). Повторное нажатие закрывает панель и сбрасывает запрос.
  Фильтры главной хранятся в памяти модуля и переживают переходы между страницами.
  Списки на главной ограничены 60 карточками на запрос (сортировка и фильтры работают на сервере).
- **Поделиться:** `shareLink()`: превью, Telegram, WhatsApp, «Картинкой», ссылка, текст, системное меню. Ссылки делятся
  как `shareUrl(type,id)` = `/m/<id>` или `/t/<id>` (функция `share.js` отдаёт OG-превью и редиректит в хэш-маршрут): так превью
  работает в мессенджерах, а ссылка не зависит от `#`. Картинка (`sharecard.js`) содержит QR на эту же ссылку: в самой картинке ссылки
  кликабельными быть не могут, поэтому к ней же передаётся текст со ссылкой. Копирование через `copyText` с фоллбеком на `execCommand`.
- **Ссылки в PWA:** в манифесте `handle_links: preferred` и `launch_handler: navigate-existing`; на Android установленный PWA
  перехватывает ссылки своего домена, на iOS Apple этого не позволяет (ссылки открываются в Safari).
- **Фото:** `compressImage` ужимает на устройстве (макс. сторона 1024 px, ≤200 КБ, WebP, на Safari без WebP — JPEG), грузит в
  `user-images/<auth.uid()>/<uuid>.webp`, затем `hh_set_image`. Лимиты дублируются на уровне корзины (300 КБ, mime) и политик.
- **Пуши:** `push.js` подписывает по нажатию кнопки в профиле (на iOS только из установленного PWA). Рассылают три расписанные
  Netlify-функции; нужны env `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **Подборки на главной:** 4 горизонтальные ленты (лучшие, новые, сладкие для новичков, кислые), скрыты при поиске/фильтрах/вкладке «Табаки».
- **Защита контента:** `user-select: none` на body (кроме input/textarea), картинки с `pointer-events:none`,
  `draggable=false`, без контекстного меню.
- **Конструктор микса:** 1–6 строк, проценты кнопками ±5 или вручную, «Поровну», полоска состава,
  до 4 вкусов из `TASTES`. Выбор табака — шторка с поиском по `listAllTobaccos()` или «свой табак» (custom_title).
  `listAllTobaccos()` грузит все 1291 табак **постранично по 1000** и кэширует в модуле;
  в шторке без запроса показываются первые 80, поиск идёт по всему списку.
- **Демо-режим:** `npm run dev:demo` или отсутствие `VITE_SUPABASE_*`. Данные из `demo.js`,
  вход мгновенный, своё хранится в `localStorage` (`hh-demo-*`). Сверху показывается баннер.
  У демо-табаков нет `description` и `line_name`: блок описания и линейка просто не показываются.

---

### Лоадер, PWA и шаринг
- **Лоадер (`#splash` в `index.html`)**: статичная разметка и inline-CSS, видна до загрузки бандла: акула, «Hookah Hub», бегущая фраза из `LOADING`, внизу `AKULKA PROJECTS`. `splash.js` крутит фразы и убирает лоадер после `initAuth()` (но не раньше 1,6 с).
- **Приветствие** на главной: `makeGreeting()` выбирает одну фразу из пула по времени суток (ночь/утро/день/вечер) на загрузку страницы; имя подставляется вместо `{n}`, без имени хвост убирается.
- **Установка PWA**: `initPwa()` ловит `beforeinstallprompt`/`appinstalled`; `installMode()` → `'prompt'` (Android/desktop), `'ios'` или `null` (уже установлено/не поддерживается). Установленное определяется по `display-mode: standalone` и `navigator.standalone`.
- **Шаринг**: `shareLink({title,text,url,item,type})` — превью, Telegram, WhatsApp, «Картинкой» (Web Share с файлом, иначе скачивание), ссылка, текст, «Ещё…».
- Исправлено: при открытии сайта без hash (`/`) главная не рендерилась (`current` теперь `null` на старте).

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
| `VITE_VAPID_PUBLIC_KEY` | фронт + функции | публичный ключ Web Push (`npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Netlify Functions | приватный ключ (**секрет**) и `mailto:` для VAPID |
| `SITE_URL` | Netlify Functions | необязательно; по умолчанию `https://hookahhub.netlify.app` |
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
  При пересоздании `tobaccos_api` новые колонки добавляйте **в конец** (`create or replace view` не даёт менять порядок).

---

## 11. Безопасность и известные проблемы

- `SUPABASE_SERVICE_ROLE` утёк в публичную историю git (коммит `8fd4e9d`); **перевыпущен 2026-11-07**, новый ключ в Netlify и `.env`. Старый недействителен.
- Закрыто: старые функции принимали `x-tg-id` (можно было действовать от имени любого пользователя);
  `users`/`sessions` раньше читались anon-ключом. Теперь RLS.
- **Состояние git и деплоя (2026-11-07):** исправление сканера секретов и пагинация каталога (`cc10365`)
  и вывод описания/линейки табака (`0c3ce5d`) запушены в `main`; Netlify пересобирает сайт.
  Статус деплоя после этого пуша стоит проверить в Netlify → Deploys.
- Микс «Citrus Punch» в базе встречается дважды (дубль был до миграций). Удалять по решению владельца.
- Есть пользовательский микс с оскорбительным названием (автор с именем «.»). Модерации нет; удалять по решению владельца.
- Бренд «Everest» запрошен заказчиком, но такой кальянный табак не нашёлся. Ждём уточнения.
- Google-вход **работает** (включён 2026-11-07). Google Cloud: проект «Hookah Hub», приложение In production, Web-клиент с origin `https://hookahhub.netlify.app` и redirect `https://oounhljncukihkoseufq.supabase.co/auth/v1/callback`; Client ID/Secret вставлены в Supabase → Authentication → Sign In / Providers → Google. Страницы `/privacy.html` и `/terms.html` указаны в Branding. Логотип в Branding не загружать: он запускает проверку бренда, которая требует подтверждения сайта в Search Console (netlify.app-поддомен без своего домена это усложняет).
- Пуши реализованы (2026-11-08). Миграция `20261108_…` применена и проверена (таблица `push_subscriptions` с RLS, корзина `user-images` 300 КБ с политиками insert/delete, функции `hh_*`); VAPID-ключи добавлены в Netlify 2026-11-07. Ручная проверка подписки на проде ещё не выполнена. `main.js` показывает сообщение об ошибке с кнопкой «Обновить», если страница упала при отрисовке (защита от пустого экрана). На iOS работают только в установленном PWA (16.4+). Расписание Netlify-функций включается после деплоя.
- Свои табаки/бренды публикуются сразу, без модерации (лимиты: 5 брендов и 20 табаков в сутки на человека). Удалять спам — SQL в Supabase.
- Supabase Free засыпает после 7 дней без запросов.
- У большинства табаков и миксов нет фото (`image_url` пуст), используются генеративные обложки.
- Файлы `.idea/*` и `netlify/functions/auth-start.js` в рабочей копии отличаются от git только переводами строк
  (CRLF/LF); коммитить их не нужно. **Не используйте `git commit -a`**: он затянет этот шум в коммит.
- Запись файлов агентом в папку пользователя (`device_commit_files`) может подставить **старую версию**,
  если тот же `stagedPath` уже использовался раньше. Для каждой записи берите **новый промежуточный путь**
  (например, `/mnt/user-data/outputs/<задача>-vN/…`) и **после записи сверяйте md5** с проверенной версией.
- Из облачной среды агента `git push` невозможен (нет учётных данных GitHub): коммитить можно, пушит пользователь.
  Полная сборка там тоже не идёт: `node_modules` в папке пользователя собраны под Windows.
- Массовый сбор данных с htreviews.org (их API `/postData`) запрещён политикой агента — не пытаться;
  источники для каталога: магазины, обзоры, поиск.

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
  Новым табакам сразу заполнять `line_id` и `description` (формат — раздел 5).
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
