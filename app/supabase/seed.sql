-- =============================================================================
-- Nexus MRO · Fictional sample data for local development ONLY (D-112)
-- Proprietary to Liebetag. All rights reserved.
--
-- Everything here is invented: NX tails, people, 3LCs, references.
-- It is loaded automatically by `npm run db:reset`. Never load into a real
-- operator's database.
--
-- Sign-in for local testing: any email below, password  nexus-dev-only
--
-- How the sample organisation is set up:
--   ITS  Initial set-up (IT)     no sign-in; records the first grants (bootstrap)
--   ZEM  Commander               Super Admin for all departments (D-035)
--   ABE  Engineering CO          Super Admin for Engineering; approves authorizations
--   QAR  Quality Manager         Quality; issues authorizations; no cost (D-127)
--   KDO  Duty engineer           Engineering; G550 fleet only; Main Store
--   TMB  Certifying engineer     Engineering; certifying on G550
--   PLA  Pilot                   Operations; G550 fleet
--   SBK  Storekeeper             Supply; Main Store only; no cost
--   FAO  Procurement officer     Procurement; View cost
-- =============================================================================

-- ---------------------------------------------------------------- people -----
insert into public.person (id, full_name, rank_or_title, service_number, three_letter_code) values
  ('10000000-0000-0000-0000-000000000001', '[Initial set-up, IT]',  null,          null,       'ITS'),
  ('10000000-0000-0000-0000-000000000002', '[Commander]',           '[Rank]',      'SN-0002',  'ZEM'),
  ('10000000-0000-0000-0000-000000000003', '[Engineering CO]',      '[Rank]',      'SN-0003',  'ABE'),
  ('10000000-0000-0000-0000-000000000004', '[Quality Manager]',     '[Rank]',      'SN-0004',  'QAR'),
  ('10000000-0000-0000-0000-000000000005', '[Duty engineer]',       '[Rank]',      'SN-0005',  'KDO'),
  ('10000000-0000-0000-0000-000000000006', '[Certifying engineer]', '[Rank]',      'SN-0006',  'TMB'),
  ('10000000-0000-0000-0000-000000000007', '[Pilot]',               '[Rank]',      'SN-0007',  'PLA'),
  ('10000000-0000-0000-0000-000000000008', '[Storekeeper]',         '[Rank]',      'SN-0008',  'SBK'),
  ('10000000-0000-0000-0000-000000000009', '[Procurement officer]', '[Rank]',      'SN-0009',  'FAO');

-- ------------------------------------------------- sign-in accounts (local) -----
-- Supabase's own sign-in tables. Password for all: nexus-dev-only
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (values
    ('20000000-0000-0000-0000-000000000002'::uuid, 'zem@nexus.test'),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'abe@nexus.test'),
    ('20000000-0000-0000-0000-000000000004'::uuid, 'qar@nexus.test'),
    ('20000000-0000-0000-0000-000000000005'::uuid, 'kdo@nexus.test'),
    ('20000000-0000-0000-0000-000000000006'::uuid, 'tmb@nexus.test'),
    ('20000000-0000-0000-0000-000000000007'::uuid, 'pla@nexus.test'),
    ('20000000-0000-0000-0000-000000000008'::uuid, 'sbk@nexus.test'),
    ('20000000-0000-0000-0000-000000000009'::uuid, 'fao@nexus.test')
  ) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u where u.email like '%@nexus.test';

-- Link sign-ins to people. Activated by the Commander; the Commander's own
-- account is activated by the initial set-up record (nobody activates themselves, D-033).
insert into public.user_account (id, person_id, status, activated_at, activated_by) values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'active', now(), '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', 'active', now(), '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'active', now(), '10000000-0000-0000-0000-000000000002');

-- ------------------------------------------------------------ appointments -----
insert into public.appointment (id, title, department_code, super_admin_scope, can_approve_authorizations) values
  ('30000000-0000-0000-0000-000000000001', 'Commander',       null,  'all',        false),
  ('30000000-0000-0000-0000-000000000002', 'Engineering CO',  'ENG', 'department', true),
  ('30000000-0000-0000-0000-000000000003', 'Quality Manager', 'QUA', 'none',       false),
  ('30000000-0000-0000-0000-000000000004', 'Supply CO',       'SUP', 'department', false);

insert into public.appointment_holder (appointment_id, person_id, handed_over_by, reason) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Initial set-up'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Initial set-up'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Initial set-up');

-- --------------------------------------------------------- aircraft & stores -----
insert into public.aircraft_type (code, name, manufacturer) values
  ('A330-200', 'Airbus A330-200',  'Airbus'),
  ('G550',     'Gulfstream G550',  'Gulfstream');

insert into public.aircraft (id, tail, aircraft_type_code, msn) values
  ('40000000-0000-0000-0000-000000000101', 'NX-101', 'A330-200', '[SAMPLE-0101]'),
  ('40000000-0000-0000-0000-000000000102', 'NX-102', 'A330-200', '[SAMPLE-0102]'),
  ('40000000-0000-0000-0000-000000000201', 'NX-201', 'G550',     '[SAMPLE-0201]'),
  ('40000000-0000-0000-0000-000000000202', 'NX-202', 'G550',     '[SAMPLE-0202]'),
  ('40000000-0000-0000-0000-000000000203', 'NX-203', 'G550',     '[SAMPLE-0203]'),
  ('40000000-0000-0000-0000-000000000204', 'NX-204', 'G550',     '[SAMPLE-0204]');

