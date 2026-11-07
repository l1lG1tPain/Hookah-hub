-- =============================================================================
-- Hookah Hub — личная страница: уникальный @ник (handle) и «о себе» (bio)
-- Идемпотентно (add column if not exists / create or replace), без drop/delete.
-- Запуск: SQL Editor → вставить → Run.
-- =============================================================================

alter table public.users add column if not exists handle text;
alter table public.users add column if not exists bio text;
create unique index if not exists users_handle_lower_idx on public.users (lower(handle)) where handle is not null;

-- Ник: 3–20 символов, a-z 0-9 _; задаёт сам пользователь. bio до 160 символов.
create or replace function public.hh_set_profile(p_handle text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; h text;
begin
  v_uid := public.hh_uid();
  h := nullif(lower(btrim(coalesce(p_handle, ''))), '');
  p_bio := nullif(btrim(coalesce(p_bio, '')), '');
  if h is not null then
    if h !~ '^[a-z0-9_]{3,20}$' then raise exception 'Ник: 3–20 символов, латиница, цифры и _'; end if;
    if h in ('admin','administrator','hookah','hookahhub','hookah_hub','support','moderator','mod','official','root','system','api','team','staff','netlify')
       then raise exception 'Этот ник зарезервирован'; end if;
  end if;
  if p_bio is not null and length(p_bio) > 160 then raise exception 'Не длиннее 160 символов'; end if;
  begin
    update public.users set handle = h, bio = p_bio where id = v_uid;
  exception when unique_violation then
    raise exception 'Этот ник уже занят';
  end;
end $$;

-- Публичный профиль: добавлены handle и bio (только безопасные поля)
create or replace function public.hh_author(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', u.id,
    'name', u.name,
    'handle', u.handle,
    'bio', u.bio,
    'avatar_url', u.avatar_url,
    'created_at', u.created_at,
    'mixes', (select count(*) from public.mixes m where m.author_id = u.id and m.is_published)
  ) from public.users u where u.id = p_id
$$;

-- Тот же профиль по нику (для /u/<handle>)
create or replace function public.hh_author_by_handle(p_handle text)
returns json language sql stable security definer set search_path = public as $$
  select public.hh_author(u.id) from public.users u where lower(u.handle) = lower(btrim(p_handle))
$$;

-- hh_me: добавлены handle и bio
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
    'handle', u.handle,
    'bio', u.bio,
    'avatar_url', u.avatar_url,
    'email', case when u.email like '%@telegram.hookahhub.app' then null else u.email end,
    'provider', u.provider,
    'has_telegram', u.tg_id is not null,
    'created_at', u.created_at,
    'favorites', (select count(*) from public.favorites f where f.user_id = v_id),
    'ratings', (select count(*) from public.mix_ratings m where m.user_id = v_id)
             + (select count(*) from public.tobacco_ratings t where t.user_id = v_id),
    'mixes', (select count(*) from public.mixes m where m.author_id = v_id)
  ) into r;
  return r;
end $$;

revoke all on function public.hh_set_profile(text, text) from public, anon;
grant execute on function public.hh_set_profile(text, text) to authenticated;
revoke all on function public.hh_me() from public, anon;
grant execute on function public.hh_me() to authenticated;
grant execute on function public.hh_author(uuid), public.hh_author_by_handle(text) to anon, authenticated;
