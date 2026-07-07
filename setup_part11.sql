-- ============================================================
--  SETUP PART 11 — person-level remarks with safety classification
-- ============================================================

-- ---------- remarks table ----------
create table if not exists remarks (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  log_id       uuid references boarding_logs(id) on delete set null,  -- optional trip link
  text         text not null,
  is_safety    boolean default false,   -- only true => warning in Manifest Checker
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);
create index if not exists idx_remarks_operator on remarks(operator_id);

alter table remarks enable row level security;

-- read: any authenticated user (verifier needs it)
drop policy if exists "read remarks" on remarks;
create policy "read remarks" on remarks for select to authenticated using (true);

-- admin (PC + admin): full write
drop policy if exists "admin write remarks" on remarks;
create policy "admin write remarks" on remarks
  for all to authenticated using (is_admin()) with check (is_admin());

-- ICM: may INSERT a remark (during deboard) on a platform they manage.
-- We allow any authenticated insert here (app restricts to deboard flow);
-- edit/delete stay admin-only via the policy above taking precedence for update/delete.
drop policy if exists "icm insert remarks" on remarks;
create policy "icm insert remarks" on remarks
  for insert to authenticated with check (true);

-- ---------- migrate the existing 12 remarks ----------

insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'Demob due to crane damage RS-1', true
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-03-22'
where o.ned_pass_no = '2026MUM186014'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'DEVIATION FROM SOW CLAUSE 4.2.2', true
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-04'
where o.ned_pass_no = '2026MUM001595'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'Released due to offshore POB reduction directive for Monsoon-2026', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-09'
where o.ned_pass_no = '2026MUM187203'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'on 21.04.2026 Boat Duke Sprint raised a serious concern regarding unsafe handling practices', true
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-21'
where o.ned_pass_no = '2026MUM002464'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'DEVIATION FROM SOW CLAUSE 4.2.2', true
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-23'
where o.ned_pass_no = '2026MUM002620'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'Released due to offshore POB reduction directive for Monsoon-2026', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-11'
where o.ned_pass_no = '2026MUM188682'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'Released due to offshore POB reduction directive for Monsoon-2026', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-11'
where o.ned_pass_no = '2026MUM189178'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'MAILED FOR MANIFEST FROM PLATFORM', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20'
where o.ned_pass_no = '2026MUM186654'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'MAILED FOR MANIFEST FROM PLATFORM', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20'
where o.ned_pass_no = '2026MUM187550'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'MAILED FOR MANIFEST FROM PLATFORM', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20'
where o.ned_pass_no = '2025MUM170651'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, 'JOINED AS A RELEIVER OF ABHISHEK ND', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-06-14'
where o.ned_pass_no = '2026MUM001596'
limit 1;
insert into remarks (operator_id, log_id, text, is_safety)
select o.id, bl.id, '2 days at BPA due to weather, reached D1 on 26/06/2026', false
from operators o
join boarding_logs bl on bl.operator_id = o.id
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-06-26'
where o.ned_pass_no = '2025MUM176909'
limit 1;

-- (optional) drop the old inline remark column now that remarks live in their own table
-- keep it for safety; comment out if you want to remove:
-- alter table boarding_logs drop column if exists remark;

-- ---------- CHECK ----------
select o.full_name, o.ned_pass_no, r.is_safety, r.text
from remarks r join operators o on o.id=r.operator_id
order by r.is_safety desc, o.full_name;