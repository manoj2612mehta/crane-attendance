-- ============================================================
--  SETUP PART 10 — remarks/warnings + DNF NED guard reminder
-- ============================================================
alter table boarding_logs add column if not exists remark text;

-- load the existing safety/deboard remarks onto their matching trips

update boarding_logs bl set remark = 'Demob due to crane damage RS-1'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM186014'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-03-22';
update boarding_logs bl set remark = 'DEVIATION FROM SOW CLAUSE 4.2.2'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM001595'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-04';
update boarding_logs bl set remark = 'Released due to offshore POB reduction directive for Monsoon-2026'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM187203'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-09';
update boarding_logs bl set remark = 'on 21.04.2026 Boat Duke Sprint raised a serious concern regarding unsafe handling practices'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM002464'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-21';
update boarding_logs bl set remark = 'DEVIATION FROM SOW CLAUSE 4.2.2'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM002620'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-04-23';
update boarding_logs bl set remark = 'Released due to offshore POB reduction directive for Monsoon-2026'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM188682'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-11';
update boarding_logs bl set remark = 'Released due to offshore POB reduction directive for Monsoon-2026'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM189178'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-11';
update boarding_logs bl set remark = 'MAILED FOR MANIFEST FROM PLATFORM'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM186654'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20';
update boarding_logs bl set remark = 'MAILED FOR MANIFEST FROM PLATFORM'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM187550'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20';
update boarding_logs bl set remark = 'MAILED FOR MANIFEST FROM PLATFORM'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2025MUM170651'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-05-20';
update boarding_logs bl set remark = 'JOINED AS A RELEIVER OF ABHISHEK ND'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2026MUM001596'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-06-14';
update boarding_logs bl set remark = '2 days at BPA due to weather, reached D1 on 26/06/2026'
from operators o
where bl.operator_id = o.id and o.ned_pass_no = '2025MUM176909'
  and (bl.boarded_at at time zone 'Asia/Kolkata')::date = '2026-06-26';

-- allow icm to write remark on deboard (update policy already covers boarding_logs update)
-- CHECK:
select o.full_name, o.ned_pass_no, bl.remark
from boarding_logs bl join operators o on o.id=bl.operator_id
where bl.remark is not null order by o.full_name;