insert into public.store (code, name, is_store_of_record) values
  ('MAIN', 'Main Store',    true),
  ('FWD',  'Forward Store', false);

-- ------------------------------------------------------------ access grants -----
-- ITS grants the Commander's first rights; the Commander grants everyone else.
insert into public.access_grant (person_id, grant_type, department_code, is_home, permission_code,
                                 aircraft_type_code, store_code, reason, granted_by)
values
  -- Commander
  ('10000000-0000-0000-0000-000000000002', 'department', 'CMD', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000001'),
  -- Engineering CO
  ('10000000-0000-0000-0000-000000000003', 'department', 'ENG', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', 'all_aircraft', null, false, null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Quality Manager (no cost, D-127)
  ('10000000-0000-0000-0000-000000000004', 'department', 'QUA', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Duty engineer: G550 fleet, Main Store
  ('10000000-0000-0000-0000-000000000005', 'department', 'ENG', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000005', 'aircraft_type', null, false, null, 'G550', null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000005', 'store', null, false, null, null, 'MAIN', 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Certifying engineer: G550 fleet
  ('10000000-0000-0000-0000-000000000006', 'department', 'ENG', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000006', 'aircraft_type', null, false, null, 'G550', null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Pilot: Operations, G550 fleet
  ('10000000-0000-0000-0000-000000000007', 'department', 'OPS', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000007', 'aircraft_type', null, false, null, 'G550', null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Storekeeper: Supply, Main Store only, issue parts, no cost
  ('10000000-0000-0000-0000-000000000008', 'department', 'SUP', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000008', 'store', null, false, null, null, 'MAIN', 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000008', 'permission', null, false, 'ISSUE_PARTS', null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  -- Procurement officer: View cost, all aircraft
  ('10000000-0000-0000-0000-000000000009', 'department', 'PRO', true,  null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000009', 'permission', null, false, 'VIEW_COST', null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000009', 'all_aircraft', null, false, null, null, null, 'Initial set-up', '10000000-0000-0000-0000-000000000002');

-- ------------------------------------------- qualifications & authorizations -----
insert into public.qualification (person_id, kind, reference, licence_category, aircraft_type_code,
                                  issuing_authority, issued_on, expires_on) values
  ('10000000-0000-0000-0000-000000000006', 'licence',     'AMEL-[SAMPLE-006]', '[Category]', null,   '[Authority]', '2022-01-10', '2027-01-09'),
  ('10000000-0000-0000-0000-000000000006', 'type_rating', 'TR-[SAMPLE-006]',   null,         'G550', '[Authority]', '2023-03-01', null),
  ('10000000-0000-0000-0000-000000000005', 'licence',     'AMEL-[SAMPLE-005]', '[Category]', null,   '[Authority]', '2021-06-01', '2026-05-31'),
  ('10000000-0000-0000-0000-000000000005', 'type_rating', 'TR-[SAMPLE-005]',   null,         'A330-200', '[Authority]', '2021-06-01', null);

-- Medical for the pilot: class and expiry only (D-084).
insert into public.qualification (person_id, kind, medical_class, issuing_authority, issued_on, expires_on) values
  ('10000000-0000-0000-0000-000000000007', 'medical', 'Class 1', '[Authority]', '2026-02-01', '2027-01-31');

-- TMB: issued by Quality (QAR), approved by Engineering CO (ABE). Valid.
-- KDO: an A330 authorization that has EXPIRED (and KDO's licence has expired).
insert into public.certifying_authorization (person_id, reference, aircraft_type_code, valid_from, expires_on,
                                             issued_by, approved_by, approved_at) values
  ('10000000-0000-0000-0000-000000000006', 'QA/AUTH/[SAMPLE-0001]', 'G550',     '2026-01-01', '2027-06-30',
   '10000000-0000-0000-0000-000000000004', null, null),
  ('10000000-0000-0000-0000-000000000005', 'QA/AUTH/[SAMPLE-0002]', 'A330-200', '2024-01-01', '2025-12-31',
   '10000000-0000-0000-0000-000000000004', null, null);
-- Approval is a separate step (the insert rule clears it), done here as the CO would.
update public.certifying_authorization
   set approved_by = '10000000-0000-0000-0000-000000000003', approved_at = now()
 where reference in ('QA/AUTH/[SAMPLE-0001]', 'QA/AUTH/[SAMPLE-0002]');

-- ---------------------------------------------------------- operator settings -----
insert into public.operator_setting (key, value, reason) values
  ('operator.name',                   '"[Sample operator]"', 'Initial set-up'),
  ('counting.days_per_month',         '30',                  'Initial set-up (D-166)'),
  ('nadd.default_limit_days',         '120',                 'Initial set-up (D-048, D-166)'),
  ('ddls.extension_categories',       '["B","C","D"]',       'Initial set-up (D-163)'),
  ('work_order.number_format',        '"WO-{000000}"',       'Initial set-up (D-064)'),
  ('scheduling.show_flight_coming_soon', 'true',             'Initial set-up (D-017)'),
  ('scheduling.show_crew_coming_soon',   'true',             'Initial set-up (D-017)');
