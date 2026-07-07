-- ============================================================
--  SETUP PART 9 — run in Supabase SQL Editor
--  (a) allow 'UNK' designation (DNF Unknown)
--  (b) admin can edit + DELETE operators (roster management)
-- ============================================================

-- ---------- (a) allow UNK designation ----------
alter table operators drop constraint if exists operators_designation_chk;
alter table operators add constraint operators_designation_chk
  check (designation in ('CO','CT','SUP','UNK'));

-- ---------- (b) admin delete on operators ----------
-- (admin insert + update policies already exist from part 7)
drop policy if exists "admin delete operators" on operators;
create policy "admin delete operators" on operators
  for delete to authenticated
  using ( is_admin() );

-- also let admin delete a person's boarding logs when removing them
drop policy if exists "admin delete logs" on boarding_logs;
create policy "admin delete logs" on boarding_logs
  for delete to authenticated
  using ( is_admin() );

-- ============================================================
--  CREATE admin@xyz.com  (after adding the auth user)
--  Same as project_coordinator (is_admin) — the app grants
--  roster edit/delete to ALL admins, so this user gets it too.
-- ============================================================
--  1) Authentication → Add user: admin@xyz.com / Ongc@1234 (Auto Confirm)
--  2) then run:
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, (select id from platforms limit 1), 'Admin', 'view', true
from auth.users u where u.email = 'admin@xyz.com'
on conflict (user_id, platform_id) do update set is_admin = true;

-- ---------- CHECK ----------
select u.email, pi.is_admin from platform_incharges pi
join auth.users u on u.id = pi.user_id where pi.is_admin order by u.email;
