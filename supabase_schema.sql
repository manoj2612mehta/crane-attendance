-- ============================================================
--  CRANE OPERATOR ATTENDANCE SYSTEM  |  ONGC Offshore
--  Schema + Row Level Security
--  Design & Created by Manoj Mehta
-- ============================================================
--  Run this whole file in Supabase → SQL Editor.
--  Order matters: tables → RLS → policies → helper trigger.
-- ============================================================

-- ---------- 1. PLATFORMS ----------
create table if not exists platforms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- e.g. "NH-01", "HEERA-A"
  name        text not null,                 -- e.g. "Neelam Process Platform"
  asset       text,                          -- e.g. "N&H", "B&S"
  created_at  timestamptz default now()
);

-- ---------- 2. OPERATORS (crane operators) ----------
create table if not exists operators (
  id          uuid primary key default gen_random_uuid(),
  emp_code    text unique not null,          -- ONGC employee code
  full_name   text not null,
  phone       text,
  active      boolean default true,          -- soft-remove instead of delete
  created_at  timestamptz default now()
);

-- ---------- 3. PLATFORM IN-CHARGES ----------
-- Links a Supabase Auth user to the platform(s) they may act on.
create table if not exists platform_incharges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform_id   uuid not null references platforms(id) on delete cascade,
  incharge_name text,
  created_at    timestamptz default now(),
  unique (user_id, platform_id)
);

-- ---------- 4. BOARDING LOGS (the ledger) ----------
-- One row per trip. deboarded_at NULL = operator currently ONBOARD.
create table if not exists boarding_logs (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id),
  platform_id   uuid not null references platforms(id),
  boarded_at    timestamptz not null default now(),
  deboarded_at  timestamptz,                 -- NULL until they leave
  boarded_by    uuid references auth.users(id),
  deboarded_by  uuid references auth.users(id),
  note          text,
  created_at    timestamptz default now()
);

-- An operator can only be onboard ONE platform at a time.
-- Partial unique index: at most one open (deboarded_at IS NULL) log per operator.
create unique index if not exists one_open_trip_per_operator
  on boarding_logs (operator_id)
  where (deboarded_at is null);

create index if not exists idx_logs_platform on boarding_logs(platform_id);
create index if not exists idx_logs_open on boarding_logs(deboarded_at) where deboarded_at is null;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table platforms          enable row level security;
alter table operators          enable row level security;
alter table platform_incharges enable row level security;
alter table boarding_logs      enable row level security;

-- Helper: does the current user manage this platform?
create or replace function manages_platform(pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_incharges
    where user_id = auth.uid() and platform_id = pid
  );
$$;

-- ---- PLATFORMS: any authenticated user can read (for the ops overview) ----
create policy "read platforms" on platforms
  for select to authenticated using (true);

-- ---- OPERATORS: any authenticated user can read the roster ----
create policy "read operators" on operators
  for select to authenticated using (true);

-- ---- INCHARGES: a user sees only their own assignment rows ----
create policy "read own incharge rows" on platform_incharges
  for select to authenticated using (user_id = auth.uid());

-- ---- BOARDING LOGS ----
-- Read: everyone authenticated can read logs (needed for the global live count).
create policy "read logs" on boarding_logs
  for select to authenticated using (true);

-- Insert (board): only if the user manages that platform.
create policy "board on managed platform" on boarding_logs
  for insert to authenticated
  with check ( manages_platform(platform_id) );

-- Update (deboard / edit): only on a platform the user manages.
create policy "deboard on managed platform" on boarding_logs
  for update to authenticated
  using ( manages_platform(platform_id) )
  with check ( manages_platform(platform_id) );

-- ============================================================
--  CONVENIENCE VIEW: current onboard status with day-count
-- ============================================================
create or replace view v_onboard_now as
select
  bl.id            as log_id,
  o.id             as operator_id,
  o.emp_code,
  o.full_name,
  p.id             as platform_id,
  p.code           as platform_code,
  p.name           as platform_name,
  p.asset,
  bl.boarded_at,
  -- calendar days: board date vs today (inclusive of boarding day = +1)
  (current_date - (bl.boarded_at at time zone 'Asia/Kolkata')::date) + 1 as days_onboard
from boarding_logs bl
join operators o on o.id = bl.operator_id
join platforms p on p.id = bl.platform_id
where bl.deboarded_at is null;

-- ============================================================
--  SEED DATA  (edit / remove before production)
-- ============================================================
insert into platforms (code, name, asset) values
  ('NH-01',   'Neelam Process Platform',  'N&H'),
  ('NH-02',   'Heera Process Complex',    'N&H'),
  ('BS-01',   'Bassein Wellhead WH-7',    'B&S')
on conflict (code) do nothing;

insert into operators (emp_code, full_name, phone) values
  ('ONG-4471', 'Ramesh Yadav',    '+91 90000 11111'),
  ('ONG-5582', 'Suresh Pillai',   '+91 90000 22222'),
  ('ONG-6693', 'Amit Deshmukh',   '+91 90000 33333'),
  ('ONG-7714', 'Farhan Qureshi',  '+91 90000 44444'),
  ('ONG-8825', 'Vikram Rathore',  '+91 90000 55555')
on conflict (emp_code) do nothing;

-- ============================================================
--  ASSIGN AN IN-CHARGE  (do this AFTER creating the auth user)
-- ============================================================
-- 1) Supabase → Authentication → Add user (email + password).
-- 2) Copy that user's UUID.
-- 3) Run, per platform they manage:
--
--   insert into platform_incharges (user_id, platform_id, incharge_name)
--   values (
--     '<AUTH_USER_UUID>',
--     (select id from platforms where code = 'NH-01'),
--     'Manoj Mehta'
--   );
-- ============================================================
