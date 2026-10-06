-- =============================================================================
-- Nexus MRO · Phase 0 · Automatic checks of the foundation rules
-- Proprietary to Liebetag. All rights reserved.
--
-- Run with:  npm run db:test
--
-- Each line below is one check, written so it reads as a sentence. Everything
-- runs inside a transaction that is rolled back at the end, so the checks
-- never change the database.
--
-- "Acting as" a user: we switch to the signed-in role and tell the database
-- which sign-in we are (the same way the real app does with a sign-in token).
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Sign-in ids of the sample people (see seed.sql)
\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set FAO '''20000000-0000-0000-0000-000000000009'''

-- Helper: act as a signed-in user, or go back to the administrator.
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;
grant execute on function pg_temp.act_as_admin() to authenticated;

-- ------------------------------------------------ D-023: nothing is deleted ---
select throws_like(
  $$ delete from public.person where three_letter_code = 'KDO' $$,
  '%never deleted%',
  'D-023: a person record cannot be deleted, even by the administrator');

select throws_like(
  $$ delete from public.aircraft where tail = 'NX-101' $$,
  '%never deleted%',
  'D-023: an aircraft cannot be deleted');

-- --------------------------------------------- D-024: server time is in charge ---
insert into public.person (full_name, three_letter_code, created_at)
values ('[Time test]', 'TTT', '2000-01-01');
select ok(
  (select created_at > '2026-01-01' from public.person where three_letter_code = 'TTT'),
  'D-024: a device cannot backdate a record; the server time is stored');

-- ---------------------------------------------------- D-038: audit trail ---
select ok((select count(*) > 0 from audit.log), 'D-038: changes are written to the audit log');
select is_empty($$ select * from audit.verify_chain() $$, 'D-038: the audit chain is intact');
select throws_like(
  $$ update audit.log set new_data = '{}' where id = (select min(id) from audit.log) $$,
  '%cannot be changed%',
  'D-038: an audit line cannot be edited');
select throws_like(
  $$ delete from audit.log where id = (select min(id) from audit.log) $$,
  '%cannot be changed%',
  'D-038: an audit line cannot be deleted');

-- ------------------------------------------------- D-125: row-level locks ---
select pg_temp.act_as(:KDO);
select is((select count(*) from public.aircraft), 4::bigint,
  'D-121: KDO (G550 scope) sees only the 4 G550 tails');
select is((select count(*) from audit.log), 0::bigint,
  'D-126: an engineer cannot read the audit log');
select is((select count(*) from public.store), 1::bigint,
  'D-152: KDO sees only the Main Store');
select pg_temp.act_as_admin();

select pg_temp.act_as(:QAR);
select is((select count(*) from public.aircraft), 6::bigint,
  'D-122: Quality sees every aircraft');
select ok((select count(*) > 0 from audit.log),
  'D-126: Quality can read the audit log');
select is(app.can_view_cost(), false, 'D-127: Quality cannot see cost');
select pg_temp.act_as_admin();

select pg_temp.act_as(:FAO);
select is(app.can_view_cost(), true, 'D-121: Procurement officer with "View cost" can see cost');
select pg_temp.act_as_admin();

select pg_temp.act_as(:ZEM);
select is(app.can_view_cost(), true, 'D-122: Command can see cost');
select pg_temp.act_as_admin();

set local role anon;
select throws_ok($$ select * from public.person $$, '42501', null,
  'Anonymous visitors get nothing');
reset role;

-- --------------------------------------------------- D-033, D-123: grants ---
select pg_temp.act_as(:ABE);
select throws_like(
  $$ insert into public.access_grant (person_id, grant_type, permission_code, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000003', 'permission', 'VIEW_COST', 'test',
             '10000000-0000-0000-0000-000000000003') $$,
  '%themselves%',
  'D-033: the Engineering CO cannot grant anything to himself');
