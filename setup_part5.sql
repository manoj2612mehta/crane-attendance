-- ============================================================
--  SETUP PART 5 — run in Supabase SQL Editor
--  NED pass = mandatory + unique ; emp_code = optional
-- ============================================================

-- allow emp_code to be null (was NOT NULL from part 1)
alter table operators alter column emp_code drop not null;

-- backfill: any existing row missing a NED pass gets a placeholder so the
-- NOT NULL below won't fail. Edit these later to real NED numbers.
update operators
set ned_pass_no = 'TEMP-' || substr(id::text, 1, 6)
where ned_pass_no is null or ned_pass_no = '';

-- make NED mandatory
alter table operators alter column ned_pass_no set not null;

-- the unique index on ned_pass_no already exists from part 4;
-- ensure it also covers the now-mandatory column (idempotent)
create unique index if not exists operators_ned_unique
  on operators (ned_pass_no) where (ned_pass_no is not null and ned_pass_no <> '');

-- ---------- CHECK ----------
select full_name, emp_code, designation, ned_pass_no from operators order by full_name;
