-- =============================================================================
-- Hookah Hub — заведения (B2B): страница /v/<slug>, меню миксов, команда
-- Идемпотентно (if not exists / create or replace). Удаление только мягкое
-- (archived_at / removed_at). Запись только через RPC hh_venue_*.
-- Запуск: SQL Editor → вставить → Run.
-- Примечание: FK с каскадом (mix_id → mixes) может вызвать окно подтверждения —
-- его нажимает пользователь.
-- Проверка заведения: update public.venues set verified = true, verified_at = now()
--   where lower(slug) = '<slug>';
-- =============================================================================

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  logo_url text,
  description text,
  city text,
  owner_id uuid not null references public.users(id),
  verified boolean not null default false,
  verified_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists venues_slug_lower_idx on public.venues (lower(slug));
create index if not exists venues_owner_idx on public.venues (owner_id);
create index if not exists venues_city_idx on public.venues (lower(city)) where archived_at is null;

create table if not exists public.venue_members (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.users(id),
  role text not null check (role in ('owner','staff')),
  added_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (venue_id, user_id)
);

create table if not exists public.venue_mixes (
  venue_id uuid not null references public.venues(id) on delete cascade,
  mix_id uuid not null references public.mixes(id) on delete cascade,
  pos int not null,
  note text,
  added_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (venue_id, mix_id)
);
create index if not exists venue_mixes_pos_idx on public.venue_mixes (venue_id, pos) where removed_at is null;

alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.venue_mixes enable row level security;

