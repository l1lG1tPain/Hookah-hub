-- =============================================================================
-- Hookah Hub — заведения: ссылки (instagram, website, facebook, telegram) и адрес
-- Идемпотентно. Без drop/delete. Старые hh_venue_create/update остаются, но у
-- authenticated отзывается execute (новые версии с доп. параметрами без default,
-- иначе PostgREST не различит перегрузки).
-- Не объявлять stable там, где вызывается hh_uid() (он пишет last_seen_at).
-- =============================================================================

alter table public.venues add column if not exists instagram text;
alter table public.venues add column if not exists website text;
alter table public.venues add column if not exists facebook text;
alter table public.venues add column if not exists telegram text;
alter table public.venues add column if not exists address text;

-- Проверка полей: старые + ссылки (только http/https, до 200, без пробелов) и адрес (до 200)
create or replace function public.hh_venue_check(
  p_slug text, p_name text, p_city text, p_desc text,
  p_instagram text, p_website text, p_facebook text, p_telegram text, p_address text)
returns void language plpgsql immutable as $$
declare l text;
begin
  perform public.hh_venue_check(p_slug, p_name, p_city, p_desc);
  foreach l in array array[p_instagram, p_website, p_facebook, p_telegram] loop
    if l is not null then
      if length(l) > 200 then raise exception 'Ссылка: до 200 символов'; end if;
      if l !~* '^https?://[^\s/$.?#][^\s]*$' then raise exception 'Ссылка должна начинаться с http:// или https://'; end if;
    end if;
  end loop;
  if p_address is not null and length(p_address) > 200 then raise exception 'Адрес: до 200 символов'; end if;
end $$;

-- Создать (новая версия)
create or replace function public.hh_venue_create(
  p_slug text, p_name text, p_city text, p_description text,
  p_instagram text, p_website text, p_facebook text, p_telegram text, p_address text)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid; s text; n text; c text; d text; ig text; w text; fb text; tg text; a text; v public.venues%rowtype;
begin
  v_uid := public.hh_uid();
  s := lower(btrim(coalesce(p_slug, '')));
  n := btrim(coalesce(p_name, ''));
  c := nullif(btrim(coalesce(p_city, '')), '');
  d := nullif(btrim(coalesce(p_description, '')), '');
  ig := nullif(btrim(coalesce(p_instagram, '')), '');
  w := nullif(btrim(coalesce(p_website, '')), '');
  fb := nullif(btrim(coalesce(p_facebook, '')), '');
  tg := nullif(btrim(coalesce(p_telegram, '')), '');
  a := nullif(btrim(coalesce(p_address, '')), '');
  perform public.hh_venue_check(s, n, c, d, ig, w, fb, tg, a);
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  if (select count(*) from public.venues where owner_id = v_uid and archived_at is null) >= 3 then
    raise exception 'Не больше 3 заведений';
  end if;
  if exists (select 1 from public.venues where owner_id = v_uid and created_at > now() - interval '1 day') then
    raise exception 'Слишком часто, попробуйте завтра';
  end if;
  begin
    insert into public.venues (slug, name, city, description, instagram, website, facebook, telegram, address, owner_id)
    values (s, n, c, d, ig, w, fb, tg, a, v_uid) returning * into v;
  exception when unique_violation then
    raise exception 'Этот адрес уже занят';
  end;
  return json_build_object('id', v.id, 'slug', v.slug, 'name', v.name, 'city', v.city,
                           'description', v.description, 'logo_url', v.logo_url,
                           'instagram', v.instagram, 'website', v.website, 'facebook', v.facebook,
                           'telegram', v.telegram, 'address', v.address,
                           'verified', v.verified, 'role', 'owner');
end $$;

