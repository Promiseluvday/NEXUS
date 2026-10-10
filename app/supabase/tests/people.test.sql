-- =============================================================================
-- Nexus MRO · People, qualifications and certifying authorizations
-- Automatic checks of the rules in migration 0026 (D-020, D-023, D-032,
-- D-033, D-037, D-043, D-080 to D-084, D-094, D-122, D-125)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
--
-- Sample people (seed.sql): QAR Quality Manager, ABE Engineering CO (approves
-- authorizations), KDO duty engineer (licence EXPIRED, A330 rating only),
-- TMB certifying engineer (G550), PLA pilot, ZEM Commander.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set ZEM_P '''10000000-0000-0000-0000-000000000002'''
\set ABE_P '''10000000-0000-0000-0000-000000000003'''
\set QAR_P '''10000000-0000-0000-0000-000000000004'''
\set KDO_P '''10000000-0000-0000-0000-000000000005'''
\set TMB_P '''10000000-0000-0000-0000-000000000006'''
\set PLA_P '''10000000-0000-0000-0000-000000000007'''

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.act_as(uuid), pg_temp.admin() to authenticated;

-- Set-up for the test: the approval chain step (sample data puts it in
-- seeds/10-people.sql; add it here if that has not been loaded) and PINs.
insert into public.approval_chain_step (action_type, step_no, name, appointment_id)
select 'certifying_authorization', 1, 'CO / ECO approval', '30000000-0000-0000-0000-000000000002'
 where not exists (select 1 from public.approval_chain_step where action_type = 'certifying_authorization');

select pg_temp.act_as(:QAR); select app.set_my_pin('414141'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.set_my_pin('333444'); select pg_temp.admin();
select pg_temp.act_as(:KDO); select app.set_my_pin('555666'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.set_my_pin('777888'); select pg_temp.admin();

-- ================================================= qualifications (D-080) ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.record_qualification(%L, 'licence', '555666', p_reference => 'AMEL-[TEST]',
                     p_issuing_authority => '[Authority]', p_issued_on => current_date, p_expires_on => current_date + 1000) $$, :TMB_P),
  '%Only Quality%', 'D-080: an engineer cannot record qualifications');
select throws_ok($$ insert into public.qualification (person_id, kind, reference) values
                    ('10000000-0000-0000-0000-000000000005', 'licence', 'AMEL-[TEST]') $$,
  '42501', null, 'D-125: nobody writes qualifications directly; only the signed functions');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.record_qualification(%L, 'licence', '414141', p_reference => 'AMEL-[TEST]',
                     p_issuing_authority => '[Authority]', p_issued_on => current_date, p_expires_on => current_date + 1000) $$, :QAR_P),
  '%own qualifications%', 'D-033: Quality cannot record their own qualifications');
select throws_like(format($$ select app.record_qualification(%L, 'licence', '000000', p_reference => 'AMEL-[TEST]',
                     p_issuing_authority => '[Authority]', p_issued_on => current_date, p_expires_on => current_date + 1000) $$, :KDO_P),
  '%PIN not accepted%', 'D-094: recording a qualification needs the PIN');
select throws_like(format($$ select app.record_qualification(%L, 'medical', '414141', p_medical_class => 'Class 1',
                     p_reference => 'MED-123', p_expires_on => current_date + 300) $$, :PLA_P),
  '%only its class and expiry%', 'D-084: a medical with any detail beyond class and expiry is refused');
select throws_like(format($$ select app.record_qualification(%L, 'medical', '414141', p_medical_class => 'Class 1',
                     p_issuing_authority => '[Authority]', p_expires_on => current_date + 300) $$, :PLA_P),
  '%only its class and expiry%', 'D-084: not even the issuing authority is stored for a medical');
select lives_ok(format($$ select app.record_qualification(%L, 'medical', '414141', p_medical_class => 'Class 2',
                     p_expires_on => current_date + 300) $$, :PLA_P),
  'D-084: Quality records a medical with class and expiry only');
select throws_like(format($$ select app.record_qualification(%L, 'type_rating', '414141',
                     p_issuing_authority => '[Authority]', p_issued_on => current_date) $$, :KDO_P),
  '%names the aircraft type%', 'D-080: a type rating names the aircraft type');
select throws_like(format($$ select app.record_qualification(%L, 'licence', '414141', p_reference => 'AMEL-[TEST]') $$, :KDO_P),
  '%issuing authority and the issue date%', 'D-080: a licence needs issuing authority and issue date');
select pg_temp.admin();

-- KDO's licence expired in the sample data: Quality records the renewal.
select id as kdo_old_licence from public.qualification
 where person_id = :KDO_P and kind = 'licence' and superseded_at is null \gset
