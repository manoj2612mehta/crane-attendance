-- ============================================================
--  SETUP PART 4 — run in Supabase SQL Editor
--  designation (CO/CT/SUP), NED pass no, duplicate guard
-- ============================================================

-- ---------- new columns on operators ----------
alter table operators add column if not exists designation text;      -- 'CO' | 'CT' | 'SUP'
alter table operators add column if not exists ned_pass_no text;

-- restrict designation to the three valid values (nullable for old rows)
do $$ begin
  alter table operators add constraint operators_designation_chk
    check (designation in ('CO','CT','SUP'));
exception when duplicate_object then null; end $$;

-- duplicate guard: NED pass no must be unique when present
create unique index if not exists operators_ned_unique
  on operators (ned_pass_no) where (ned_pass_no is not null and ned_pass_no <> '');

-- (emp_code is already unique from part 1)

-- Backfill any existing rows so they're valid. Set your real test rows here;
-- default everyone without a designation to CO so the app doesn't choke.
update operators set designation = 'CO' where designation is null;

-- ---------- CHECK ----------
select emp_code, full_name, designation, ned_pass_no from operators order by full_name;