-- ---------------------------------------------------------------------------
-- Внутренний хелпер: роль пользователя в заведении (owner | staff | null)
-- ---------------------------------------------------------------------------
create or replace function public.hh_venue_role(p_venue uuid, p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when v.archived_at is not null then null
    when v.owner_id = p_uid then 'owner'
    else (select m.role from public.venue_members m
          where m.venue_id = v.id and m.user_id = p_uid and m.removed_at is null)
  end
  from public.venues v where v.id = p_venue
$$;

-- Проверка полей (общая для create/update)
create or replace function public.hh_venue_check(p_slug text, p_name text, p_city text, p_desc text)
returns void language plpgsql immutable as $$
begin
  if p_slug !~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$' then
    raise exception 'Адрес: 3–30 символов, латиница, цифры, - и _';
  end if;
  if p_slug in ('admin','administrator','hookah','hookahhub','hookah_hub','support','moderator','mod','official',
                'root','system','api','team','staff','netlify','new','edit','settings','venues','v','u','mix',
                'tobacco','login','app','help') then
    raise exception 'Этот адрес зарезервирован';
  end if;
  if p_name is null or length(p_name) not between 2 and 60 then raise exception 'Название: 2–60 символов'; end if;
  if p_city is not null and length(p_city) not between 2 and 40 then raise exception 'Город: 2–40 символов'; end if;
  if p_desc is not null and length(p_desc) > 500 then raise exception 'Описание: до 500 символов'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Создать заведение (создатель — владелец). Лимиты: 3 активных, 1 в сутки.
-- ---------------------------------------------------------------------------
create or replace function public.hh_venue_create(p_slug text, p_name text, p_city text, p_description text)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid; s text; n text; c text; d text; v public.venues%rowtype;
begin
  v_uid := public.hh_uid();
  s := lower(btrim(coalesce(p_slug, '')));
  n := btrim(coalesce(p_name, ''));
  c := nullif(btrim(coalesce(p_city, '')), '');
  d := nullif(btrim(coalesce(p_description, '')), '');
  perform public.hh_venue_check(s, n, c, d);
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  if (select count(*) from public.venues where owner_id = v_uid and archived_at is null) >= 3 then
    raise exception 'Не больше 3 заведений';
  end if;
  if exists (select 1 from public.venues where owner_id = v_uid and created_at > now() - interval '1 day') then
    raise exception 'Слишком часто, попробуйте завтра';
  end if;
  begin
    insert into public.venues (slug, name, city, description, owner_id)
    values (s, n, c, d, v_uid) returning * into v;
  exception when unique_violation then
    raise exception 'Этот адрес уже занят';
  end;
  return json_build_object('id', v.id, 'slug', v.slug, 'name', v.name, 'city', v.city,
                           'description', v.description, 'logo_url', v.logo_url,
                           'verified', v.verified, 'role', 'owner');
end $$;

-- Изменить (только владелец). Смена адреса или названия снимает verified.
create or replace function public.hh_venue_update(p_id uuid, p_slug text, p_name text, p_city text, p_description text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; s text; n text; c text; d text; o public.venues%rowtype;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_id, v_uid) is distinct from 'owner' then raise exception 'Нет доступа'; end if;
  s := lower(btrim(coalesce(p_slug, '')));
  n := btrim(coalesce(p_name, ''));
  c := nullif(btrim(coalesce(p_city, '')), '');
  d := nullif(btrim(coalesce(p_description, '')), '');
  perform public.hh_venue_check(s, n, c, d);
  select * into o from public.venues where id = p_id;
  begin
    update public.venues set
      slug = s, name = n, city = c, description = d, updated_at = now(),
      verified = case when lower(o.slug) <> s or o.name <> n then false else o.verified end,
      verified_at = case when lower(o.slug) <> s or o.name <> n then null else o.verified_at end
    where id = p_id;
  exception when unique_violation then
    raise exception 'Этот адрес уже занят';
  end;
end $$;

-- Логотип: owner/staff; url только из user-images/<auth.uid()>/…; null снимает
create or replace function public.hh_venue_set_logo(p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_id, v_uid) is null then raise exception 'Нет доступа'; end if;
  if p_url is not null and position('/user-images/' || auth.uid()::text || '/' in p_url) = 0 then
    raise exception 'Недопустимый адрес картинки';
  end if;
  update public.venues set logo_url = p_url, updated_at = now() where id = p_id;
end $$;

-- Архив (мягкое удаление) и возврат из архива — только владелец
create or replace function public.hh_venue_archive(p_id uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if not exists (select 1 from public.venues where id = p_id and owner_id = v_uid) then
    raise exception 'Нет доступа';
  end if;
  update public.venues set archived_at = case when p_archived then now() else null end, updated_at = now()
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Меню миксов
-- ---------------------------------------------------------------------------
create or replace function public.hh_venue_add_mix(p_venue uuid, p_mix uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; nt text; nxt int;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is null then raise exception 'Нет доступа'; end if;
  if not exists (select 1 from public.mixes where id = p_mix and is_published) then
    raise exception 'Микс не найден';
  end if;
  nt := nullif(btrim(coalesce(p_note, '')), '');
  if nt is not null and length(nt) > 140 then raise exception 'Заметка: до 140 символов'; end if;
  perform pg_advisory_xact_lock(hashtext(p_venue::text));
  if not exists (select 1 from public.venue_mixes where venue_id = p_venue and mix_id = p_mix and removed_at is null)
     and (select count(*) from public.venue_mixes where venue_id = p_venue and removed_at is null) >= 100 then
    raise exception 'В меню не больше 100 миксов';
  end if;
  select coalesce(max(pos), 0) + 1 into nxt from public.venue_mixes where venue_id = p_venue and removed_at is null;
  insert into public.venue_mixes (venue_id, mix_id, pos, note, added_by)
  values (p_venue, p_mix, nxt, nt, v_uid)
  on conflict (venue_id, mix_id) do update
    set removed_at = null,
        note = excluded.note,
        added_by = excluded.added_by,
        pos = case when public.venue_mixes.removed_at is null then public.venue_mixes.pos else excluded.pos end;
end $$;

create or replace function public.hh_venue_remove_mix(p_venue uuid, p_mix uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is null then raise exception 'Нет доступа'; end if;
  update public.venue_mixes set removed_at = now() where venue_id = p_venue and mix_id = p_mix and removed_at is null;
end $$;

-- Порядок: p_mix_ids — желаемая последовательность; чужие id игнорируются
create or replace function public.hh_venue_reorder(p_venue uuid, p_mix_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is null then raise exception 'Нет доступа'; end if;
  update public.venue_mixes vm set pos = o.ord
  from unnest(coalesce(p_mix_ids, '{}'::uuid[])) with ordinality as o(id, ord)
  where vm.venue_id = p_venue and vm.mix_id = o.id and vm.removed_at is null;
end $$;

create or replace function public.hh_venue_set_note(p_venue uuid, p_mix uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; nt text;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is null then raise exception 'Нет доступа'; end if;
  nt := nullif(btrim(coalesce(p_note, '')), '');
  if nt is not null and length(nt) > 140 then raise exception 'Заметка: до 140 символов'; end if;
  update public.venue_mixes set note = nt where venue_id = p_venue and mix_id = p_mix and removed_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Команда (staff): только владелец, до 10
-- ---------------------------------------------------------------------------
create or replace function public.hh_venue_add_staff(p_venue uuid, p_handle text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; t uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is distinct from 'owner' then raise exception 'Нет доступа'; end if;
  select id into t from public.users where lower(handle) = lower(btrim(coalesce(p_handle, '')));
  if t is null then raise exception 'Пользователь не найден'; end if;
  if t = v_uid then raise exception 'Вы уже владелец'; end if;
  if not exists (select 1 from public.venue_members where venue_id = p_venue and user_id = t and removed_at is null)
     and (select count(*) from public.venue_members where venue_id = p_venue and removed_at is null) >= 10 then
    raise exception 'Не больше 10 сотрудников';
  end if;
  insert into public.venue_members (venue_id, user_id, role, added_by)
  values (p_venue, t, 'staff', v_uid)
  on conflict (venue_id, user_id) do update set removed_at = null, role = 'staff', added_by = v_uid;
end $$;

create or replace function public.hh_venue_remove_staff(p_venue uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is distinct from 'owner' then raise exception 'Нет доступа'; end if;
  update public.venue_members set removed_at = now() where venue_id = p_venue and user_id = p_user and removed_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Чтение: мои заведения (owner/staff), публичная страница, каталог
-- ---------------------------------------------------------------------------
create or replace function public.hh_my_venues()
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  return coalesce((
    select json_agg(json_build_object(
      'id', v.id, 'slug', v.slug, 'name', v.name, 'logo_url', v.logo_url, 'description', v.description,
      'city', v.city, 'verified', v.verified, 'archived', v.archived_at is not null,
      'role', case when v.owner_id = v_uid then 'owner' else 'staff' end,
      'mixes', (select count(*) from public.venue_mixes vm where vm.venue_id = v.id and vm.removed_at is null)
    ) order by v.created_at)
    from public.venues v
    where v.owner_id = v_uid
       or exists (select 1 from public.venue_members m
                  where m.venue_id = v.id and m.user_id = v_uid and m.removed_at is null)
  ), '[]'::json);
end $$;

create or replace function public.hh_venue_by_slug(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', v.id, 'slug', v.slug, 'name', v.name, 'logo_url', v.logo_url,
    'description', v.description, 'city', v.city, 'verified', v.verified, 'created_at', v.created_at,
    'mixes', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'title', s.title, 'image_url', s.image_url, 'taste_tags', s.taste_tags,
        'author_id', s.author_id, 'note', vm.note, 'pos', vm.pos,
        'votes', s.votes, 'avg_score', s.avg_score,
        'excellent', s.excellent, 'good', s.good, 'ok', s.ok, 'bad', s.bad, 'notgood', s.notgood
      ) order by vm.pos, vm.created_at)
      from public.venue_mixes vm
      join public.mixes_with_stats s on s.id = vm.mix_id
      where vm.venue_id = v.id and vm.removed_at is null and s.is_published
    ), '[]'::json)
  )
  from public.venues v
  where lower(v.slug) = lower(btrim(p_slug)) and v.archived_at is null
$$;

create or replace view public.venues_api with (security_invoker = false) as
  select v.id, v.slug, v.name, v.logo_url, v.city, v.verified,
         (select count(*) from public.venue_mixes vm where vm.venue_id = v.id and vm.removed_at is null) as mixes_count
  from public.venues v where v.archived_at is null;

-- ---------------------------------------------------------------------------
-- Права: по умолчанию Supabase даёт execute anon/authenticated — отзываем явно
-- ---------------------------------------------------------------------------
revoke all on function public.hh_venue_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.hh_venue_check(text, text, text, text) from public, anon, authenticated;

revoke all on function public.hh_venue_create(text, text, text, text) from public, anon;
revoke all on function public.hh_venue_update(uuid, text, text, text, text) from public, anon;
revoke all on function public.hh_venue_set_logo(uuid, text) from public, anon;
revoke all on function public.hh_venue_archive(uuid, boolean) from public, anon;
revoke all on function public.hh_venue_add_mix(uuid, uuid, text) from public, anon;
revoke all on function public.hh_venue_remove_mix(uuid, uuid) from public, anon;
revoke all on function public.hh_venue_reorder(uuid, uuid[]) from public, anon;
revoke all on function public.hh_venue_set_note(uuid, uuid, text) from public, anon;
revoke all on function public.hh_venue_add_staff(uuid, text) from public, anon;
revoke all on function public.hh_venue_remove_staff(uuid, uuid) from public, anon;
revoke all on function public.hh_my_venues() from public, anon;

grant execute on function public.hh_venue_create(text, text, text, text) to authenticated;
grant execute on function public.hh_venue_update(uuid, text, text, text, text) to authenticated;
grant execute on function public.hh_venue_set_logo(uuid, text) to authenticated;
grant execute on function public.hh_venue_archive(uuid, boolean) to authenticated;
grant execute on function public.hh_venue_add_mix(uuid, uuid, text) to authenticated;
grant execute on function public.hh_venue_remove_mix(uuid, uuid) to authenticated;
grant execute on function public.hh_venue_reorder(uuid, uuid[]) to authenticated;
grant execute on function public.hh_venue_set_note(uuid, uuid, text) to authenticated;
grant execute on function public.hh_venue_add_staff(uuid, text) to authenticated;
grant execute on function public.hh_venue_remove_staff(uuid, uuid) to authenticated;
grant execute on function public.hh_my_venues() to authenticated;

grant execute on function public.hh_venue_by_slug(text) to anon, authenticated;
grant select on public.venues_api to anon, authenticated;
