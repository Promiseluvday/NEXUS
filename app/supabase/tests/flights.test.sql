-- =============================================================================
-- Nexus MRO · Phase 2 · Automatic checks of the flight record rules
-- (D-020 to D-024, D-027, D-103, D-105, D-121, D-122, D-125)
-- Proprietary to Liebetag. All rights reserved.
-- Uses its own fictional tail NX-299 so the sample flights do not matter.
-- Everything runs inside a transaction that is rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set PLA '''20000000-0000-0000-0000-000000000007'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set FAO '''20000000-0000-0000-0000-000000000009'''
\set NX101 '''40000000-0000-0000-0000-000000000101'''
\set TAIL '''40000000-0000-0000-0000-000000000299'''
\set REF '''70000000-0000-0000-0000-0000000000a1'''

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

-- A test tail of the G550 type (in scope for KDO and PLA).
insert into public.aircraft (id, tail, aircraft_type_code, msn) values (:TAIL, 'NX-299', 'G550', '[TEST-0299]');
select pg_temp.act_as(:KDO); select app.set_my_pin('555666'); select pg_temp.admin();

-- ------------------------------------------------------------- baseline ---
select pg_temp.act_as(:PLA);
select throws_like(format($$ select app.set_flight_baseline(%L, current_date - 30, 1000.0, 400, 402, 'Paper logbook', '555666') $$, :TAIL),
  '%Only Engineering%', 'D-027: a pilot cannot enter brought-forward totals');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.set_flight_baseline(%L, current_date - 30, 1000.0, 400, 402, '', '555666') $$, :TAIL),
  '%reason%', 'D-027: brought-forward totals need a reason');
select throws_like(format($$ select app.set_flight_baseline(%L, current_date - 30, 1000.0, 400, 402, 'Paper logbook', '000000') $$, :TAIL),
  '%PIN not accepted%', 'D-094: brought-forward totals need the engineer''s PIN');
select lives_ok(format($$ select app.set_flight_baseline(%L, current_date - 30, 1000.0, 400, 402,
                         '[TEST] From the paper aircraft logbook', '555666', 120.5, 300) $$, :TAIL),
  'D-022: Engineering enters the brought-forward totals');
select throws_like(format($$ select app.set_flight_baseline(%L, current_date - 20, 1.0, 1, 1, 'Again', '555666') $$, :TAIL),
  '%already has brought-forward totals%', 'D-023: a second baseline is refused; it is corrected instead');
select pg_temp.admin();

-- ---------------------------------------------------------- logging ---
select pg_temp.act_as(:PLA);
select throws_like(format($$ select app.log_flight(%L, current_date - 31, 1.0, 1, 1) $$, :TAIL),
  '%already in them%', 'D-022: a flight on or before the brought-forward date is refused (no double counting)');
select lives_ok(format($$ select app.log_flight(%L, current_date - 2, 2.4, 1, 1, 'XNAA', 'XNBB', 'TLB 12/045',
                         0.9, 1, %L, '2001-01-01 10:00+00') $$, :TAIL, :REF),
  'D-027: a pilot logs a flight on a tail in scope');
select is(app.log_flight(:TAIL, current_date - 2, 2.4, 1, 1, 'XNAA', 'XNBB', 'TLB 12/045', 0.9, 1, :REF, '2001-01-01 10:00+00'),
  (select id from public.flight_record where client_ref = :REF),
  'D-103: the same offline entry sent twice returns the first record');
select pg_temp.admin();
select is((select count(*) from public.flight_record where aircraft_id = :TAIL and kind = 'flight'), 1::bigint,
  'D-103: ... and creates only one record');
select ok((select created_at > '2020-01-01' and entered_at > '2020-01-01' and device_time = '2001-01-01 10:00+00'
             from public.flight_record where client_ref = :REF),
  'D-024: server time is recorded; the device time is kept alongside');
select is((select p.three_letter_code || ' ' || f.hours_basis from public.flight_record f join public.person p on p.id = f.entered_by
            where f.client_ref = :REF), 'PLA flight',
  'D-027, D-025: the entry carries who entered it and the hours basis setting');

select pg_temp.act_as(:KDO);
select lives_ok(format($$ select app.log_flight(%L, current_date - 1, 5.1, 2, 2) $$, :TAIL),
  'D-027: an engineer logs a flight');
select throws_like(format($$ select app.log_flight(%L, current_date - 1, 1.0, 1, 1) $$, :NX101),
  '%outside your aircraft scope%', 'D-121: no flight records outside the aircraft scope');
select throws_like(format($$ select app.log_flight(%L, current_date + 3, 1.0, 1, 1) $$, :TAIL),
  '%in the future%', 'A flight cannot be dated in the future');
select throws_like(format($$ select app.log_flight(%L, current_date - 1, 25.0, 1, 1) $$, :TAIL),
  '%more than 24 hours%', 'One flight entry is at most 24 hours');
select throws_like(format($$ select app.log_flight(%L, current_date - 1, 0, 0, 0) $$, :TAIL),
  '%Enter the hours%', 'An empty flight entry is refused');
select pg_temp.admin();

select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.log_flight(%L, current_date - 1, 1.0, 1, 1) $$, :TAIL),
  '%pilots (Operations) and Engineering%', 'D-027: Supply cannot enter flight records');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.log_flight(%L, current_date - 1, 1.0, 1, 1) $$, :TAIL),
  '%pilots (Operations) and Engineering%', 'D-122: Quality sees everything but enters no flights');
select pg_temp.admin();

select pg_temp.act_as(:PLA);
select throws_like(format($$ insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, hours, hours_basis, cycles, landings, entered_by)
                             values (%L, %L, 'flight', %L, current_date, 1, 'flight', 1, 1, '10000000-0000-0000-0000-000000000007') $$,
                           '70000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-0000000000b1', :TAIL),
  '%permission denied%', 'D-125: records are only written through the checked actions');
select pg_temp.admin();

-- ---------------------------------------------------------- totals ---
select pg_temp.act_as(:KDO);
select is((select hours::text || ' ' || cycles || ' ' || landings || ' ' || apu_hours::text || ' ' || apu_cycles || ' ' || flights
             from app.aircraft_totals(:TAIL)),
  '1007.5 403 405 121.4 301 2', 'D-022: totals are baseline plus the sum of entered flights');
select pg_temp.admin();

-- ------------------------------------------------------- corrections ---
select id as orig from public.flight_record where client_ref = :REF \gset
select pg_temp.act_as(:PLA);
select throws_like(format($$ select app.correct_flight_record(%L, current_date - 2, 2.6, 1, 1, 'Typo', '555666') $$, :'orig'),
  '%Only Engineering%', 'D-027: a pilot cannot correct a flight record');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.correct_flight_record(%L, current_date - 2, 2.6, 1, 1, ' ', '555666') $$, :'orig'),
  '%reason%', 'D-027: a correction needs a reason');
select lives_ok(format($$ select app.correct_flight_record(%L, current_date - 2, 2.6, 1, 1,
                         'Tech log page 12/045 reads 2.6 h', '555666', 'XNAA', 'XNBB', 'TLB 12/045', 0.9, 1) $$, :'orig'),
  'D-027: Engineering corrects a flight record');
select pg_temp.admin();
select is((select string_agg(version || ':' || hours::text, ',' order by version) from public.flight_record where record_id = :'orig'),
  '1:2.4,2:2.6', 'D-023: the correction is a new version; the original is kept unchanged');
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.correct_flight_record(%L, current_date - 2, 3.0, 1, 1, 'Again', '555666') $$, :'orig'),
  '%already corrected by KDO%', 'D-105: an old version cannot be corrected again; the newest one is corrected');
select is((select hours::text from app.aircraft_totals(:TAIL)), '1007.7',
  'D-022: totals use the newest version of each record');

-- Entered on the wrong tail: corrected as "entered in error", then counts for nothing.
select id as kdo_flight from public.flight_record_current where aircraft_id = :TAIL and kind = 'flight' and hours = 5.1 \gset
select lives_ok(format($$ select app.correct_flight_record(%L, current_date - 1, 0, 0, 0, '[TEST] Entered on the wrong tail',
                         '555666', p_void => true) $$, :'kdo_flight'),
  'D-023: a wrong entry is voided by a new version, not deleted');
select is((select hours::text || ' ' || cycles || ' ' || landings || ' ' || flights from app.aircraft_totals(:TAIL)),
  '1002.6 401 403 1', 'D-022: a voided record no longer counts');
select id as base from public.flight_record_current where aircraft_id = :TAIL and kind = 'baseline' \gset
select throws_like(format($$ select app.correct_flight_record(%L, current_date, 1000.0, 400, 402, 'Later date', '555666') $$, :'base'),
  '%dated on or before%', 'D-022: the brought-forward date cannot move past logged flights');
select is((select last_entered_by from app.aircraft_totals(:TAIL)), 'KDO',
  'Totals show who entered the last record');
select pg_temp.admin();

-- ------------------------------------------------------------ who sees ---
select pg_temp.act_as(:FAO);
select ok((select count(*) from app.fleet_totals() where aircraft_id = :TAIL) = 1
          and (select count(*) from public.flight_record where aircraft_id = :TAIL) = 0,
  'D-120, D-125: Procurement sees the totals but not the flight records behind them');
select pg_temp.admin();

-- ------------------------------------------------------- append-only ---
select throws_like(format($$ update public.flight_record set hours = 9 where id = %L $$, :'orig'),
  '%append-only%', 'D-023: a flight record is never edited');
select throws_like(format($$ delete from public.flight_record where id = %L $$, :'orig'),
  '%never deleted%', 'D-023: a flight record is never deleted');

select * from finish();
rollback;
