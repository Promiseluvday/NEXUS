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
-- Sign in with the username (e.g. "kdo"); the app adds "@users.nexus.local" (D-206).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (values
    ('20000000-0000-0000-0000-000000000002'::uuid, 'zem@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'abe@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000004'::uuid, 'qar@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000005'::uuid, 'kdo@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000006'::uuid, 'tmb@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000007'::uuid, 'pla@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000008'::uuid, 'sbk@users.nexus.local'),
    ('20000000-0000-0000-0000-000000000009'::uuid, 'fao@users.nexus.local')
  ) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u where u.email like '%@users.nexus.local';

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

-- =============================================================================
-- Phase 1 sample data (fictional, D-112)
-- =============================================================================

-- ------------------------------------------------------------- usernames -----
-- Sign in with username or email (D-206). Username = the person's 3LC in lower case.
update public.user_account ua set username = lower(p.three_letter_code)
  from public.person p where p.id = ua.person_id;

-- ------------------------------------------------------- approval chains -----
insert into public.approval_chain (action_type, name) values
  ('work_order',     'Work order (D-063)'),
  ('ddls_extension', 'DDLS / MEL extension (D-056, D-163)'),
  ('nadd_extension', 'NADD extension (D-160)');

insert into public.approval_chain_step (action_type, step_no, name, department_code, appointment_id) values
  ('work_order',     1, 'Quality pre-approval', 'QUA', null),
  ('work_order',     2, 'CO final approval',    null,  '30000000-0000-0000-0000-000000000002'),
  ('ddls_extension', 1, 'Quality approval',     'QUA', null),
  ('nadd_extension', 1, 'Quality approval',     'QUA', null);

-- ------------------------------------------------------------- settings -----
insert into public.operator_setting (key, value, reason) values
  ('operator.time_zone',            '"Africa/Lagos"',      'Initial set-up (D-055)'),
  ('mel.discovery_day_counts',      'false',               'Initial set-up (D-055)'),
  ('ddls.entries_per_page',         '4',                   'Initial set-up (D-163)'),
  ('nadds.rows_per_sheet',          '8',                   'Initial set-up (D-161)'),
  ('repeat.threshold',              '3',                   'Initial set-up (D-208)'),
  ('repeat.window_days',            '30',                  'Initial set-up (D-208)'),
  ('work_order.required_scans',     '["sign_off_card"]',   'Initial set-up (D-065)'),
  ('snag.number_format',            '"SNAG-{000000}"',     'Initial set-up (D-213)'),
  ('nadd.number_format',            '"NADD-{000000}"',     'Initial set-up (D-048)'),
  ('technical_query.number_format', '"TQ-{000000}"',       'Initial set-up (D-207)'),
  ('auth.username_email_domain',    '"users.nexus.local"', 'Initial set-up (D-206)'),
  ('display.date_format',           '"DD Mmm YYYY"',       'Initial set-up (D-204)'),
  ('display.time_format',           '"HH:MM"',             'Initial set-up (D-204)'),
  ('print.nadds_remarks',
   '["Convenience items only.", "Rectify before the A-check and not later than 4 months after entry."]',
   'Initial set-up (D-161, D-166)');

-- --------------------------------------------------- MEL (fictional items) -----
insert into public.mel_revision (id, aircraft_type_code, revision, approval_date, approval_reference, loaded_by) values
  ('50000000-0000-0000-0000-000000000001', 'G550',     '[SAMPLE-07]', '2026-03-01', '[SAMPLE-APPROVAL-G550-07]', '10000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000002', 'A330-200', '[SAMPLE-12]', '2026-02-01', '[SAMPLE-APPROVAL-A330-12]', '10000000-0000-0000-0000-000000000004');

insert into public.mel_item (revision_id, item_number, title, category, interval_value, interval_unit, remarks, m_procedure, o_procedure) values
  ('50000000-0000-0000-0000-000000000001', '21-31-01', '[SAMPLE] Cabin pressure indicator',    'C', 10,  'calendar_days', '[SAMPLE] May be inoperative provided the alternate indication is verified.', true,  true),
  ('50000000-0000-0000-0000-000000000001', '21-31-02', '[SAMPLE] Cabin altitude warning light', 'B', 3,   'calendar_days', '[SAMPLE] One may be inoperative.',                                       false, true),
  ('50000000-0000-0000-0000-000000000001', '33-21-01', '[SAMPLE] Passenger reading lights',     'D', 120, 'calendar_days', '[SAMPLE] Any in excess of those required may be inoperative.',           false, false),
  ('50000000-0000-0000-0000-000000000001', '34-11-01', '[SAMPLE] Standby airspeed indicator',   'A', 10,  'flight_hours',  '[SAMPLE] Repairs to be made within 10 flight hours.',                    true,  true),
  ('50000000-0000-0000-0000-000000000002', '21-51-01', '[SAMPLE] Pack temperature sensor',      'C', 10,  'calendar_days', '[SAMPLE] One may be inoperative.',                                       true,  false),
  ('50000000-0000-0000-0000-000000000002', '33-41-01', '[SAMPLE] Logo light',                   'D', 120, 'calendar_days', '[SAMPLE] May be inoperative.',                                           false, false);

update public.mel_revision set status = 'active', activated_by = loaded_by, activated_at = now()
 where id in ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------- cabin zones (D-209) -----
insert into public.cabin_zone (aircraft_type_code, code, name, is_emergency_equipment) values
  ('G550', 'CAB-FWD', 'Forward cabin',            false),
  ('G550', 'CAB-AFT', 'Aft cabin',                false),
  ('G550', 'GALLEY',  'Galley',                   false),
  ('G550', 'LAV',     'Lavatory',                 false),
  ('G550', 'EXIT-1',  'Main entry door and exit', true),
  ('G550', 'OXY',     'Passenger oxygen',         true),
  ('G550', 'EMER-LT', 'Emergency lighting',       true);

-- ------------------------------------------- tail statuses (set by engineers) -----
insert into public.tail_status_event (aircraft_id, status, reason, expected_rts_on, set_by, set_at) values
  ('40000000-0000-0000-0000-000000000101', 'AOG',      '[SAMPLE] Hydraulic pump awaiting replacement', current_date + 3, '10000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000102', 'IN_CHECK', '600 FH inspection',                            current_date + 2, '10000000-0000-0000-0000-000000000005', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000201', 'SVC',      'Daily inspection complete',                    null,             '10000000-0000-0000-0000-000000000006', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000202', 'SVC',      'Daily inspection complete',                    null,             '10000000-0000-0000-0000-000000000005', now() - interval '20 hours'),
  ('40000000-0000-0000-0000-000000000203', 'SVC',      'Daily inspection complete',                    null,             '10000000-0000-0000-0000-000000000005', now() - interval '10 hours'),
  ('40000000-0000-0000-0000-000000000204', 'SVC_MEL',  'Serviceable with MEL item 21-31-02',           null,             '10000000-0000-0000-0000-000000000006', now() - interval '1 day');

-- ------------------------------------------------------------ sample snags -----
-- NX-203: pilot report, not yet attended (blue "Snag open", D-200).
insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, ata, tlb_book, tlb_page, tlb_item, created_at)
values (app.next_number('snag', 'SNAG-{000000}'), '40000000-0000-0000-0000-000000000203',
        '10000000-0000-0000-0000-000000000007', 'pilot',
        '[SAMPLE] Cabin pressure fluctuation during climb', '21-31', '14', '0371', '1', now() - interval '80 minutes');