-- Изменить (новая версия; только владелец). Смена адреса /v/… или названия снимает verified.
create or replace function public.hh_venue_update(
  p_id uuid, p_slug text, p_name text, p_city text, p_description text,
  p_instagram text, p_website text, p_facebook text, p_telegram text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; s text; n text; c text; d text; ig text; w text; fb text; tg text; a text; o public.venues%rowtype;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_id, v_uid) is distinct from 'owner' then raise exception 'Нет доступа'; end if;
  s := lower(btrim(coalesce(p_slug, '')));
  n := btrim(coalesce(p_name, ''));
  c := nullif(btrim(coalesce(p_city, '')), '');
  d := nullif(btrim(coalesce(p_description, '')), '');
  ig := nullif(btrim(coalesce(p_instagram, '')), '');
  w := nullif(btrim(coalesce(p_website, '')), '');
  fb := nullif(btrim(coalesce(p_facebook, '')), '');
  tg := nullif(btrim(coalesce(p_telegram, '')), '');
  a := nullif(btrim(coalesce(p_address, '')), '');
  perform public.hh_venue_check(s, n, c, d, ig, w, fb, tg, a);
  select * into o from public.venues where id = p_id;
  begin
    update public.venues set
      slug = s, name = n, city = c, description = d,
      instagram = ig, website = w, facebook = fb, telegram = tg, address = a,
      updated_at = now(),
      verified = case when lower(o.slug) <> s or o.name <> n then false else o.verified end,
      verified_at = case when lower(o.slug) <> s or o.name <> n then null else o.verified_at end
    where id = p_id;
  exception when unique_violation then
    raise exception 'Этот адрес уже занят';
  end;
end $$;

-- Меню: повтор активной записи — ошибка. Восстановление удалённой (removed_at) остаётся.
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
  if exists (select 1 from public.venue_mixes where venue_id = p_venue and mix_id = p_mix and removed_at is null) then
    raise exception 'Уже в меню';
  end if;
  if (select count(*) from public.venue_mixes where venue_id = p_venue and removed_at is null) >= 100 then
    raise exception 'В меню не больше 100 миксов';
  end if;
  select coalesce(max(pos), 0) + 1 into nxt from public.venue_mixes where venue_id = p_venue and removed_at is null;
  insert into public.venue_mixes (venue_id, mix_id, pos, note, added_by)
  values (p_venue, p_mix, nxt, nt, v_uid)
  on conflict (venue_id, mix_id) do update
    set removed_at = null,
        note = excluded.note,
        added_by = excluded.added_by,
        pos = excluded.pos;
end $$;

-- Мои заведения: + новые поля (без stable: внутри hh_uid())
create or replace function public.hh_my_venues()
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  return coalesce((
    select json_agg(json_build_object(
      'id', v.id, 'slug', v.slug, 'name', v.name, 'logo_url', v.logo_url, 'description', v.description,
      'city', v.city, 'verified', v.verified, 'archived', v.archived_at is not null,
      'instagram', v.instagram, 'website', v.website, 'facebook', v.facebook,
      'telegram', v.telegram, 'address', v.address,
      'role', case when v.owner_id = v_uid then 'owner' else 'staff' end,
      'mixes', (select count(*) from public.venue_mixes vm where vm.venue_id = v.id and vm.removed_at is null)
    ) order by v.created_at)
    from public.venues v
    where v.owner_id = v_uid
       or exists (select 1 from public.venue_members m
                  where m.venue_id = v.id and m.user_id = v_uid and m.removed_at is null)
  ), '[]'::json);
end $$;

-- Публичная страница: + ссылки, адрес и описание миксов (для карточек меню)
create or replace function public.hh_venue_by_slug(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', v.id, 'slug', v.slug, 'name', v.name, 'logo_url', v.logo_url,
    'description', v.description, 'city', v.city, 'verified', v.verified, 'created_at', v.created_at,
    'instagram', v.instagram, 'website', v.website, 'facebook', v.facebook,
    'telegram', v.telegram, 'address', v.address,
    'mixes', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'title', s.title, 'description', s.description, 'image_url', s.image_url, 'taste_tags', s.taste_tags,
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

-- Права
revoke all on function public.hh_venue_check(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.hh_venue_create(text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.hh_venue_update(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.hh_venue_create(text, text, text, text) from authenticated;
revoke execute on function public.hh_venue_update(uuid, text, text, text, text) from authenticated;
grant execute on function public.hh_venue_create(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.hh_venue_update(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