select lives_ok(
  $$ insert into public.access_grant (person_id, grant_type, section_code, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000005', 'section', 'TIRE', 'Tire Bay duty', '10000000-0000-0000-0000-000000000003') $$,
  'D-035: the Engineering CO can give an engineer the Tire Bay section');
select throws_like(
  $$ insert into public.access_grant (person_id, grant_type, department_code, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000005', 'department', 'SUP', 'test', '10000000-0000-0000-0000-000000000003') $$,
  '%Only a Super Admin for SUP%',
  'D-035: the Engineering CO cannot grant Supply access');
select pg_temp.act_as_admin();

select pg_temp.act_as(:KDO);
select throws_like(
  $$ insert into public.access_grant (person_id, grant_type, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000007', 'all_aircraft', 'test', '10000000-0000-0000-0000-000000000005') $$,
  '%Only a Super Admin%',
  'D-123: an ordinary engineer cannot grant access');
select pg_temp.act_as_admin();

select pg_temp.act_as(:ZEM);
select throws_like(
  $$ insert into public.access_grant (person_id, grant_type, permission_code, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000004', 'permission', 'VIEW_COST', 'test', '10000000-0000-0000-0000-000000000002') $$,
  '%Quality users cannot%',
  'D-127: even the Commander cannot give Quality "View cost"');
select throws_ok(
  $$ insert into public.access_grant (person_id, grant_type, department_code, is_home, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000005', 'department', 'OPS', true, 'test', '10000000-0000-0000-0000-000000000002') $$,
  '23505', null,
  'D-124: a person cannot have two home departments');
select lives_ok(
  $$ insert into public.access_grant (person_id, grant_type, department_code, is_home, reason, granted_by)
     values ('10000000-0000-0000-0000-000000000005', 'department', 'OPS', false, 'Covers Operations duty', '10000000-0000-0000-0000-000000000002') $$,
  'D-124: a person can hold a second, non-home department');
select throws_like(
  $$ update public.access_grant set reason = 'changed'
      where person_id = '10000000-0000-0000-0000-000000000008' and permission_code = 'ISSUE_PARTS' $$,
  '%never edited%',
  'D-023: a grant cannot be edited');
select lives_ok(
  $$ update public.access_grant set revoked_at = now(), revoke_reason = 'Posted out'
      where person_id = '10000000-0000-0000-0000-000000000008' and permission_code = 'ISSUE_PARTS' $$,
  'D-123: the Commander can revoke a grant, with a reason');
select pg_temp.act_as_admin();
select is(
  (select p.three_letter_code from public.access_grant g join public.person p on p.id = g.revoked_by
    where g.person_id = '10000000-0000-0000-0000-000000000008' and g.permission_code = 'ISSUE_PARTS'),
  'ZEM',
  'D-033: a revocation records who did it');

-- ----------------------------------------------------- D-015: aircraft ---
select throws_ok(
  $$ update public.aircraft set status = 'deactivated', deactivated_at = now(),
            deactivated_by = '10000000-0000-0000-0000-000000000002'
      where tail = 'NX-101' $$,
  '23514', null,
  'D-015: an aircraft cannot be deactivated without a reason');

-- ------------------------------------- D-032, D-043: certifying authorizations ---
select is(app.is_certifying('10000000-0000-0000-0000-000000000006', 'G550'), true,
  'D-043: TMB may certify on the G550');
select is(app.is_certifying('10000000-0000-0000-0000-000000000006', 'A330-200'), false,
  'D-043: TMB may not certify on the A330 (no authorization)');
select is(app.is_certifying('10000000-0000-0000-0000-000000000005', 'A330-200'), false,
  'D-043: an expired authorization does not count');

select pg_temp.act_as(:KDO);
select throws_like(
  $$ insert into public.certifying_authorization (person_id, reference, aircraft_type_code, valid_from, expires_on, issued_by)
     values ('10000000-0000-0000-0000-000000000007', 'QA/AUTH/TEST-1', 'G550', current_date, current_date + 365,
             '10000000-0000-0000-0000-000000000005') $$,
  '%Only Quality%',
  'D-032: only Quality can issue a certifying authorization');
select pg_temp.act_as_admin();

select pg_temp.act_as(:QAR);
select lives_ok(
  $$ insert into public.certifying_authorization (person_id, reference, aircraft_type_code, valid_from, expires_on, issued_by)
     values ('10000000-0000-0000-0000-000000000005', 'QA/AUTH/TEST-2', 'G550', current_date, current_date + 365,
             '10000000-0000-0000-0000-000000000004') $$,
  'D-032: Quality can issue an authorization');
select throws_like(
  $$ update public.certifying_authorization set approved_by = '10000000-0000-0000-0000-000000000004', approved_at = now()
      where reference = 'QA/AUTH/TEST-2' $$,
  '%Only the CO or ECO%',
  'D-032: Quality cannot also approve it; the CO or ECO approves');
select pg_temp.act_as_admin();

-- --------------------------------------------- D-162: 3LC and D-094: PIN ---
select throws_ok(
  $$ insert into public.person (full_name, three_letter_code) values ('[Bad code]', 'ab1') $$,
  '23514', null,
  'D-162: a 3LC must be three capital letters');

select pg_temp.act_as(:KDO);
select app.set_my_pin('4821');
select is(app.check_my_pin('4821'), true,  'D-094: the right PIN is accepted');
select is(app.check_my_pin('0000'), false, 'D-094: a wrong PIN is refused');
select pg_temp.act_as_admin();

-- ------------------------------- D-038: tampering with the log is detected ---
-- Simulate someone with full database control switching off the protection
-- and editing an old audit line. The chain check must catch it.
alter table audit.log disable trigger audit_log_no_update;
update audit.log set new_data = '{"tampered": true}' where id = (select min(id) from audit.log);
select isnt_empty($$ select * from audit.verify_chain() $$,
  'D-038: an edited audit line is detected by the chain check');

select * from finish();
rollback;
