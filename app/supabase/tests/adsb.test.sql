-- =============================================================================
-- Nexus MRO · ADs and SBs · Automatic checks of the compliance register rules
-- (D-016, D-020, D-021, D-023, D-028, D-094, D-105, D-121, D-125)
-- Proprietary to Liebetag. All rights reserved.
-- Fictional data only (D-112). Everything runs inside a transaction that is
-- rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set PLA '''20000000-0000-0000-0000-000000000007'''
\set NX101 '''40000000-0000-0000-0000-000000000101'''
\set NX201 '''40000000-0000-0000-0000-000000000201'''
\set NX202 '''40000000-0000-0000-0000-000000000202'''
\set NX203 '''40000000-0000-0000-0000-000000000203'''

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

-- Known margins for the flag checks (D-028).
insert into public.operator_setting (key, value, reason) values
  ('adsb.approaching_days', '10', '[TEST]'), ('adsb.approaching_hours', '50', '[TEST]');

select pg_temp.act_as(:KDO); select app.set_my_pin('555666'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.set_my_pin('777888'); select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.set_my_pin('222333'); select pg_temp.admin();

select ok(to_regclass('public.adsb_document') is not null and to_regclass('public.adsb_compliance') is not null
          and to_regclass('public.adsb_verification') is not null, 'D-016: AD / SB register, entries and verification exist');

-- ------------------------------------------------------------ register ---
select pg_temp.act_as(:PLA);
select throws_like($$ select app.register_adsb_document('{"doc_type":"AD","reference":"[TEST-AD-1]","title":"[TEST]","issuing_authority":"[Authority]","aircraft_type_code":"G550"}') $$,
  '%Only an engineer%', 'D-016: a pilot cannot register an AD');
select is((select count(*) from public.adsb_document_current), 0::bigint, 'D-120: Operations does not see the register');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select app.register_adsb_document('{"doc_type":"AD","reference":"[TEST-AD-1]","title":"[TEST] Elevator hinge inspection","issuing_authority":"[Authority]","aircraft_type_code":"G550","revision":"0"}') as doc1 \gset
select app.register_adsb_document('{"doc_type":"SB","reference":"[TEST-SB-1]","title":"[TEST] Cabin harness clamp","issuing_authority":"[Manufacturer]","aircraft_type_code":"G550"}') as doc2 \gset
select app.register_adsb_document('{"doc_type":"AD","reference":"[TEST-AD-9]","title":"[TEST] A330 only","issuing_authority":"[Authority]","aircraft_type_code":"A330-200"}') as doc_a330 \gset
select is((select count(*) from public.adsb_document_current where reference like '[TEST-%'), 3::bigint,
  'D-016: an engineer registers ADs and SBs');
select throws_like($$ select app.register_adsb_document('{"doc_type":"AD","reference":"[test-ad-1]","title":"Copy","issuing_authority":"[Authority]","aircraft_type_code":"G550"}') $$,
  '%already in the register%', 'D-023: the same reference for the same type is corrected, not entered twice');

-- ------------------------------------------------------ engineer entries ---
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"open"}', '000000') $$, :NX201, :'doc1'),
  '%PIN not accepted%', 'D-094: an entry is signed with the engineer''s PIN');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"open"}', '555666') $$, :NX101, :'doc_a330'),
  '%outside your aircraft scope%', 'D-121: an engineer enters only for tails in scope');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"open"}', '555666') $$, :NX201, :'doc_a330'),
  '%registered for the A330-200%', 'D-016: the entry''s aircraft must be the document''s type');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"recurring","compliance_method":"Repetitive inspection","last_complied_hours":"18500"}', '555666') $$, :NX201, :'doc1'),
  '%Nexus does not calculate it (D-021)%', 'D-021: a recurring entry needs next due as entered; nothing is calculated');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"not_applicable","status":"not_applicable"}', '555666') $$, :NX201, :'doc1'),
  '%reason it does not apply%', 'D-016: not applicable needs a reason');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"complied","compliance_method":"Modification embodied","last_complied_on":"2026-02-03","next_due_on":"2027-02-03"}', '555666') $$, :NX201, :'doc1'),
  '%has no next due%', 'D-016: a complied entry has no next due (use recurring)');

