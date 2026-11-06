-- =============================================================================
-- Hookah Hub — пользовательские миксы и страница автора
-- Идемпотентно. Запуск: SQL Editor → вставить → Run.
-- =============================================================================

-- Служебные авторы каталога показываются как редакция
update public.users set name = 'Hookah Hub' where name in ('Seeder', 'Demo') and auth_id is null;

-- Публичный профиль автора: только безопасные поля
create or replace function public.hh_author(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', u.id,
    'name', u.name,
    'avatar_url', u.avatar_url,
    'created_at', u.created_at,
    'mixes', (select count(*) from public.mixes m where m.author_id = u.id and m.is_published)
  ) from public.users u where u.id = p_id
$$;

-- Имена авторов пачкой (для карточек)
create or replace function public.hh_authors(p_ids uuid[])
returns table(id uuid, name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.avatar_url from public.users u where u.id = any(p_ids)
$$;

-- Создание микса текущим пользователем
-- p_ingredients: [{"tobacco_id": "<uuid>", "percent": 50}, {"custom_title": "Свой табак", "percent": 50}]
create or replace function public.hh_create_mix(p_title text, p_description text, p_tags text[], p_ingredients jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid;
  v_id   uuid;
  v_sum  numeric;
  v_n    int;
  v_recent int;
  e      record;
begin
  v_uid := public.hh_uid();
  p_title := btrim(coalesce(p_title, ''));
  p_description := nullif(btrim(coalesce(p_description, '')), '');

  if length(p_title) < 2 or length(p_title) > 60 then raise exception 'Название: от 2 до 60 символов'; end if;
  if p_description is not null and length(p_description) > 1000 then raise exception 'Описание слишком длинное'; end if;
  if jsonb_typeof(p_ingredients) <> 'array' then raise exception 'Нет состава'; end if;

  v_n := jsonb_array_length(p_ingredients);
  if v_n < 1 or v_n > 6 then raise exception 'В миксе от 1 до 6 табаков'; end if;

  select sum((x->>'percent')::numeric) into v_sum from jsonb_array_elements(p_ingredients) x;
  if v_sum <> 100 then raise exception 'Сумма процентов должна быть 100'; end if;

  select count(*) into v_recent from public.mixes where author_id = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 10 then raise exception 'Не больше 10 миксов в сутки'; end if;

  insert into public.mixes (id, author_id, title, description, taste_tags, is_published, created_at)
  values (gen_random_uuid(), v_uid, p_title, p_description,
          (select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(p_tags, '{}')) t where length(t) between 2 and 20),
          true, now())
  returning id into v_id;

  for e in select x.val, x.ord from jsonb_array_elements(p_ingredients) with ordinality as x(val, ord) loop
    if (e.val->>'percent')::numeric <= 0 then raise exception 'Процент должен быть больше нуля'; end if;
    if e.val ? 'tobacco_id' and nullif(e.val->>'tobacco_id', '') is not null then
      if not exists (select 1 from public.tobaccos where id = (e.val->>'tobacco_id')::uuid) then
        raise exception 'Табак не найден';
      end if;
      insert into public.mix_ingredients (mix_id, tobacco_id, percent, pos)
      values (v_id, (e.val->>'tobacco_id')::uuid, (e.val->>'percent')::numeric, e.ord);
    else
      if length(btrim(coalesce(e.val->>'custom_title', ''))) < 2 then raise exception 'Укажите название табака'; end if;
      insert into public.mix_ingredients (mix_id, custom_title, percent, pos)
      values (v_id, left(btrim(e.val->>'custom_title'), 60), (e.val->>'percent')::numeric, e.ord);
    end if;
  end loop;

  return v_id;
end $$;

-- Удаление своего микса
create or replace function public.hh_delete_mix(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if not exists (select 1 from public.mixes where id = p_id and author_id = v_uid) then
    raise exception 'Это не ваш микс';
  end if;
  delete from public.mix_ingredients where mix_id = p_id;
  delete from public.mix_ratings where mix_id = p_id;
  delete from public.favorites where item_type = 'mix' and item_id = p_id;
  delete from public.mixes where id = p_id;
end $$;

revoke all on function public.hh_create_mix(text, text, text[], jsonb) from public, anon;
revoke all on function public.hh_delete_mix(uuid) from public, anon;
grant execute on function public.hh_create_mix(text, text, text[], jsonb), public.hh_delete_mix(uuid) to authenticated;
grant execute on function public.hh_author(uuid), public.hh_authors(uuid[]) to anon, authenticated;

-- В «Мои миксы» в профиле считаем и авторские миксы
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
             + (select count(*) from public.tobacco_ratings t where t.user_id = v_id),
    'mixes', (select count(*) from public.mixes m where m.author_id = v_id)
  ) into r;
  return r;
end $$;
