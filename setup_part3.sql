-- ============================================================
--  SETUP PART 3 — run in Supabase SQL Editor
--  (a) admin role flag
--  (b) allow custom boarded_at date on insert
--  (c) make manoj2612mehta an admin
-- ============================================================

-- ---------- (a) ADMIN FLAG ----------
alter table platform_incharges
  add column if not exists is_admin boolean default false;

-- ---------- (b) ADMIN read-all + admins can act on any platform ----------
-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from platform_incharges
    where user_id = auth.uid() and is_admin = true
  );
$$;

-- Admins may board/deboard on ANY platform (in-charges only on theirs).
drop policy if exists "board on managed platform" on boarding_logs;
create policy "board on managed platform" on boarding_logs
  for insert to authenticated
  with check ( manages_platform(platform_id) or is_admin() );

drop policy if exists "deboard on managed platform" on boarding_logs;
create policy "deboard on managed platform" on boarding_logs
  for update to authenticated
  using ( manages_platform(platform_id) or is_admin() )
  with check ( manages_platform(platform_id) or is_admin() );

-- ---------- (c) MAKE manoj2612mehta AN ADMIN ----------
-- Admin is stored per assignment row. To grant admin, set is_admin=true on
-- any of that user's platform_incharges rows (function checks by user).
update platform_incharges
set is_admin = true
where user_id = (select id from auth.users where email = 'manoj2612mehta@gmail.com');

-- To add more admins later, just:
--   update platform_incharges set is_admin = true
--   where user_id = (select id from auth.users where email = '<new-admin>');
-- If a future admin manages no platform, give them a placeholder row first:
--   insert into platform_incharges (user_id, platform_id, incharge_name, is_admin)
--   select u.id, (select id from platforms limit 1), 'Admin', true
--   from auth.users u where u.email = '<new-admin>';

-- ---------- CHECK ----------
select u.email, pi.is_admin, p.code
from platform_incharges pi
join auth.users u on u.id = pi.user_id
join platforms p on p.id = pi.platform_id
order by pi.is_admin desc, p.code;
