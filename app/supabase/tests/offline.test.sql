-- =============================================================================
-- Nexus MRO · Phase 1C · Automatic checks of provisional offline signing (D-217)
-- Proprietary to Liebetag. All rights reserved.
--
-- The tests play the tablet: they build the signed text and its signature
-- the same way the tablet does (HMAC-SHA256 with the person's key), then send
-- it as the user would when the connection returns.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set NX202 '''40000000-0000-0000-0000-000000000202'''

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

-- What the tablet signs, and the signature (run as admin: reads the server key).
create function pg_temp.payload(p_user uuid, p_device uuid, p_action text, p_args jsonb,
                                p_signed timestamptz default now()) returns text language sql as $$
  select jsonb_build_object('v', 1, 'device', p_device, 'user', p_user, 'action', p_action, 'args', p_args,
                            'signed_at', p_signed, 'clock', 'server+elapsed', 'device_time', p_signed,
                            'nonce', gen_random_uuid())::text $$;
create function pg_temp.sign(p_payload text, p_user uuid, p_device uuid) returns text language sql as $$
  select encode(extensions.hmac(convert_to(p_payload, 'UTF8'),
           (select key from app.offline_key where user_id = p_user and device_id = p_device), 'sha256'), 'hex') $$;

-- ------------------------------------------------------------ enrolment
select pg_temp.act_as(:TMB);
select app.request_device('[TEST] Line tablet 1') as dev1 \gset
select throws_like(format($$ select app.enrol_device(%L) $$, :'dev1'),
  '%Only a Super Admin%', 'D-217: an engineer cannot enrol a tablet');
select throws_like(format($$ select app.issue_offline_key(%L, '2468') $$, :'dev1'),
  '%waiting for a Super Admin%', 'D-217: no offline key before the tablet is enrolled');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select lives_ok(format($$ select app.enrol_device(%L) $$, :'dev1'), 'D-217: the Engineering Super Admin enrols the tablet');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select app.set_my_pin('2468');
select throws_like(format($$ select app.issue_offline_key(%L, '2468') $$, :'dev1'),
  '%at least 6 digits%', 'D-217 (b): offline signing needs a 6-digit PIN');
select app.set_my_pin('246813');
select throws_like(format($$ select app.issue_offline_key(%L, '111111') $$, :'dev1'),
  '%PIN not accepted%', 'D-094: the offline key is only issued with the right PIN');
select matches(app.issue_offline_key(:'dev1', '246813'), '^[0-9a-f]{64}$',
  'D-217: the key is handed over once, as 64 hex characters');

-- A snag to work on, reported and attended online.
select app.report_snag(:NX202, '[TEST] Offline: cabin pressure indicator flickers', false, '21-31');
select pg_temp.admin();
select id as snag1 from public.snag where description = '[TEST] Offline: cabin pressure indicator flickers' \gset
select pg_temp.act_as(:TMB); select app.attend_snag(:'snag1'); select pg_temp.admin();
select i.id as item_c from public.mel_item i join public.mel_revision r on r.id = i.revision_id
 where r.status = 'active' and r.aircraft_type_code = 'G550' and i.item_number = '21-31-01' \gset

-- ------------------------------------------------ a genuine offline signature
select pg_temp.payload(:TMB, :'dev1', 'apply_mel', jsonb_build_object(
  'p_snag', :'snag1', 'p_mel_item', :'item_c', 'p_m_done', true, 'p_o_passed', true,
  'p_placard_fitted', true, 'p_set_svc_mel', true)) as pay1 \gset
select pg_temp.sign(:'pay1', :TMB, :'dev1') as sig1 \gset

select pg_temp.act_as(:TMB);
select is((app.submit_offline_signature(:'pay1', :'sig1') ->> 'ok'), 'true',
  'D-217: a genuine offline MEL deferral is accepted on sync');
select is((app.submit_offline_signature(:'pay1', :'sig1') ->> 'repeat'), 'true',
  'D-217: sending the same signature again changes nothing');
select pg_temp.admin();
select is((select status from public.snag where id = :'snag1'), 'deferred', 'D-217: the snag is deferred');
select is((select count(*)::integer from public.ddls_entry where snag_id = :'snag1'), 1,
  'D-217: exactly one DDLS entry, even after the re-send');
select is((select status from public.aircraft_current_status where aircraft_id = :NX202), 'SVC_MEL',
  'D-216/D-217: the ticked SVC · MEL is recorded with the offline signature');
select is((select status || ' ' || coalesce(clock_kind, '') from public.offline_signature where payload = :'pay1'),
  'accepted server+elapsed', 'D-217 (f): the signature is kept with its clock source');

-- ------------------------------------------------------------ refusals
-- Altered after signing (or signed with a wrong PIN): signature does not match.
select pg_temp.payload(:TMB, :'dev1', 'set_tail_status', jsonb_build_object(
  'p_aircraft', :NX202, 'p_status', 'SVC', 'p_reason', '[TEST] offline')) as pay2 \gset
select pg_temp.act_as(:TMB);
select is((app.submit_offline_signature(:'pay2', repeat('0', 64)) ->> 'ok'), 'false',
  'D-217: a signature that does not match is refused');
select pg_temp.admin();

-- The record changed before the signature arrived (D-105).
select pg_temp.payload(:TMB, :'dev1', 'close_snag_no_fault_found', jsonb_build_object(
  'p_snag', :'snag1', 'p_findings', '[TEST] nothing found')) as pay3 \gset
select pg_temp.sign(:'pay3', :TMB, :'dev1') as sig3 \gset
select pg_temp.act_as(:TMB);
select matches(app.submit_offline_signature(:'pay3', :'sig3') ->> 'reason', 'Snag .* is deferred.*',
  'D-105: an offline signature on a record that has moved on is refused, with the reason');
select pg_temp.admin();

-- Approvals are online only.
select pg_temp.payload(:TMB, :'dev1', 'decide_approval', jsonb_build_object('p_request', gen_random_uuid())) as pay4 \gset
select pg_temp.sign(:'pay4', :TMB, :'dev1') as sig4 \gset
select pg_temp.act_as(:TMB);
select matches(app.submit_offline_signature(:'pay4', :'sig4') ->> 'reason', '.*cannot be signed offline.*',
  'D-217: approvals cannot be signed offline');
select pg_temp.admin();

-- Older than the offline window.
select pg_temp.payload(:TMB, :'dev1', 'set_tail_status', jsonb_build_object(
  'p_aircraft', :NX202, 'p_status', 'US', 'p_reason', '[TEST] old'), now() - interval '80 hours') as pay5 \gset
select pg_temp.sign(:'pay5', :TMB, :'dev1') as sig5 \gset
select pg_temp.act_as(:TMB);
select matches(app.submit_offline_signature(:'pay5', :'sig5') ->> 'reason', '.*offline window.*',
  'D-217 (d): a signature outside the 72-hour window is refused');
select pg_temp.admin();

-- Somebody else's signature sent from another account.
select pg_temp.act_as(:KDO);
select is((app.submit_offline_signature(:'pay3', :'sig3') ->> 'ok'), 'false',
  'D-217: a signature is only accepted from the person who made it');
select pg_temp.admin();

-- Who can read the list of offline signatures.
select pg_temp.act_as(:QAR);
select ok((select count(*) from public.offline_signature) >= 5, 'D-217 (f): Quality sees every offline signature');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is((select count(*)::integer from public.offline_signature), 0, 'D-120: Supply does not');
select pg_temp.admin();

-- A tablet reported lost.
select pg_temp.act_as(:ABE);
select lives_ok(format($$ select app.revoke_device(%L, '[TEST] Left on the apron, missing', true) $$, :'dev1'),
  'D-217 (e): a Super Admin reports the tablet lost');
select pg_temp.admin();
select pg_temp.payload(:TMB, :'dev1', 'set_tail_status', jsonb_build_object(
  'p_aircraft', :NX202, 'p_status', 'SVC', 'p_reason', '[TEST] after loss')) as pay6 \gset
select pg_temp.sign(:'pay6', :TMB, :'dev1') as sig6 \gset
select pg_temp.act_as(:TMB);
select matches(app.submit_offline_signature(:'pay6', :'sig6') ->> 'reason', '.*reported lost.*',
  'D-217 (e): nothing more is accepted from a lost tablet');
select pg_temp.admin();

-- Three bad signatures block a tablet.
select pg_temp.act_as(:TMB);
select app.request_device('[TEST] Line tablet 2') as dev2 \gset
select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.enrol_device(:'dev2'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.issue_offline_key(:'dev2', '246813'); select pg_temp.admin();
select pg_temp.act_as(:TMB);
select app.submit_offline_signature(pg_temp.payload(:TMB, :'dev2', 'set_tail_status', '{}'), repeat('1', 64));
select app.submit_offline_signature(pg_temp.payload(:TMB, :'dev2', 'set_tail_status', '{}'), repeat('2', 64));
select app.submit_offline_signature(pg_temp.payload(:TMB, :'dev2', 'set_tail_status', '{}'), repeat('3', 64));
select pg_temp.admin();
select ok((select blocked_at is not null from public.device where id = :'dev2'),
  'D-217: three bad signatures block the tablet');
select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.issue_offline_key(%L, '246813') $$, :'dev2'),
  '%blocked%', 'D-217: a blocked tablet cannot be given a new key');
select pg_temp.admin();

select * from finish();
rollback;
