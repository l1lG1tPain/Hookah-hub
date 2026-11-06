-- =============================================================================
-- Hookah Hub — переход на Supabase Auth + RPC вместо Netlify-функций
-- Запуск: Supabase Dashboard → SQL Editor → вставить файл целиком → Run.
-- Скрипт идемпотентный: его можно запускать повторно.
-- Существующие пользователи (вошедшие через Telegram) сохраняются и
-- автоматически привязываются к новому аккаунту при следующем входе.
-- =============================================================================

-- 1. Профиль пользователя: связь с auth.users + полезные поля -----------------
alter table public.users add column if not exists auth_id     uuid unique references auth.users(id) on delete set null;
alter table public.users add column if not exists email        text;
alter table public.users add column if not exists provider     text;
alter table public.users add column if not exists created_at   timestamptz default now();
alter table public.users add column if not exists last_seen_at timestamptz;

do $$
begin
  -- tg_id больше не обязателен (Google / e-mail пользователи)
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='tg_id' and is_nullable='NO') then
    execute 'alter table public.users alter column tg_id drop not null';
  end if;
  -- у id должен быть default, чтобы триггер мог создавать строки
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='id'
               and data_type='uuid' and column_default is null) then
    execute 'alter table public.users alter column id set default gen_random_uuid()';
  end if;
end $$;

-- 2. Создание/привязка профиля к auth-пользователю ---------------------------
create or replace function public.hh_link_profile(p_auth_id uuid)
returns public.users.id%type
language plpgsql security definer set search_path = public, auth as $$
declare
  a      auth.users%rowtype;
  meta   jsonb;
  v_id   public.users.id%type;
  v_tg   public.users.tg_id%type;
