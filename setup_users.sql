-- ============================================================
--  USER ROLE ASSIGNMENTS — run AFTER creating the 33 auth users
--  (emails below, password Ongc@1234, Auto Confirm ticked)
-- ============================================================
delete from platform_incharges;

insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, (select id from platforms limit 1), 'Project Coordinator', 'view', true
from auth.users u where u.email = 'project_coordinator@xyz.com';

insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'B-193 ICM', 'icm', false
from auth.users u, platforms p where u.email = 'b-193_icm@xyz.com' and p.code = 'B-193';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'B-193 View', 'view', false
from auth.users u, platforms p where u.email = 'b-193_view@xyz.com' and p.code = 'B-193';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BHS ICM', 'icm', false
from auth.users u, platforms p where u.email = 'bhs_icm@xyz.com' and p.code = 'BHS';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BHS View', 'view', false
from auth.users u, platforms p where u.email = 'bhs_view@xyz.com' and p.code = 'BHS';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BPA ICM', 'icm', false
from auth.users u, platforms p where u.email = 'bpa_icm@xyz.com' and p.code = 'BPA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BPA View', 'view', false
from auth.users u, platforms p where u.email = 'bpa_view@xyz.com' and p.code = 'BPA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BPB ICM', 'icm', false
from auth.users u, platforms p where u.email = 'bpb_icm@xyz.com' and p.code = 'BPB';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'BPB View', 'view', false
from auth.users u, platforms p where u.email = 'bpb_view@xyz.com' and p.code = 'BPB';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'HEERA ICM', 'icm', false
from auth.users u, platforms p where u.email = 'heera_icm@xyz.com' and p.code = 'HEERA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'HEERA View', 'view', false
from auth.users u, platforms p where u.email = 'heera_view@xyz.com' and p.code = 'HEERA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'ICP ICM', 'icm', false
from auth.users u, platforms p where u.email = 'icp_icm@xyz.com' and p.code = 'ICP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'ICP View', 'view', false
from auth.users u, platforms p where u.email = 'icp_view@xyz.com' and p.code = 'ICP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'MHN ICM', 'icm', false
from auth.users u, platforms p where u.email = 'mhn_icm@xyz.com' and p.code = 'MHN';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'MHN View', 'view', false
from auth.users u, platforms p where u.email = 'mhn_view@xyz.com' and p.code = 'MHN';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NBP ICM', 'icm', false
from auth.users u, platforms p where u.email = 'nbp_icm@xyz.com' and p.code = 'NBP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NBP View', 'view', false
from auth.users u, platforms p where u.email = 'nbp_view@xyz.com' and p.code = 'NBP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NEELAM ICM', 'icm', false
from auth.users u, platforms p where u.email = 'neelam_icm@xyz.com' and p.code = 'NEELAM';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NEELAM View', 'view', false
from auth.users u, platforms p where u.email = 'neelam_view@xyz.com' and p.code = 'NEELAM';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NQO ICM', 'icm', false
from auth.users u, platforms p where u.email = 'nqo_icm@xyz.com' and p.code = 'NQO';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'NQO View', 'view', false
from auth.users u, platforms p where u.email = 'nqo_view@xyz.com' and p.code = 'NQO';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'PANNA ICM', 'icm', false
from auth.users u, platforms p where u.email = 'panna_icm@xyz.com' and p.code = 'PANNA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'PANNA View', 'view', false
from auth.users u, platforms p where u.email = 'panna_view@xyz.com' and p.code = 'PANNA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'RATNA ICM', 'icm', false
from auth.users u, platforms p where u.email = 'ratna_icm@xyz.com' and p.code = 'RATNA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'RATNA View', 'view', false
from auth.users u, platforms p where u.email = 'ratna_view@xyz.com' and p.code = 'RATNA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'SCA ICM', 'icm', false
from auth.users u, platforms p where u.email = 'sca_icm@xyz.com' and p.code = 'SCA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'SCA View', 'view', false
from auth.users u, platforms p where u.email = 'sca_view@xyz.com' and p.code = 'SCA';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'SHP ICM', 'icm', false
from auth.users u, platforms p where u.email = 'shp_icm@xyz.com' and p.code = 'SHP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'SHP View', 'view', false
from auth.users u, platforms p where u.email = 'shp_view@xyz.com' and p.code = 'SHP';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'TAPTI ICM', 'icm', false
from auth.users u, platforms p where u.email = 'tapti_icm@xyz.com' and p.code = 'TAPTI';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'TAPTI View', 'view', false
from auth.users u, platforms p where u.email = 'tapti_view@xyz.com' and p.code = 'TAPTI';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'WIN ICM', 'icm', false
from auth.users u, platforms p where u.email = 'win_icm@xyz.com' and p.code = 'WIN';
insert into platform_incharges (user_id, platform_id, incharge_name, role, is_admin)
select u.id, p.id, 'WIN View', 'view', false
from auth.users u, platforms p where u.email = 'win_view@xyz.com' and p.code = 'WIN';

select u.email, pi.role, pi.is_admin, p.code
from platform_incharges pi
join auth.users u on u.id = pi.user_id
join platforms p on p.id = pi.platform_id
order by pi.is_admin desc, p.code, pi.role;