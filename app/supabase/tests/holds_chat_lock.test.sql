-- =============================================================================
-- Nexus MRO · Automatic checks: account lock, closing queries, "in hand"
-- holds and case chat (Promise, 14 and 16 Oct; D-232, D-237)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set PLA '''20000000-0000-0000-0000-000000000007'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set KDO_P '''10000000-0000-0000-0000-000000000005'''
\set NX201 '''40000000-0000-0000-0000-000000000201'''

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
create function pg_temp.attempt(p_user uuid, p_valid boolean) returns text language sql as $$
  select public.hook_password_verification_attempt(jsonb_build_object('user_id', p_user, 'valid', p_valid)) ->> 'decision';
$$;

select pg_temp.act_as(:ABE); select app.set_my_pin('2222'); select pg_temp.admin();
select pg_temp.act_as(:KDO); select app.set_my_pin('1357'); select pg_temp.admin();

-- ------------------------------------------------------- account lock ---
select is(pg_temp.attempt(:KDO, false), 'continue', 'A wrong password is counted');
select pg_temp.attempt(:KDO, false); select pg_temp.attempt(:KDO, false); select pg_temp.attempt(:KDO, false);
select is(pg_temp.attempt(:KDO, true), 'continue', 'A right password before the limit resets the count');
select is((select failed_sign_ins from public.user_account where id = :KDO), 0, 'The count is back to zero');
select pg_temp.attempt(:KDO, false); select pg_temp.attempt(:KDO, false); select pg_temp.attempt(:KDO, false);
select pg_temp.attempt(:KDO, false);
select is(pg_temp.attempt(:KDO, false), 'reject', 'The fifth wrong password in a row locks the account');
select is(pg_temp.attempt(:KDO, true), 'reject', 'Once locked, even the right password is refused');
select is((select count(*) from public.account_event where person_id = :KDO_P and what = 'Account locked'), 1::bigint,
  'The lock is in the change log');
select pg_temp.act_as(:QAR);
select throws_like(format($$ select app.admin_unlock_account(%L, 'x', '1111') $$, :KDO_P), '%Super Admin%',
  'Only a Super Admin unlocks');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select ok((app.admin_lock_state(:KDO_P) ->> 'locked_at') is not null, 'The Super Admin sees the lock');
select lives_ok(format($$ select app.admin_unlock_account(%L, 'Identity confirmed by phone', '2222') $$, :KDO_P),
  'The Super Admin unlocks with reason and PIN');
select pg_temp.admin();
select is(pg_temp.attempt(:KDO, true), 'continue', 'After unlocking, the right password works');
select is((select count(*) from public.account_event where person_id = :KDO_P and what = 'Account unlocked'), 1::bigint,
  'The unlock is in the change log');

-- ------------------------------------------------------ closing queries ---
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Cabin PA crackles', false, '23-31');
select pg_temp.admin();
select id as s1 from public.snag where description = '[TEST] Cabin PA crackles' \gset
select pg_temp.act_as(:KDO);
insert into public.technical_query (record_table, record_id, subject, body, assigned_department, raised_by, number)
values ('snag', :'s1', 'PA amplifier part number?', 'Which amplifier dash number?', 'QUA', :KDO_P, 'x');
insert into public.technical_query (record_table, record_id, subject, body, assigned_department, raised_by, number)
values ('snag', :'s1', 'Second question', 'Wiring diagram reference?', 'QUA', :KDO_P, 'x');
select pg_temp.admin();
select id as q1 from public.technical_query where subject = 'PA amplifier part number?' \gset
select pg_temp.act_as(:QAR);
select lives_ok(format($$ update public.technical_query set status = 'closed' where id = %L $$, :'q1'),
  'Someone other than the raiser closes a query');
select pg_temp.admin();
select is((select p.three_letter_code from public.technical_query q join public.person p on p.id = q.closed_by where q.id = :'q1'),
  'QAR', 'Who closed it is recorded');
-- Closing the case closes the rest.
select pg_temp.act_as(:KDO);
select app.attend_snag(:'s1', 'Amplifier noisy');
select app.request_work_order(:'s1', 'Replace PA amplifier', 1) as wo1 \gset
select pg_temp.admin();
update public.snag set status = 'closed', closed_by = :KDO_P, closed_at = now(), closure_note = 'test' where id = :'s1';
select is((select status || ' / ' || closed_reason from public.technical_query where subject = 'Second question'),
  'closed / Closed automatically: ' || (select number from public.snag where id = :'s1') || ' closed',
  'An open query closes automatically when its case closes');

-- ------------------------------------------------------------- holds ---
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Lav flush weak', false, '38-31');
select pg_temp.admin();
select id as s2 from public.snag where description = '[TEST] Lav flush weak' \gset
select pg_temp.act_as(:KDO);
select is((app.take_case('snag', :'s2') ->> 'mine')::boolean, true, 'The first engineer takes the case in hand');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select is(app.take_case('snag', :'s2') ->> 'held_by', 'KDO', 'A second engineer is told KDO has it in hand');
select is((select count(*) from public.case_hold where record_id = :'s2' and released_at is null), 1::bigint,
  'The second engineer does not take it');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select is(app.take_case('snag', :'s2') ->> 'held_by', null, 'Another department (Quality) is not blocked');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.force_release_case('snag', %L, 'x') $$, :'s2'), '%Super Admin or Command%',
  'An engineer cannot release someone else''s hold');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select is(app.force_release_case('snag', :'s2', 'KDO off shift'), 1, 'A Super Admin releases the hold with a reason');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select is((app.take_case('snag', :'s2') ->> 'mine')::boolean, true, 'Then the next engineer can take it');
select app.release_case('snag', :'s2');
select pg_temp.admin();
select is((select count(*) from public.case_hold where record_id = :'s2' and released_at is null), 0::bigint,
  'Leaving the page releases the hold');
-- An old hold times out.
update public.case_hold set released_at = null, seen_at = now() - interval '2 hours'
 where record_id = :'s2' and held_by = (select person_id from public.user_account where id = :TMB);
select pg_temp.act_as(:KDO);
select is((app.take_case('snag', :'s2') ->> 'mine')::boolean, true, 'A hold not refreshed for 30 minutes no longer blocks');
select pg_temp.admin();

-- ---------------------------------------------------------- case chat ---
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.post_case_message('snag', %L, 'KDO, are you on the lav flush?') $$, :'s2'),
  'An engineer posts on the case');
select pg_temp.admin();
select is((select count(*) from public.case_message where record_id = :'s2' and kind = 'system'), 1::bigint,
  'The release is noted in the case chat');
-- (Inside one test transaction every time is the same; move KDO's "read up to" back.)
update public.case_message_read set last_read_at = now() - interval '1 minute' where person_id = :KDO_P;
select pg_temp.act_as(:KDO);
select ok(app.my_unread_messages() >= 1, 'KDO, who has the case in hand, sees the new message counted');
select is((select count(*) from app.case_messages('snag', :'s2') where author = 'TMB'), 1::bigint, 'KDO reads the thread');
select is((select coalesce(sum(unread), 0) from app.my_case_threads() where record_id = :'s2'), 0::bigint,
  'Reading the thread clears the count');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.post_case_message('snag', %L, 'hello') $$, :'s2'), '%not in your view%',
  'Someone who cannot see the snag (Supply) cannot post on it');
select throws_like(format($$ insert into public.case_message (record_table, record_id, body) values ('snag', %L, 'x') $$, :'s2'),
  '%row-level security%', 'Nor by writing to the table directly');
select pg_temp.admin();
select throws_like($$ update public.case_message set body = 'x' $$, '%append-only%', 'A message is never edited');

select * from finish();
rollback;
