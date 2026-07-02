-- ============================================================
--  SETUP PART 2 — run in Supabase SQL Editor
--  (a) allow in-charges to add / edit operators
--  (b) your 3 platforms
--  (c) assign the 3 in-charges
-- ============================================================

-- ---------- (a) OPERATOR write access ----------
-- Any authenticated in-charge can add a new operator and edit the roster.
-- (Read policy already exists from part 1.)
create policy "add operators" on operators
  for insert to authenticated with check (true);

create policy "edit operators" on operators
  for update to authenticated using (true) with check (true);

-- ---------- (b) PLATFORMS ----------
-- Wipe the earlier seed platforms (safe: no logs yet). Skip this line
-- if you already boarded anyone on the old seed platforms.
delete from platforms where code in ('NH-01','NH-02','BS-01');

insert into platforms (code, name, asset) values
  ('NEELAM', 'Neelam Platform', 'N&H'),
  ('HEERA',  'Heera Platform',  'N&H'),
  ('RATNA',  'Ratna Platform',  'N&H')
on conflict (code) do nothing;

-- Remove the dummy seed operators (Ramesh/Suresh etc.) so the roster
-- starts clean and in-charges add real ones from the app.
delete from operators
where emp_code in ('ONG-4471','ONG-5582','ONG-6693','ONG-7714','ONG-8825');

-- ---------- (c) ASSIGN IN-CHARGES ----------
-- These users must already exist in Authentication → Users.
-- If any email below hasn't been added as an Auth user yet, add it first,
-- otherwise that one line will insert nothing.

insert into platform_incharges (user_id, platform_id, incharge_name)
select u.id, p.id, 'Manoj Mehta'
from auth.users u, platforms p
where u.email = 'manoj2612mehta@gmail.com' and p.code = 'NEELAM'
on conflict (user_id, platform_id) do nothing;

insert into platform_incharges (user_id, platform_id, incharge_name)
select u.id, p.id, 'Mannu'
from auth.users u, platforms p
where u.email = 'mannu192692@gmail.com' and p.code = 'HEERA'
on conflict (user_id, platform_id) do nothing;

insert into platform_incharges (user_id, platform_id, incharge_name)
select u.id, p.id, 'Ratna In-charge'
from auth.users u, platforms p
where u.email = 'test@xyz.com' and p.code = 'RATNA'
on conflict (user_id, platform_id) do nothing;

-- ---------- CHECK ----------
-- See who got assigned to what:
select pi.incharge_name, u.email, p.code
from platform_incharges pi
join auth.users u on u.id = pi.user_id
join platforms p on p.id = pi.platform_id
order by p.code;
