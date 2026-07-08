-- ============================================================
--  SETUP PART 12 — regional coordinators with 3-flag model
--  is_admin  = sees everything (dashboard, all platforms)
--  can_manage = DNF review + remarks + roster edit/delete
--  icm (per platform) = board/deboard that platform
-- ============================================================

-- ---------- (a) can_manage flag ----------
alter table platform_incharges add column if not exists can_manage boolean default false;

-- helper: is the current user a manager (DNF/remarks/roster)?
create or replace function can_manage()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from platform_incharges
    where user_id = auth.uid() and can_manage = true
  );
$$;

-- ---------- (b) tighten write policies to can_manage ----------
-- operators: master add/edit/delete now require can_manage (not just is_admin)
drop policy if exists "admin insert operators" on operators;
drop policy if exists "admin update operators" on operators;
drop policy if exists "admin delete operators" on operators;
create policy "manage insert operators" on operators
  for insert to authenticated with check ( can_manage() );
create policy "manage update operators" on operators
  for update to authenticated using ( can_manage() ) with check ( can_manage() );
create policy "manage delete operators" on operators
  for delete to authenticated using ( can_manage() );
-- (icm insert dnf policy from part7 stays: ICM can still create DNF rows when boarding)

-- remarks: manage-only for edit/delete; insert still open (ICM deboard + managers)
drop policy if exists "admin write remarks" on remarks;
create policy "manage update remarks" on remarks
  for update to authenticated using ( can_manage() ) with check ( can_manage() );
create policy "manage delete remarks" on remarks
  for delete to authenticated using ( can_manage() );
-- read + insert policies from part 11 remain

-- boarding_logs delete stays admin-ish -> switch to can_manage
drop policy if exists "admin delete logs" on boarding_logs;
create policy "manage delete logs" on boarding_logs
  for delete to authenticated using ( can_manage() );

-- ============================================================
--  (c) WIPE old coordinators, create the 3 regional PCs
-- ============================================================
--  FIRST: Authentication → delete users project_coordinator@xyz.com and admin@xyz.com
--         Authentication → Add user (Auto Confirm), password Ongc@1234:
--            pc_nh@xyz.com , pc_mh@xyz.com , pc_bs@xyz.com
--  THEN run everything below.

-- remove any assignment rows for the retired coordinators (safe if already gone)
delete from platform_incharges
where user_id in (select id from auth.users where email in ('project_coordinator@xyz.com','admin@xyz.com'));

-- clear any prior rows for the 3 new PCs (idempotent re-run)
delete from platform_incharges
where user_id in (select id from auth.users where email in ('pc_nh@xyz.com','pc_mh@xyz.com','pc_bs@xyz.com'));

-- ---------- pc_nh : full power everywhere ----------
-- is_admin + can_manage + ICM on ALL 16 platforms
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin, can_manage)
select u.id, p.id, 'PC N&H', 'icm', true, true
from auth.users u cross join platforms p
where u.email = 'pc_nh@xyz.com';

-- ---------- pc_mh : see-all, board only MH platforms, no manage ----------
-- one admin anchor row (is_admin, NOT can_manage) + icm rows for MH platforms.
-- We make every MH row is_admin=true so "sees all" holds; can_manage stays false.
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin, can_manage)
select u.id, p.id, 'PC Mumbai High', 'icm', true, false
from auth.users u join platforms p on p.code in ('MHN','NQO','WIN','BHS','SCA','SHP','ICP')
where u.email = 'pc_mh@xyz.com';
-- give pc_mh visibility to the OTHER platforms too (view role, is_admin) so dashboard shows all,
-- but role='view' means no board there.
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin, can_manage)
select u.id, p.id, 'PC Mumbai High', 'view', true, false
from auth.users u join platforms p on p.code not in ('MHN','NQO','WIN','BHS','SCA','SHP','ICP')
where u.email = 'pc_mh@xyz.com';

-- ---------- pc_bs : see-all, board only BS platforms, no manage ----------
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin, can_manage)
select u.id, p.id, 'PC Bassein & Satellite', 'icm', true, false
from auth.users u join platforms p on p.code in ('BPA','BPB','B-193','TAPTI','NBP','PANNA')
where u.email = 'pc_bs@xyz.com';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin, can_manage)
select u.id, p.id, 'PC Bassein & Satellite', 'view', true, false
from auth.users u join platforms p on p.code not in ('BPA','BPB','B-193','TAPTI','NBP','PANNA')
where u.email = 'pc_bs@xyz.com';

-- ---------- CHECK ----------
select u.email, count(*) filter (where pi.role='icm') as board_platforms,
       bool_or(pi.is_admin) as sees_all, bool_or(pi.can_manage) as can_manage
from platform_incharges pi join auth.users u on u.id=pi.user_id
where u.email like 'pc_%@xyz.com'
group by u.email order by u.email;