select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.record_qualification(%L, 'licence', '414141', p_reference => 'AMEL-[TEST-KDO]',
                     p_issuing_authority => '[Authority]', p_issued_on => current_date, p_expires_on => current_date + 1800,
                     p_replaces => %L) $$, :KDO_P, :'kdo_old_licence'),
  '%reason%', 'D-023: replacing a record needs a reason');
select lives_ok(format($$ select app.record_qualification(%L, 'licence', '414141', p_reference => 'AMEL-[TEST-KDO]',
                     p_licence_category => '[Category]', p_issuing_authority => '[Authority]', p_issued_on => current_date,
                     p_expires_on => current_date + 1800, p_replaces => %L, p_reason => 'Renewal') $$, :KDO_P, :'kdo_old_licence'),
  'D-080: Quality records a renewed licence that replaces the old one');
select lives_ok(format($$ select app.record_qualification(%L, 'type_rating', '414141', p_reference => 'TR-[TEST-KDO]',
                     p_aircraft_type => 'G550', p_issuing_authority => '[Authority]', p_issued_on => current_date) $$, :KDO_P),
  'D-080: Quality records a G550 type rating');
select pg_temp.admin();
select is((select superseded_reason || ' · ' || p.three_letter_code from public.qualification q
             join public.person p on p.id = q.superseded_by where q.id = :'kdo_old_licence'),
  'Renewal · QAR', 'D-023: the old licence stays, superseded with why and by whom');
select throws_like(format($$ update public.qualification set expires_on = current_date + 9999 where id = %L $$, :'kdo_old_licence'),
  '%never edited%', 'D-023: a qualification record is never edited, even by the database owner');
select throws_like(format($$ delete from public.qualification where id = %L $$, :'kdo_old_licence'),
  '%never deleted%', 'D-023: a qualification record is never deleted');

-- ============================================ certifying authorizations ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[TEST-1]', 'G550',
                     current_date, current_date + 365, '555666') $$, :TMB_P),
  '%Only Quality%', 'D-032: an engineer cannot issue a certifying authorization');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[TEST-1]', 'G550',
                     current_date, current_date + 365, '414141') $$, :QAR_P),
  '%themselves%', 'D-033: Quality cannot issue an authorization to themselves');
select throws_like(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[TEST-1]', 'G550',
                     current_date, current_date + 365, '414141') $$, :ZEM_P),
  '%Commander%', 'D-037: the Commander / CEO cannot hold a certifying authorization');
select throws_like(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[SAMPLE-0001]', 'G550',
                     current_date, current_date + 365, '414141') $$, :KDO_P),
  '%already used%', 'D-032: authorization references are never reused');
select throws_like(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[TEST-1]', 'G550',
                     current_date, current_date + 365, '000000') $$, :KDO_P),
  '%PIN not accepted%', 'D-094: issuing needs the PIN');
select lives_ok(format($$ select app.issue_certifying_authorization(%L, 'QA/AUTH/[TEST-1]', 'G550',
                     current_date, current_date + 365, '414141') $$, :KDO_P),
  'D-032: Quality issues a G550 authorization for KDO');
select pg_temp.admin();

select id as kdo_auth from public.certifying_authorization where reference = 'QA/AUTH/[TEST-1]' \gset
select is(app.is_certifying(:KDO_P, 'G550'), false,
  'D-032: an issued authorization does not count until the CO / ECO approves it');

select pg_temp.act_as(:ABE);
select ok(exists (select 1 from app.my_pending_approvals() where record_id = :'kdo_auth'),
  'D-032: the waiting authorization is in the CO''s approvals inbox');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.decide_certifying_authorization(%L, 'approve', '414141') $$, :'kdo_auth'),
  '%Only the CO or ECO%', 'D-032: Quality cannot approve the authorization it issued');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select throws_like(format($$ select app.decide_certifying_authorization(%L, 'approve', '000000') $$, :'kdo_auth'),
  '%PIN not accepted%', 'D-094: approving needs the PIN');
select pg_temp.admin();
select is((select approved_by from public.certifying_authorization where id = :'kdo_auth'), null,
  'D-094: after a wrong PIN nothing is approved');

-- The CO approves in the Approvals inbox (the general approval screen).
select pg_temp.act_as(:ABE);
select lives_ok(format($$ select app.decide_approval((select id from public.approval_request
                     where record_id = %L and status = 'pending'), 'approve', '333444') $$, :'kdo_auth'),
  'D-032: the CO approves from the Approvals inbox with the PIN');
select pg_temp.admin();
select is((select p.three_letter_code from public.certifying_authorization c join public.person p on p.id = c.approved_by
            where c.id = :'kdo_auth'), 'ABE', 'D-032: the authorization records the CO as approver');
select is(app.is_certifying(:KDO_P, 'G550'), true,
  'D-043: approved authorization + current licence + G550 rating: KDO may now certify on the G550');

select pg_temp.act_as(:ABE);
select throws_like(format($$ select app.decide_certifying_authorization(%L, 'approve', '333444') $$, :'kdo_auth'),
  '%already approved%', 'D-032: an authorization is approved once');
