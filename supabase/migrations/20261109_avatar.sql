-- Своя аватарка пользователя: hh_set_image получает тип 'avatar' (p_id игнорируется, null — убрать фото).
-- Идемпотентно (create or replace), без drop/delete.
create or replace function public.hh_set_image(p_type text, p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; n int;
begin
  v_uid := public.hh_uid();
  if p_url is not null and p_url not like '%/storage/v1/object/public/user-images/' || auth.uid()::text || '/%' then
    raise exception 'Недопустимый адрес картинки';
  end if;
  if p_type = 'avatar' then
    update public.users set avatar_url = p_url where id = v_uid;
    return;
  elsif p_type = 'mix' then
    update public.mixes set image_url = p_url, updated_at = now() where id = p_id and author_id = v_uid;
  elsif p_type = 'tobacco' then
    update public.tobaccos set image_url = p_url where id = p_id and created_by = v_uid;
  else
    raise exception 'Неизвестный тип';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Менять картинку может только автор'; end if;
end $$;

revoke all on function public.hh_set_image(text, uuid, text) from public, anon;
grant execute on function public.hh_set_image(text, uuid, text) to authenticated;
