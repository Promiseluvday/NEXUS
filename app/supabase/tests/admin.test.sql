-- =============================================================================
-- Nexus MRO · Users and roles · Automatic checks of the Super Admin account
-- rules (D-030, D-033, D-035, D-121 to D-124, D-127, D-206, D-219)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set ABE_P '''10000000-0000-0000-0000-000000000003'''
\set QAR_P '''10000000-0000-0000-0000-000000000004'''

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

select pg_temp.act_as(:ZEM); select app.set_my_pin('111222'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.set_my_pin('333444'); select pg_temp.admin();
select pg_temp.act_as(:KDO); select app.set_my_pin('555666'); select pg_temp.admin();

-- ------------------------------------------------------ who may manage ---
select pg_temp.act_as(:KDO);
select is((select count(*) from app.admin_people()), 0::bigint, 'D-123: an engineer sees no account list');
select throws_like($$ select app.admin_create_account('[TEST] New Engineer', null, 'NWA', 'new.eng', 'Temp-pass-1',
                       '{"departments":{"home":"ENG"}}', 'New posting', '555666') $$,
  '%Only a Super Admin%', 'D-123: an engineer cannot create accounts');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select ok((select count(*) from app.admin_people()) > 0, 'D-035: the Engineering Super Admin sees the people they look after');
select throws_like($$ select app.admin_create_account('[TEST] New Engineer', null, 'NWA', 'new.eng', 'Temp-pass-1',
                       '{"departments":{"home":"ENG"}}', 'New posting', '000000') $$,
  '%PIN not accepted%', 'D-219: creating an account needs the Super Admin''s PIN');
select throws_like($$ select app.admin_create_account('[TEST] New Engineer', null, 'NWA', 'new.eng', 'short',
                       '{"departments":{"home":"ENG"}}', 'New posting', '333444') $$,
  '%at least 8 characters%', 'D-219: a temporary password has a minimum length (setting)');
select throws_like($$ select app.admin_create_account('[TEST] New Pilot', null, 'NWP', 'new.pilot', 'Temp-pass-1',
                       '{"departments":{"home":"OPS"}}', 'New posting', '333444') $$,
  '%Only a Super Admin for OPS%', 'D-035: the Engineering Super Admin cannot create an Operations account');
select lives_ok($$ select app.admin_create_account('[TEST] New Engineer', '[Rank]', 'nwa', 'New.Eng', 'Temp-pass-1',
                     '{"departments":{"home":"ENG"},"sections":["LINE"],"scope":{"kind":"types","types":["G550"]}}',
                     'New posting', '333444') $$,
  'D-123: the Engineering Super Admin creates an engineer account');
select throws_like($$ select app.admin_create_account('[TEST] Copy', null, 'NWB', 'new.eng', 'Temp-pass-1',
                       '{"departments":{"home":"ENG"}}', 'Copy', '333444') $$,
  '%already taken%', 'D-206: usernames are unique');
select pg_temp.admin();

select p.id as new_p, a.id as new_u from public.person p join public.user_account a on a.person_id = p.id
 where p.three_letter_code = 'NWA' \gset
select is((select status || ' ' || must_change_password::text || ' ' || username from public.user_account where id = :'new_u'),
  'active true new.eng', 'D-219: the new account is active and must set its own password');
select ok((select encrypted_password = extensions.crypt('Temp-pass-1', encrypted_password)
             from auth.users where id = :'new_u' and email = 'new.eng@users.nexus.local'),
  'D-206: the sign-in uses the username and the temporary password');
select is(app.access_summary(:'new_p', 'departments') || ' | ' || app.access_summary(:'new_p', 'scope')
            || ' | ' || app.access_summary(:'new_p', 'sections'),
  'Engineering (home) | G550 (type) | Line maintenance', 'D-121: departments, scope and sections are granted');
select is((select what from public.account_event where person_id = :'new_p'), 'Account created',
  'D-033: the creation is in the change log');

-- ------------------------------------------------------ changing access ---
select pg_temp.act_as(:ABE);
select throws_like(format($$ select app.admin_set_access(%L, 'scope', '{"kind":"all"}', 'Self', '333444') $$, :ABE_P),
  '%own account%', 'D-033: nobody changes their own account');
select throws_like(format($$ select app.admin_set_access(%L, 'scope', '{"kind":"all"}', '', '333444') $$, :'new_p'),
  '%reason%', 'D-033: every change needs a reason');
select lives_ok(format($$ select app.admin_set_access(%L, 'scope', '{"kind":"all"}', 'Moved to whole fleet', '333444') $$, :'new_p'),
  'D-121: the Super Admin changes the aircraft scope');
select pg_temp.admin();
select is((select from_value || ' -> ' || to_value from public.account_event where person_id = :'new_p' and what = 'Aircraft scope'),
  'G550 (type) -> All aircraft', 'D-033: the log records from and to');
select is((select count(*) from public.access_grant where person_id = :'new_p' and grant_type = 'aircraft_type' and revoked_at is not null),
  1::bigint, 'D-023: the old scope grant is revoked, not deleted');

select pg_temp.act_as(:ZEM);
select throws_like(format($$ select app.admin_set_access(%L, 'permissions', '["VIEW_COST"]', 'Budget work', '111222') $$, :QAR_P),
  '%Quality users cannot be given "View cost"%', 'D-127: Quality never gets View cost, even from the Commander');
select pg_temp.admin();

-- ------------------------------------------------------------ passwords ---
select pg_temp.act_as(:ABE);
select app.admin_set_status(:'new_p', 'deactivated', 'Left the unit', '333444');
select pg_temp.admin();
select is((select status from public.user_account where id = :'new_u'), 'deactivated', 'D-030: an account is deactivated, not deleted');
select pg_temp.act_as(:'new_u');
select is(app.current_person_id(), null::uuid, 'D-030: a deactivated account has no rights');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select app.admin_set_status(:'new_p', 'active', 'Returned', '333444');
select lives_ok(format($$ select app.admin_reset_password(%L, 'Reset-pass-2', 'Forgotten password', '333444') $$, :'new_p'),
  'D-219: the Super Admin resets a forgotten password to a temporary one');
select pg_temp.admin();
select ok(not exists (select 1 from public.account_event where person_id = :'new_p'
                       and concat(from_value, to_value, reason) like '%Reset-pass-2%'),
  'D-219: the password itself is never written to the log');

select pg_temp.act_as(:'new_u');
select throws_like($$ select app.set_my_password('Reset-pass-2') $$, '%different%',
  'D-219: the user must choose a new password, not the temporary one');
select lives_ok($$ select app.set_my_password('My-own-pass-3') $$, 'D-219: the user sets their own password');
select is(app.my_must_change_password(), false, 'D-219: no longer asked to change it');
select pg_temp.admin();

-- ------------------------------------------------- an account request ---
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '29999999-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
        'req.pilot@users.nexus.local', extensions.crypt('Req-pass-1', extensions.gen_salt('bf')), now(),
        '{}', '{}', now(), now(), '', '', '', '');
select pg_temp.act_as('29999999-0000-0000-0000-000000000001');
select app.request_account('[TEST] Requesting Pilot', 'req.pilot', 'RQP', 'OPS');
select pg_temp.admin();
select id as req_p from public.person where three_letter_code = 'RQP' \gset

select pg_temp.act_as(:ABE);
select throws_like(format($$ select app.admin_set_status(%L, 'active', 'Approve', '333444') $$, :'req_p'),
  '%Only a Super Admin for OPS%', 'D-123: only the requested department''s Super Admin (or the Commander) approves');
select pg_temp.admin();
select pg_temp.act_as(:ZEM);
select app.admin_set_status(:'req_p', 'active', 'Posting confirmed', '111222');
select pg_temp.admin();
select is((select status from public.user_account where person_id = :'req_p') || ' | ' || app.access_summary(:'req_p', 'departments'),
  'active | Operations (home)', 'D-123: approving gives the requested department as home');

select * from finish();
rollback;
