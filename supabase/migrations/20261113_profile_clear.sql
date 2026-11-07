-- =============================================================================
-- Hookah Hub — сброс личной страницы: ник и «о себе» становятся пустыми
-- Идемпотентно (create or replace), без drop/delete. Не stable: hh_uid() пишет last_seen_at.
-- Запуск: SQL Editor → вставить → Run.
-- =============================================================================

create or replace function public.hh_clear_profile()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  v_uid := public.hh_uid();
  update public.users set handle = null, bio = null where id = v_uid;
end $$;

revoke all on function public.hh_clear_profile() from public, anon;
grant execute on function public.hh_clear_profile() to authenticated;