-- NX-204: a deferred snag under MEL 21-31-02 (Cat B, 3 days), on the DDLS.
with s as (
  insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, ata,
                           tlb_book, tlb_page, tlb_item, status, disposition,
                           attended_by, attended_at, dispositioned_by, dispositioned_at)
  values (app.next_number('snag', 'SNAG-{000000}'), '40000000-0000-0000-0000-000000000204',
          '10000000-0000-0000-0000-000000000007', 'pilot',
          '[SAMPLE] Cabin altitude warning light inoperative', '21-31', '14', '0368', '1',
          'deferred', 'mel',
          '10000000-0000-0000-0000-000000000006', now() - interval '2 days',
          '10000000-0000-0000-0000-000000000006', now() - interval '2 days')
  returning id, description, tlb_book, tlb_page, tlb_item)
insert into public.ddls_entry (aircraft_id, snag_id, kind, page_no, entry_no, mel_item_id, mel_revision_id,
                               mel_ref, mel_category, interval_value, interval_unit, defect_text,
                               m_required, o_required, m_done, o_passed, placard_fitted,
                               tlb_book, tlb_page, tlb_item, deferred_by, deferred_at, due_at)
select '40000000-0000-0000-0000-000000000204', s.id, 'mel', 1, 1, i.id, i.revision_id,
       i.item_number, i.category, i.interval_value, i.interval_unit, s.description,
       i.m_procedure, i.o_procedure, i.m_procedure, i.o_procedure, true,
       s.tlb_book, s.tlb_page, s.tlb_item, '10000000-0000-0000-0000-000000000006',
       now() - interval '2 days', app.due_from_days(now() - interval '2 days', 3)
  from s, public.mel_item i
 where i.revision_id = '50000000-0000-0000-0000-000000000001' and i.item_number = '21-31-02';
insert into app.number_series (series, last_value)
values ('ddls:40000000-0000-0000-0000-000000000204', 1);
