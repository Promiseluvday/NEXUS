-- =============================================================================
-- Nexus MRO · Sample data: parts and stores (FICTIONAL ONLY, D-112)
-- Proprietary to Liebetag. All rights reserved.
--
-- Loaded after seed.sql by `npm run db:reset`. Everything is invented:
-- part numbers look like [SAMPLE-SK-07]; certificate references are [SAMPLE].
--
--   * FSK  Forward storekeeper (new sample person): Supply, Forward Store
--          only, Issue + Receive parts. Sign in as "fsk", password nexus-dev-only.
--   * SBK  (Main Store storekeeper) also gets "Receive and inspect parts".
--   * Eight catalogue parts with stock in the Main and Forward stores,
--     including an expired batch, an uncertified batch and two quarantined
--     items, so the flags and alerts show (D-072, D-148).
--   * A reserved part request, a transfer in transit, a receipt waiting for
--     inspection and an expected U/S return, all made through the real
--     functions so every rule and ledger line applies.
-- =============================================================================

-- ---------------------------------------------------- Forward storekeeper -----
insert into public.person (id, full_name, rank_or_title, service_number, three_letter_code)
values ('10000000-0000-0000-0000-0000000000d1', '[Forward storekeeper]', '[Rank]', 'SN-00D1', 'FSK')
on conflict do nothing;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-0000000000d1', 'authenticated',
        'authenticated', 'fsk@users.nexus.local', extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u
 where u.id = '20000000-0000-0000-0000-0000000000d1'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into public.user_account (id, person_id, status, activated_at, activated_by, username)
values ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 'active', now(),
        '10000000-0000-0000-0000-000000000002', 'fsk')
on conflict do nothing;