begin
  select id into v_id from public.users where auth_id = p_auth_id;
  if v_id is not null then return v_id; end if;

  select * into a from auth.users where id = p_auth_id;
  if not found then return null; end if;
  meta := coalesce(a.raw_user_meta_data, '{}'::jsonb);

  -- Telegram: привязываем к уже существующему профилю по tg_id
  if meta ? 'tg_id' then
    v_tg := meta->>'tg_id';
    update public.users
       set auth_id = p_auth_id, email = a.email, provider = 'telegram'
     where tg_id = v_tg and auth_id is null
     returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.users (auth_id, tg_id, name, avatar_url, email, provider)
  values (
    p_auth_id,
    v_tg,
    coalesce(nullif(meta->>'full_name',''), nullif(meta->>'name',''), split_part(a.email, '@', 1), 'Гость'),
    coalesce(meta->>'avatar_url', meta->>'picture'),
    a.email,
    coalesce(meta->>'provider', a.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (auth_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.users where auth_id = p_auth_id;
  end if;
  return v_id;
end $$;

create or replace function public.hh_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.hh_link_profile(new.id);
  exception when others then
    -- не ломаем регистрацию; профиль создастся лениво при первом запросе
    raise warning 'hh_link_profile failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists hh_on_auth_user_created on auth.users;
create trigger hh_on_auth_user_created
  after insert on auth.users
  for each row execute function public.hh_on_auth_user_created();

-- Текущий пользователь (для всех RPC)
create or replace function public.hh_uid()
returns public.users.id%type
language plpgsql security definer set search_path = public as $$
declare v_id public.users.id%type;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  v_id := public.hh_link_profile(auth.uid());
  update public.users set last_seen_at = now() where id = v_id;
  return v_id;
end $$;

-- 3. RPC для фронтенда --------------------------------------------------------
create or replace function public.hh_score_int(s text)
returns int language sql immutable as $$
  select case s when 'excellent' then 5 when 'good' then 4 when 'ok' then 3
                when 'bad' then 2 when 'notgood' then 1 end
$$;

create or replace function public.hh_score_label(s int)
returns text language sql immutable as $$
  select case s when 5 then 'excellent' when 4 then 'good' when 3 then 'ok'
                when 2 then 'bad' when 1 then 'notgood' end
$$;

create or replace function public.hh_me()
returns json language plpgsql security definer set search_path = public as $$
declare v_id public.users.id%type; u public.users%rowtype; r json;
begin
  v_id := public.hh_uid();
  select * into u from public.users where id = v_id;
  select json_build_object(
    'id', u.id,
    'short', right(u.id::text, 6),
    'name', u.name,
    'avatar_url', u.avatar_url,
    'email', case when u.email like '%@telegram.hookahhub.app' then null else u.email end,
    'provider', u.provider,
    'has_telegram', u.tg_id is not null,
    'created_at', u.created_at,
    'favorites', (select count(*) from public.favorites f where f.user_id = v_id),
    'ratings', (select count(*) from public.mix_ratings m where m.user_id = v_id)
             + (select count(*) from public.tobacco_ratings t where t.user_id = v_id)
  ) into r;
  return r;
end $$;

create or replace function public.hh_update_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id public.users.id%type;
begin
  p_name := btrim(p_name);
  if p_name is null or length(p_name) < 2 or length(p_name) > 40 then
    raise exception 'bad name';
  end if;
  v_id := public.hh_uid();
  update public.users set name = p_name where id = v_id;
end $$;

create or replace function public.hh_my_favorites()
returns table(item_type text, item_id text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_id public.users.id%type;
begin
  v_id := public.hh_uid();
  return query
    select f.item_type::text, f.item_id::text, f.created_at
      from public.favorites f
     where f.user_id = v_id
     order by f.created_at desc;
end $$;

create or replace function public.hh_toggle_favorite(p_type text, p_item_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_id   public.users.id%type;
  v_item public.favorites.item_id%type;
  v_type public.favorites.item_type%type;
begin
  if p_type not in ('mix','tobacco') then raise exception 'bad type'; end if;
  v_id := public.hh_uid();
  v_item := p_item_id;
  v_type := p_type;
  delete from public.favorites where user_id = v_id and item_type = v_type and item_id = v_item;
  if found then return false; end if;
  insert into public.favorites (user_id, item_type, item_id) values (v_id, v_type, v_item);
  return true;
end $$;

create or replace function public.hh_rate(p_type text, p_item_id text, p_score int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id   public.users.id%type;
  v_mix  public.mix_ratings.mix_id%type;
  v_tob  public.tobacco_ratings.tobacco_id%type;
  v_ms   public.mix_ratings.score%type;
  v_ts   public.tobacco_ratings.score%type;
begin
  if p_score not between 1 and 5 then raise exception 'bad score'; end if;
  v_id := public.hh_uid();
  if p_type = 'mix' then
    v_mix := p_item_id; v_ms := public.hh_score_label(p_score);
    insert into public.mix_ratings (mix_id, user_id, score) values (v_mix, v_id, v_ms)
      on conflict (mix_id, user_id) do update set score = excluded.score;
  elsif p_type = 'tobacco' then
    v_tob := p_item_id; v_ts := public.hh_score_label(p_score);
    insert into public.tobacco_ratings (tobacco_id, user_id, score) values (v_tob, v_id, v_ts)
      on conflict (tobacco_id, user_id) do update set score = excluded.score;
  else
    raise exception 'bad type';
  end if;
end $$;

create or replace function public.hh_my_ratings()
returns table(item_type text, item_id text, score int)
language plpgsql security definer set search_path = public as $$
declare v_id public.users.id%type;
begin
  v_id := public.hh_uid();
  return query
    select 'mix'::text, m.mix_id::text, public.hh_score_int(m.score::text)
      from public.mix_ratings m where m.user_id = v_id
    union all
    select 'tobacco'::text, t.tobacco_id::text, public.hh_score_int(t.score::text)
      from public.tobacco_ratings t where t.user_id = v_id;
end $$;

-- Распределение оценок микса (публично)
create or replace function public.hh_mix_distribution(p_mix_id text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'excellent', count(*) filter (where score::text = 'excellent'),
    'good',      count(*) filter (where score::text = 'good'),
    'ok',        count(*) filter (where score::text = 'ok'),
    'bad',       count(*) filter (where score::text = 'bad'),
    'notgood',   count(*) filter (where score::text = 'notgood')
  ) from public.mix_ratings where mix_id::text = p_mix_id
$$;

-- 4. Права -------------------------------------------------------------------
revoke all on function public.hh_link_profile(uuid)      from public, anon, authenticated;
revoke all on function public.hh_on_auth_user_created()  from public, anon, authenticated;
revoke all on function public.hh_uid()                   from public, anon;
revoke all on function public.hh_me()                    from public, anon;
revoke all on function public.hh_update_name(text)       from public, anon;
revoke all on function public.hh_my_favorites()          from public, anon;
revoke all on function public.hh_toggle_favorite(text,text) from public, anon;
revoke all on function public.hh_rate(text,text,int)     from public, anon;
revoke all on function public.hh_my_ratings()            from public, anon;

grant execute on function public.hh_me(), public.hh_update_name(text), public.hh_my_favorites(),
  public.hh_toggle_favorite(text,text), public.hh_rate(text,text,int), public.hh_my_ratings()
  to authenticated;
grant execute on function public.hh_mix_distribution(text) to anon, authenticated;

-- Каталог читается напрямую из браузера (anon key) через представления.
-- Представления выполняются с правами владельца, поэтому RLS базовых таблиц
-- (ниже) их не ломает.
do $$
declare v text;
begin
  foreach v in array array['mixes_with_stats','tobaccos_api','mix_ingredients_api'] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname=v and c.relkind='v') then
      execute format('alter view public.%I set (security_invoker = false)', v);
    end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname=v) then
      execute format('grant select on public.%I to anon, authenticated', v);
    end if;
  end loop;
end $$;

-- Закрываем прямой доступ к приватным таблицам из браузера.
-- Netlify-функции работают через service_role и RLS не замечают.
do $$
declare t text;
begin
  foreach t in array array['users','sessions','login_states','favorites','mix_ratings','tobacco_ratings'] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname=t and c.relkind='r') then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 5. Админ-обзор пользователей (не доступен из API) ---------------------------
-- Смотреть: SQL Editor →  select * from hh_admin.users order by last_seen_at desc nulls last;
create schema if not exists hh_admin;
revoke all on schema hh_admin from public, anon, authenticated;

create or replace view hh_admin.users as
select u.id,
       u.name,
       coalesce(u.provider, case when u.tg_id is not null then 'telegram' end) as provider,
       case when u.email like '%@telegram.hookahhub.app' then null else u.email end as email,
       u.tg_id,
       u.created_at,
       a.last_sign_in_at,
       u.last_seen_at,
       (select count(*) from public.favorites f where f.user_id = u.id)        as favorites,
       (select count(*) from public.mix_ratings m where m.user_id = u.id)      as mix_ratings,
       (select count(*) from public.tobacco_ratings t where t.user_id = u.id)  as tobacco_ratings
  from public.users u
  left join auth.users a on a.id = u.auth_id;

create or replace view hh_admin.daily_signups as
select date_trunc('day', created_at)::date as day, count(*) as signups
  from public.users group by 1 order by 1 desc;
