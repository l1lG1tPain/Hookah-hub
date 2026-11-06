-- =============================================================================
-- Hookah Hub — пуш-уведомления, загрузка картинок, свои бренды и табаки
-- Идемпотентно (без DROP/DELETE). Запуск: Supabase → SQL Editor → вставить → Run.
-- =============================================================================

-- ---------- служебное ----------
alter table public.brands   add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.brands   add column if not exists created_at timestamptz not null default now();
alter table public.tobaccos add column if not exists created_by uuid references public.users(id) on delete set null;

create or replace function public.hh_norm(p text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(p, '')), '[^a-zа-яё0-9]', '', 'g')
$$;

-- ---------- свои бренды ----------
create or replace function public.hh_create_brand(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_name text; v_id uuid; v_recent int;
begin
  v_uid  := public.hh_uid();
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'Название бренда: от 2 до 40 символов';
  end if;
  -- такой бренд уже есть (без учёта регистра и знаков) — возвращаем его
  select id into v_id from public.brands where public.hh_norm(name) = public.hh_norm(v_name) limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_recent from public.brands where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 5 then raise exception 'Слишком много новых брендов за сутки, попробуйте завтра'; end if;

  insert into public.brands (name, created_by) values (v_name, v_uid) returning id into v_id;
  return v_id;
end $$;

-- ---------- свои табаки ----------
create or replace function public.hh_create_tobacco(
  p_brand_id uuid, p_name text, p_line text, p_tags text[], p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_name text; v_line text; v_line_id uuid; v_id uuid; v_recent int; v_tags text[]; v_desc text;
begin
  v_uid  := public.hh_uid();
  if not exists (select 1 from public.brands where id = p_brand_id) then raise exception 'Выберите бренд'; end if;
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'Название табака: от 2 до 60 символов'; end if;
  v_desc := nullif(btrim(coalesce(p_description, '')), '');
  if v_desc is not null and char_length(v_desc) > 400 then raise exception 'Описание не длиннее 400 символов'; end if;

  -- уже есть такой — возвращаем существующий
  select id into v_id from public.tobaccos where brand_id = p_brand_id and public.hh_norm(name) = public.hh_norm(v_name) limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_recent from public.tobaccos where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 20 then raise exception 'Слишком много новых табаков за сутки, попробуйте завтра'; end if;

  select coalesce(array_agg(t), '{}') into v_tags from (
    select distinct btrim(x) as t from unnest(coalesce(p_tags, '{}')) x where char_length(btrim(x)) between 2 and 24 limit 4) q;

  v_line := nullif(btrim(regexp_replace(coalesce(p_line, ''), '\s+', ' ', 'g')), '');
  if v_line is not null then
    if char_length(v_line) > 40 then raise exception 'Название линейки не длиннее 40 символов'; end if;
    select id into v_line_id from public.lines where brand_id = p_brand_id and lower(name) = lower(v_line) limit 1;
    if v_line_id is null then
      insert into public.lines (brand_id, name) values (p_brand_id, v_line) returning id into v_line_id;
    end if;
  end if;

  insert into public.tobaccos (brand_id, line_id, name, taste_tags, description, created_by)
  values (p_brand_id, v_line_id, v_name, v_tags, v_desc, v_uid)
  returning id into v_id;
  return v_id;
end $$;

-- Автор может удалить свой табак, пока он нигде не использован
create or replace function public.hh_delete_tobacco(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if not exists (select 1 from public.tobaccos where id = p_id and created_by = v_uid) then raise exception 'Можно удалять только свои табаки'; end if;
  if exists (select 1 from public.mix_ingredients where tobacco_id = p_id) then raise exception 'Табак уже используется в миксах'; end if;
  if exists (select 1 from public.tobacco_ratings where tobacco_id = p_id) then raise exception 'У табака уже есть оценки'; end if;
  delete from public.favorites where item_type = 'tobacco' and item_id = p_id;
  delete from public.tobaccos where id = p_id;
end $$;

-- ---------- картинки ----------
-- Корзина: публичное чтение, лимит 300 КБ на файл, только изображения.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-images', 'user-images', true, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  -- загрузка только в свою папку <auth.uid()>/…, не больше 40 файлов на пользователя
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hh_user_images_insert') then
    create policy hh_user_images_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'user-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (select count(*) from storage.objects o
             where o.bucket_id = 'user-images' and (storage.foldername(o.name))[1] = auth.uid()::text) < 40);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hh_user_images_delete') then
    create policy hh_user_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'user-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- Привязать загруженную картинку к своему миксу или табаку (null — убрать)
create or replace function public.hh_set_image(p_type text, p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; n int;
begin
  v_uid := public.hh_uid();
  if p_url is not null and p_url not like '%/storage/v1/object/public/user-images/' || auth.uid()::text || '/%' then
    raise exception 'Недопустимый адрес картинки';
  end if;
  if p_type = 'mix' then
    update public.mixes set image_url = p_url, updated_at = now() where id = p_id and author_id = v_uid;
  elsif p_type = 'tobacco' then
    update public.tobaccos set image_url = p_url where id = p_id and created_by = v_uid;
  else
    raise exception 'Неизвестный тип';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Менять картинку может только автор'; end if;
end $$;

-- ---------- пуш-уведомления ----------
create table if not exists public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  endpoint          text not null unique,
  p256dh            text not null,
  auth              text not null,
  notify_ratings    boolean not null default true,
  notify_daily      boolean not null default true,
  notify_news       boolean not null default true,
  last_rating_check timestamptz not null default now(),
  user_agent        text,
  created_at        timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.hh_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid; r public.push_subscriptions;
begin
  v_uid := public.hh_uid();
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'Некорректная подписка'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = v_uid, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
  returning * into r;
  return json_build_object('ratings', r.notify_ratings, 'daily', r.notify_daily, 'news', r.notify_news);
end $$;

create or replace function public.hh_push_status(p_endpoint text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('ratings', s.notify_ratings, 'daily', s.notify_daily, 'news', s.notify_news)
  from public.push_subscriptions s
  where s.endpoint = p_endpoint and s.user_id = (select u.id from public.users u where u.auth_id = auth.uid())
$$;

create or replace function public.hh_push_prefs(p_endpoint text, p_ratings boolean, p_daily boolean, p_news boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  update public.push_subscriptions
     set notify_ratings = coalesce(p_ratings, notify_ratings), notify_daily = coalesce(p_daily, notify_daily), notify_news = coalesce(p_news, notify_news)
   where endpoint = p_endpoint and user_id = v_uid;
end $$;

create or replace function public.hh_push_unsubscribe(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = v_uid;
end $$;

-- ---------- права на RPC ----------
do $$
declare f text;
begin
  foreach f in array array[
    'hh_create_brand(text)', 'hh_create_tobacco(uuid,text,text,text[],text)', 'hh_delete_tobacco(uuid)',
    'hh_set_image(text,uuid,text)', 'hh_push_subscribe(text,text,text,text)', 'hh_push_status(text)',
    'hh_push_prefs(text,boolean,boolean,boolean)', 'hh_push_unsubscribe(text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
