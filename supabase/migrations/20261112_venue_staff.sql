-- ============================================================================
-- Hookah Hub — список команды заведения (чтение для владельца)
-- venue_members закрыта RLS, hh_my_venues команду не отдаёт.
-- Идемпотентно: create or replace, без drop/delete.
-- ============================================================================

-- Внимание: НЕ stable — hh_uid() пишет last_seen_at
create or replace function public.hh_venue_staff(p_venue uuid)
returns json language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  if public.hh_venue_role(p_venue, v_uid) is distinct from 'owner' then raise exception 'Нет доступа'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'user_id', u.id, 'name', u.name, 'handle', u.handle,
      'avatar_url', u.avatar_url, 'added_at', m.created_at
    ) order by m.created_at)
    from public.venue_members m
    join public.users u on u.id = m.user_id
    where m.venue_id = p_venue and m.role = 'staff' and m.removed_at is null
  ), '[]'::json);
end $$;

revoke all on function public.hh_venue_staff(uuid) from public, anon;
grant execute on function public.hh_venue_staff(uuid) to authenticated;