select app.enter_adsb_compliance(:NX201, :'doc1',
  '{"applicability":"applicable","status":"recurring","compliance_method":"Repetitive inspection","last_complied_on":"2026-08-12","last_complied_hours":"18500","next_due_hours":"19000","next_due_text":"19,000 FH or 12 months, whichever first"}',
  '555666') as e1 \gset
select is((select next_due_hours::text || ' | ' || next_due_text || ' | ' || coalesce(next_due_on::text, 'no date')
             from public.adsb_compliance_current where id = :'e1'),
  '19000.0 | 19,000 FH or 12 months, whichever first | no date', 'D-021: next due is stored exactly as entered, nothing added');
select is((select verification_state || ' ' || entered_by_tlc from public.adsb_compliance_current where id = :'e1'),
  'awaiting KDO', 'D-016: a new entry is marked awaiting Quality verification, with who entered it');
select throws_like(format($$ select app.enter_adsb_compliance(%L, %L, '{"applicability":"applicable","status":"open"}', '555666') $$, :NX201, :'doc1'),
  '%already has an entry%', 'D-023: one entry chain per aircraft and document; change it by correcting');
select pg_temp.admin();

-- ----------------------------------------------------------------- flags ---
select app.adsb_today()::text as d_today, (app.adsb_today() + 5)::text as d_soon,
       (app.adsb_today() + 60)::text as d_far \gset
select pg_temp.act_as(:KDO);
select app.enter_adsb_compliance(:NX202, :'doc1', format('{"applicability":"applicable","status":"recurring","compliance_method":"Repetitive inspection","next_due_on":"%s"}',
  :'d_soon')::jsonb, '555666') as e_soon \gset
select app.enter_adsb_compliance(:NX203, :'doc1', format('{"applicability":"applicable","status":"open","next_due_on":"%s"}',
  :'d_today')::jsonb, '555666') as e_today \gset
select app.enter_adsb_compliance(:NX202, :'doc2', format('{"applicability":"applicable","status":"open","next_due_on":"%s"}',
  :'d_far')::jsonb, '555666') as e_far \gset
select is((select string_agg(coalesce(due_flag, 'none'), ',' order by next_due_on) from public.adsb_compliance_current
            where id in (:'e_soon', :'e_today', :'e_far')),
  'reached,approaching,none', 'D-028: date next-due flags Reached at the entered date, Approaching inside the margin, nothing outside');
select pg_temp.admin();

-- Hours / cycles flags depend on the flight-records function
-- app.aircraft_totals(uuid) (D-022). Inside this test (rolled back) it is
-- set aside, then replaced by a stand-in with the same column names, so the
-- result never depends on sample flight records.
do $$ begin
  if to_regprocedure('app.aircraft_totals(uuid)') is not null then
    execute 'alter function app.aircraft_totals(uuid) rename to aircraft_totals_set_aside_for_test';
  end if;
end $$;
select is((select coalesce(hours_flag, 'none') || ' ' || totals_available::text from public.adsb_compliance_current where id = :'e1'),
  'none false', 'D-028: without flight-record totals, an hours next-due is shown as entered with no flag');
create function app.aircraft_totals(p uuid) returns table (aircraft_id uuid, hours numeric, cycles bigint)
  language sql stable as $f$ select p, 18960.0::numeric, 9000::bigint $f$;
select is((select hours_flag || ' ' || current_hours::text from public.adsb_compliance_current where id = :'e1'),
  'approaching 18960.0', 'D-028: hours next-due flags Approaching against the aircraft totals (D-022) once they exist');

-- --------------------------------------------------- Quality verification ---
select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.verify_adsb_compliance(%L, '777888') $$, :'e1'),
  '%Only Quality%', 'D-016: an engineer cannot verify an AD / SB entry');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.verify_adsb_compliance(%L, '000000') $$, :'e1'),
  '%PIN not accepted%', 'D-094: Quality countersigns with PIN');
select lives_ok(format($$ select app.verify_adsb_compliance(%L, '222333') $$, :'e1'), 'D-016: Quality verifies the entry');
select is((select verification_state || ' ' || verified_by_tlc from public.adsb_compliance_current where id = :'e1'),
  'verified QAR', 'D-016: the entry shows verified, with who countersigned');
select throws_like(format($$ select app.reject_adsb_compliance(%L, 'Second thoughts', '222333') $$, :'e1'),
  '%already decided%', 'D-105: one decision per version; the first valid one stands');