select pg_temp.admin();

-- Revoking: reason, rights, PIN, once.
select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.revoke_certifying_authorization(%L, '  ', '414141') $$, :'kdo_auth'),
  '%reason%', 'D-033: revoking needs a reason');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.revoke_certifying_authorization(%L, 'No reason', '777888') $$, :'kdo_auth'),
  '%Only Quality or the CO%', 'D-032: an engineer cannot revoke an authorization');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select is(app.revoke_certifying_authorization(:'kdo_auth', '[TEST] Authorization audit finding', '414141'), 'revoked',
  'D-032: Quality revokes with a reason and PIN');
select throws_like(format($$ select app.revoke_certifying_authorization(%L, 'Again', '414141') $$, :'kdo_auth'),
  '%already closed%', 'D-023: a revocation cannot be repeated or undone');
select pg_temp.admin();
select is(app.is_certifying(:KDO_P, 'G550'), false, 'D-043: after revocation KDO can no longer certify');
select is((select p.three_letter_code || ' · ' || c.revoke_reason from public.certifying_authorization c
             join public.person p on p.id = c.revoked_by where c.id = :'kdo_auth'),
  'QAR · [TEST] Authorization audit finding', 'D-033: the revocation records who and why');
select throws_like(format($$ delete from public.certifying_authorization where id = %L $$, :'kdo_auth'),
  '%never deleted%', 'D-023: an authorization is never deleted');

-- Nobody approves their own; the issuer cannot also approve. For this test
-- the CO (ABE) is also given Quality, so ABE could both issue and approve.
insert into public.access_grant (person_id, grant_type, department_code, reason, granted_by)
values (:ABE_P, 'department', 'QUA', '[TEST] dual role', :ZEM_P);
select pg_temp.act_as(:QAR);
select app.issue_certifying_authorization(:ABE_P, 'QA/AUTH/[TEST-2]', 'G550', current_date, current_date + 365, '414141');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select throws_like($$ select app.decide_certifying_authorization(
                       (select id from public.certifying_authorization where reference = 'QA/AUTH/[TEST-2]'), 'approve', '333444') $$,
  '%own authorization%', 'D-033: nobody approves their own authorization');
select app.issue_certifying_authorization(:TMB_P, 'QA/AUTH/[TEST-3]', 'A330-200', current_date, current_date + 365, '333444');
select throws_like($$ select app.decide_certifying_authorization(
                       (select id from public.certifying_authorization where reference = 'QA/AUTH/[TEST-3]'), 'approve', '333444') $$,
  '%issued an authorization cannot also approve%', 'D-032: whoever issued an authorization cannot also approve it');
select pg_temp.admin();

-- Rejection: needs a reason; the authorization is closed, kept, with the reason.
select pg_temp.act_as(:QAR);
select app.issue_certifying_authorization(:TMB_P, 'QA/AUTH/[TEST-4]', 'G550', current_date, current_date + 365, '414141');
select pg_temp.admin();
select id as rej_auth from public.certifying_authorization where reference = 'QA/AUTH/[TEST-4]' \gset
-- (take ABE's extra Quality grant away again so ABE is a plain approver)
update public.access_grant set revoked_at = now(), revoked_by = :ZEM_P, revoke_reason = '[TEST] end'
 where person_id = :ABE_P and department_code = 'QUA' and revoked_at is null;
select pg_temp.act_as(:ABE);
select throws_like(format($$ select app.decide_certifying_authorization(%L, 'reject', '333444') $$, :'rej_auth'),
  '%needs a reason%', 'D-079: a rejection needs a reason');
select is(app.decide_certifying_authorization(:'rej_auth', 'reject', '333444', '[TEST] No A330 type rating on file'), 'rejected',
  'D-032: the CO rejects with a reason and PIN');
select pg_temp.admin();
select is((select app.authorization_state(c) || ' · ' || r.status from public.certifying_authorization c
             join public.approval_request r on r.record_id = c.id where c.id = :'rej_auth'),
  'rejected · rejected', 'D-079: the authorization shows Rejected and the inbox request is closed');

-- ====================================================== who sees people ===
select pg_temp.act_as(:KDO);
select is((select count(*) from app.people_list()), 1::bigint, 'D-125: an engineer sees only their own line in the People list');
select is(app.person_record(:TMB_P), null, 'D-125: an engineer cannot open another person''s record');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select ok((select count(*) from app.people_list()) >= 8, 'D-122: Quality sees everyone in the People list');
select is((select q ->> 'flag' from jsonb_array_elements(app.person_record(:PLA_P) -> 'qualifications') q
            where q ->> 'kind' = 'medical' and q ->> 'medical_class' = 'Class 2'),
  'current', 'D-028: a medical expiring in 300 days is current (margin 60 days)');
select pg_temp.admin();

select * from finish();
rollback;