-- Grants made by the Commander (ZEM). Only added if not already held.
insert into public.access_grant (person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
select v.* from (values
  ('10000000-0000-0000-0000-0000000000d1'::uuid, 'department', 'SUP', true,  null,            null,  'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000d1'::uuid, 'store',      null,  false, null,            'FWD', 'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000d1'::uuid, 'permission', null,  false, 'ISSUE_PARTS',   null,  'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000d1'::uuid, 'permission', null,  false, 'RECEIVE_PARTS', null,  'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000008'::uuid, 'permission', null,  false, 'RECEIVE_PARTS', null,  'Receiving inspection (D-074)', '10000000-0000-0000-0000-000000000002'::uuid)
) as v(person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
where not exists (select 1 from public.access_grant g
                   where g.person_id = v.person_id and g.grant_type = v.grant_type and g.revoked_at is null
                     and g.department_code is not distinct from v.department_code
                     and g.permission_code is not distinct from v.permission_code
                     and g.store_code is not distinct from v.store_code);

-- --------------------------------------------------------------- catalogue -----
insert into public.part (part_number, description, part_class, unit, shelf_life_tracked, serialised) values
  ('[SAMPLE-SK-07]', '[SAMPLE] Seal kit',              'consumable', 'EA', true,  false),
  ('[SAMPLE-SL-03]', '[SAMPLE] Sealant',               'consumable', 'EA', true,  false),
  ('[SAMPLE-HP-01]', '[SAMPLE] Hydraulic pump',        'component',  'EA', false, true),
  ('[SAMPLE-BW-05]', '[SAMPLE] Brake wear pin',        'component',  'EA', false, false),
  ('[SAMPLE-FL-02]', '[SAMPLE] Oil filter element',    'consumable', 'EA', false, false),
  ('[SAMPLE-OR-11]', '[SAMPLE] O-ring',                'consumable', 'EA', true,  false),
  ('[SAMPLE-LP-04]', '[SAMPLE] Reading light lamp',    'consumable', 'EA', false, false),
  ('[SAMPLE-VB-09]', '[SAMPLE] Outflow valve',         'component',  'EA', false, true)
on conflict do nothing;

-- ---------------------------------------------------------- opening stock -----
-- Each lot gets an "opening balance" ledger line; the ledger sets its quantity.
with lots (pn, store, qty, serial, batch, bin, expiry, cert, cond, reason) as (values
  ('[SAMPLE-SK-07]', 'MAIN', 2, null,              'B-SK-01', '[SAMPLE-B4]',  current_date + 4,   'valid',   'serviceable', null),
  ('[SAMPLE-SK-07]', 'FWD',  1, null,              'B-SK-01', '[SAMPLE-F1]',  current_date + 4,   'valid',   'serviceable', null),
  ('[SAMPLE-SL-03]', 'MAIN', 4, null,              'B-SL-07', '[SAMPLE-B7]',  current_date + 9,   'valid',   'serviceable', null),
  ('[SAMPLE-SL-03]', 'FWD',  1, null,              'B-SL-07', '[SAMPLE-F2]',  current_date + 9,   'valid',   'serviceable', null),
  ('[SAMPLE-FL-02]', 'MAIN', 10, null,             'B-FL-02', '[SAMPLE-C1]',  null,               'valid',   'serviceable', null),
  ('[SAMPLE-FL-02]', 'FWD',  3, null,              'B-FL-02', '[SAMPLE-F3]',  null,               'valid',   'serviceable', null),
  ('[SAMPLE-OR-11]', 'MAIN', 5, null,              'B-OR-03', '[SAMPLE-A2]',  current_date - 3,   'valid',   'serviceable', null),
  ('[SAMPLE-LP-04]', 'MAIN', 6, null,              'B-LP-01', '[SAMPLE-D5]',  null,               'missing', 'serviceable', null),
  ('[SAMPLE-VB-09]', 'MAIN', 1, '[SAMPLE]-VB-2207', null,     '[SAMPLE-R1]',  null,               'valid',   'serviceable', null),
  ('[SAMPLE-HP-01]', 'MAIN', 1, '[SAMPLE]-HP-0412', null,     '[SAMPLE-Q1]',  null,               'missing', 'quarantine',  'Certificate missing'),
  ('[SAMPLE-BW-05]', 'MAIN', 2, null,              'B-BW-05', '[SAMPLE-Q2]',  null,               'missing', 'quarantine',  'Certificate missing')
),
made as (
  insert into public.stock_lot (part_id, store_code, serial_no, batch_no, bin, condition, condition_reason,
                                condition_set_by, condition_set_at, certificate_status, certificate_type,
                                certificate_ref, shelf_life_expires_on, source)
  select p.id, l.store, l.serial, l.batch, l.bin, l.cond, l.reason,
         case when l.reason is not null then '10000000-0000-0000-0000-000000000008'::uuid end,
         case when l.reason is not null then now() - interval '7 days' end,
         l.cert, case when l.cert = 'valid' then 'EASA Form 1' end,
         case when l.cert = 'valid' then '[SAMPLE]-F1-' || l.bin end, l.expiry, 'opening_balance'
    from lots l join public.part p on p.part_number = l.pn
  returning id, part_id, store_code
)
insert into public.stock_movement (lot_id, part_id, store_code, kind, qty, on_hand_change, reason, done_by)
select m.id, m.part_id, m.store_code, 'opening_balance', l.qty, l.qty, 'Opening balance (sample)',
       '10000000-0000-0000-0000-000000000008'
  from made m join public.part p on p.id = m.part_id
  join lots l on l.pn = p.part_number and l.store = m.store_code;

-- ------------------------------------------- activity through the functions -----
-- Acting as a person: the functions read who is signed in from these claims.
-- KDO: a seal kit for NX-202 door seal work (consumable, General use) → reserved.
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000005","role":"authenticated"}', false);
select app.request_part('consumable', 'MAIN', 1, (select id from public.part where part_number = '[SAMPLE-SK-07]'),
                        p_aircraft => '40000000-0000-0000-0000-000000000202',
                        p_purpose => '[SAMPLE] Cabin door seal inspection', p_priority => 'URGENT');
-- KDO: removed an outflow valve U/S from NX-201; expected at the Main Store.
select app.record_us_removal('40000000-0000-0000-0000-000000000201',
                             (select id from public.part where part_number = '[SAMPLE-VB-09]'), null,
                             '[SAMPLE]-VB-1180', '[SAMPLE] Valve sticking, removed U/S', 'MAIN');

-- SBK: one sealant to the Forward Store (in transit), and a delivery of brake
-- wear pins waiting for receiving inspection (documents not attached yet).
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000008","role":"authenticated"}', false);
select app.raise_transfer((select id from public.part where part_number = '[SAMPLE-SL-03]'), 'MAIN', 'FWD', 1);
select app.open_receipt('MAIN', (select id from public.part where part_number = '[SAMPLE-BW-05]'), 4,
                        p_batch => 'B-BW-06', p_delivered_against => '[SAMPLE] PO-0021');

select set_config('request.jwt.claims', '', false);