select throws_like(format($$ select app.reject_adsb_compliance(%L, '  ', '222333') $$, :'e_soon'),
  '%reason for rejecting%', 'D-016: a rejection needs a reason');
select lives_ok(format($$ select app.reject_adsb_compliance(%L, 'Next due date does not match the AD', '222333') $$, :'e_soon'),
  'D-016: Quality rejects an entry with a reason');
select pg_temp.admin();

-- ------------------------------------------------------------ corrections ---
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.correct_adsb_compliance(%L, '{"applicability":"applicable","status":"open"}', '', '555666') $$, :'e1'),
  '%reason for the correction%', 'D-023: a correction needs a reason');
select app.correct_adsb_compliance(:'e1',
  '{"applicability":"applicable","status":"recurring","compliance_method":"Repetitive inspection","last_complied_on":"2026-08-12","next_due_hours":"19100"}',
  'Next due figure mistyped', '555666') as e1v2 \gset
select is((select version || ' ' || verification_state || ' ' || next_due_hours::text from public.adsb_compliance_current where entry_key =
            (select entry_key from public.adsb_compliance where id = :'e1')),
  '2 awaiting 19100.0', 'D-023: the correction is version 2, in force and awaiting verification again');
select is((select count(*) from public.adsb_compliance c join public.adsb_verification v on v.compliance_id = c.id
            where c.id = :'e1' and v.decision = 'verified'),
  1::bigint, 'D-023: version 1 and its verification stay in history');
select throws_like(format($$ select app.correct_adsb_compliance(%L, '{"applicability":"applicable","status":"open"}', 'Again', '555666') $$, :'e1'),
  '%corrected meanwhile%', 'D-105: an old version cannot be corrected again');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.verify_adsb_compliance(%L, '222333') $$, :'e1'),
  '%corrected meanwhile%', 'D-105: Quality cannot verify a version that was replaced');
select pg_temp.admin();

-- A person in both Engineering and Quality cannot countersign their own entry.
insert into public.access_grant (person_id, grant_type, department_code, is_home, reason, granted_by)
values ('10000000-0000-0000-0000-000000000004', 'department', 'ENG', false, '[TEST]', '10000000-0000-0000-0000-000000000002');
select pg_temp.act_as(:QAR);
select app.enter_adsb_compliance(:NX201, :'doc2', '{"applicability":"not_applicable","status":"not_applicable","not_applicable_reason":"[TEST] Serial outside effectivity"}', '222333') as e_own \gset
select throws_like(format($$ select app.verify_adsb_compliance(%L, '222333') $$, :'e_own'),
  '%another Quality person%', 'Separation of duties: nobody verifies their own entry');
select pg_temp.admin();

-- ------------------------------------------------- documents and history ---
select pg_temp.act_as(:KDO);
select lives_ok(format($$ select app.correct_adsb_document(%L, '{"doc_type":"AD","reference":"[TEST-AD-1]","title":"[TEST] Elevator hinge inspection","issuing_authority":"[Authority]","aircraft_type_code":"G550","revision":"1"}', 'Revision 1 issued') $$, :'doc1'),
  'D-023: a new revision of a document is a new version with a reason');
select is((select document_revised::text || ' ' || assessed_revision || '>' || current_revision from public.adsb_compliance_current where id = :'e_today'),
  'true 0>1', 'D-016: entries made against an older revision are marked for review');
select pg_temp.admin();

-- ------------------------------------------------------ visibility, no deletes ---
select pg_temp.act_as(:PLA);
select is((select count(*) from public.adsb_compliance_current), 0::bigint, 'D-125: a pilot sees no AD / SB entries');
select throws_like(format($$ insert into public.adsb_compliance (aircraft_id, document_key, document_id, applicability, status, entered_by)
                            values (%L, %L, %L, 'applicable', 'open', '10000000-0000-0000-0000-000000000007') $$,
                          :NX201, :'doc1', (select id from public.adsb_document where document_key = :'doc1' limit 1)),
  '%permission denied%', 'D-125: entries are written only through the signed functions');
select pg_temp.admin();

select throws_like(format($$ delete from public.adsb_compliance where id = %L $$, :'e1'),
  '%never deleted%', 'D-023: AD / SB entries are never deleted');
select throws_like(format($$ update public.adsb_verification set decision = 'rejected' where compliance_id = %L $$, :'e1'),
  '%append-only%', 'D-023: a verification is never edited');

select * from finish();
rollback;
