-- ============================================================
--  SETUP PART 6 — run in Supabase SQL Editor
--  roles: icm (can board/deboard) | view (view only)
--  admin stays as is_admin flag (admin = view-all, no board/deboard)
-- ============================================================

-- ---------- role column ----------
alter table platform_incharges
  add column if not exists role text default 'icm';   -- 'icm' | 'view'

do $$ begin
  alter table platform_incharges add constraint incharges_role_chk
    check (role in ('icm','view'));
exception when duplicate_object then null; end $$;

-- existing assignments default to icm (they could board before) — adjust below if needed.
update platform_incharges set role = 'icm' where role is null;

-- ---------- helper: can the current user board/deboard this platform? ----------
-- Only ICM of that platform. Admins can NOT board/deboard.
create or replace function can_board(pid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from platform_incharges
    where user_id = auth.uid() and platform_id = pid and role = 'icm'
  );
$$;

-- ---------- tighten boarding_logs policies ----------
drop policy if exists "board on managed platform" on boarding_logs;
create policy "board on managed platform" on boarding_logs
  for insert to authenticated
  with check ( can_board(platform_id) );

drop policy if exists "deboard on managed platform" on boarding_logs;
create policy "deboard on managed platform" on boarding_logs
  for update to authenticated
  using ( can_board(platform_id) )
  with check ( can_board(platform_id) );

-- read stays open to all authenticated (verifier + view roles + admin need it)
-- (the existing "read logs" policy from part 1 already allows this.)

-- ============================================================
--  EXAMPLES — set roles for your users
-- ============================================================
-- Make someone an ICM (can board/deboard) on a platform:
--   update platform_incharges set role = 'icm'
--   where user_id = (select id from auth.users where email = 'icm@ongc.co.in')
--     and platform_id = (select id from platforms where code = 'NEELAM');
--
-- Make someone VIEW-only on a platform:
--   update platform_incharges set role = 'view'
--   where user_id = (select id from auth.users where email = 'viewer@ongc.co.in')
--     and platform_id = (select id from platforms where code = 'NEELAM');
--
-- Add a NEW view-only user to a platform (after creating them in Auth):
--   insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
--   select u.id, p.id, 'Viewer Name', 'view', false
--   from auth.users u, platforms p
--   where u.email = 'viewer@ongc.co.in' and p.code = 'NEELAM';

-- ---------- CHECK ----------
select u.email, pi.role, pi.is_admin, p.code
from platform_incharges pi
join auth.users u on u.id = pi.user_id
join platforms p on p.id = pi.platform_id
order by pi.is_admin desc, p.code;
