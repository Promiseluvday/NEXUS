-- =============================================================================
-- Nexus MRO · Phase 1C · 0023 Provisional offline signing (D-217)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (full design: workflows/offline-signing.md):
--
--   DEVICES. A line tablet asks to be enrolled; a Super Admin of Engineering
--   (or the Commander) enrols it. Only enrolled tablets may sign offline
--   (Q-OS1). A tablet can be revoked, or reported LOST.
--
--   OFFLINE KEY. While online, an engineer with a 6-digit PIN switches on
--   offline signing on an enrolled tablet. The server makes a random personal
--   key for that person on that tablet, keeps a copy, and hands it over once.
--   The tablet stores it mixed with a value made from the PIN, so the tablet
--   itself can never confirm whether a PIN guess is right.
--
--   OFFLINE SIGNATURE. Offline, the tablet signs the exact text of the action
--   ("apply MEL item X to snag Y, (M) done, placard fitted...") with the key.
--   When the connection returns, the server:
--     1. checks the signature with its copy of the key (wrong → counted;
--        three wrong from one tablet blocks the tablet)
--     2. refuses tablets that are revoked, lost or blocked
--     3. refuses signatures older than the offline limit (72 hours, Q-OS2)
--     4. runs the action exactly as if it were signed online, with the
--        certifying authorization checked AT THE TIME OF SIGNING; if the
--        record changed meanwhile, the action is refused (D-105)
--   Every attempt, accepted or refused, is kept for Quality (D-217 (f)).
--   Approvals, privileges and set-up stay online only (D-217).
-- =============================================================================

-- --------------------------------------------------------------- settings
insert into public.operator_setting (key, value, reason) values
  ('offline.max_hours',      '72', 'Offline signing limit since last contact (D-217, Q-OS2)'),
  ('offline.min_pin_length', '6',  'Minimum PIN length to sign offline (D-217 (b))'),
  ('offline.max_bad_signatures', '3', 'Bad offline signatures before a tablet is blocked (D-217)')
on conflict do nothing;

-- ---------------------------------------------------------------- devices
create table public.device (
  id               uuid primary key default gen_random_uuid(),
  label            text not null check (length(trim(label)) > 0),
  status           text not null default 'pending' check (status in ('pending', 'enrolled', 'revoked')),
  requested_by     uuid not null references public.person (id),
  requested_at     timestamptz not null default now(),
  enrolled_by      uuid references public.person (id),
  enrolled_at      timestamptz,
  revoked_by       uuid references public.person (id),
  revoked_at       timestamptz,
  revoke_reason    text,
  reported_lost_at timestamptz,
  blocked_at       timestamptz,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  constraint revoke_recorded check (status <> 'revoked' or (revoked_by is not null and length(trim(coalesce(revoke_reason, ''))) > 0))
);
comment on table public.device is 'Line tablets allowed to sign offline once enrolled (D-217, Q-OS1).';
select app.apply_standard_rules('public.device');

-- Offline keys never leave the app schema (not reachable through the API).
create table app.offline_key (
  user_id       uuid not null references public.user_account (id),
  device_id     uuid not null references public.device (id),
  key           bytea not null,
  issued_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, device_id)
);
comment on table app.offline_key is 'Per user and tablet offline signing key (D-217). Server copy for checking.';

create table public.offline_signature (
  id            uuid primary key default gen_random_uuid(),
  nonce         uuid not null unique,                 -- each signature once only
  device_id     uuid references public.device (id),
  user_id       uuid not null,
  person_id     uuid references public.person (id),
  action        text not null,
  args          jsonb not null default '{}',
  payload       text not null,                        -- the exact text that was signed
  signature     text not null,
  signed_at     timestamptz,                          -- the tablet's best estimate
  clock_kind    text,                                 -- 'server+elapsed' or 'device+offset'
  device_time   timestamptz,
  received_at   timestamptz not null default now(),   -- server time (D-024)
  status        text not null default 'verifying' check (status in ('verifying', 'accepted', 'rejected')),
  reason        text,
  record_table  text,
  record_id     uuid,
  result        text,
  created_at    timestamptz not null default now(),
  created_by    uuid
);
comment on table public.offline_signature is 'Every offline signature received, accepted or refused (D-217). For Quality review.';
select app.apply_standard_rules('public.offline_signature');

-- ------------------------------------------------------- device lifecycle
create or replace function app.request_device(p_label text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if app.current_person_id() is null then
    raise exception 'Only an active, signed-in user can register a tablet.' using errcode = '42501';
  end if;
  insert into public.device (label, requested_by) values (p_label, app.current_person_id()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function app.enrol_device(p_device uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.device;
begin
  if not (app.is_super_admin('ENG') or app.is_global_super_admin()) then
    raise exception 'Only a Super Admin of Engineering can enrol a tablet (D-217).' using errcode = '42501';
  end if;
  select * into d from public.device where id = p_device for update;
  if not found or d.status <> 'pending' then
    raise exception 'This tablet is not waiting for enrolment.' using errcode = 'P0001';
  end if;
  if d.requested_by = app.current_person_id() then
    raise exception 'Nobody enrols a tablet they registered themselves (D-033).' using errcode = '42501';
  end if;
  update public.device set status = 'enrolled', enrolled_by = app.current_person_id(), enrolled_at = now()
   where id = p_device;
end;
$$;

create or replace function app.revoke_device(p_device uuid, p_reason text, p_lost boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (app.is_super_admin('ENG') or app.is_global_super_admin()) then
    raise exception 'Only a Super Admin of Engineering can revoke a tablet.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason.' using errcode = '23514';
  end if;
  update public.device
     set status = 'revoked', revoked_by = app.current_person_id(), revoked_at = now(), revoke_reason = p_reason,
         reported_lost_at = case when p_lost then now() else reported_lost_at end
   where id = p_device;
end;
$$;

-- Usable for offline signing right now?
create or replace function app.device_problem(p_device uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when d.id is null then 'This tablet is not registered.'
    when d.reported_lost_at is not null then 'This tablet was reported lost.'
    when d.blocked_at is not null then 'This tablet is blocked after repeated bad signatures. Speak to Quality.'
    when d.status = 'revoked' then 'This tablet has been revoked.'
    when d.status <> 'enrolled' then 'This tablet is waiting for a Super Admin to enrol it.'
  end
  from (select 1) x left join public.device d on d.id = p_device;
$$;

-- Called whenever the tablet is online: records contact, returns status and
-- the server time (used to correct the tablet's clock estimate offline).
create or replace function app.device_checkin(p_device uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_has_key boolean;
begin
  update public.device set last_seen_at = now() where id = p_device;
  update app.offline_key set last_seen_at = now() where device_id = p_device and user_id = auth.uid();
  select exists (select 1 from app.offline_key where device_id = p_device and user_id = auth.uid()) into v_has_key;
  return jsonb_build_object(
    'server_time', now(),
    'problem', app.device_problem(p_device),
    'has_key', v_has_key,
    'max_hours', coalesce((app.setting('offline.max_hours'))::integer, 72));
end;
$$;

-- Switch on offline signing for me on this tablet (online, with PIN).
-- Returns the key ONCE, as hex. The tablet keeps it only mixed with the PIN.
create or replace function app.issue_offline_key(p_device uuid, p_pin text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_key bytea := extensions.gen_random_bytes(32);
  v_problem text := app.device_problem(p_device);
  v_min integer := coalesce((app.setting('offline.min_pin_length'))::integer, 6);
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Offline signing is for engineers (D-217).' using errcode = '42501';
  end if;
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '42501';
  end if;
  if length(coalesce(p_pin, '')) < v_min then
    raise exception 'Offline signing needs a PIN of at least % digits. Change your PIN first (D-217).', v_min
      using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  insert into app.offline_key (user_id, device_id, key) values (auth.uid(), p_device, v_key)
  on conflict (user_id, device_id) do update set key = excluded.key, issued_at = now(), last_seen_at = now();
  return encode(v_key, 'hex');
end;
$$;

-- --------------------------------------- the signature being processed now
-- Set only inside submit_offline_signature, for one transaction. The signing
-- functions ask it: "is this an accepted offline signature, and when?"
create or replace function app.offline_signed_at()
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select s.signed_at from public.offline_signature s
   where s.id = nullif(current_setting('nexus.offline_signature', true), '')::uuid
     and s.status = 'verifying' and s.user_id = auth.uid();
$$;

-- PIN check that also accepts a verified offline signature.
create or replace function app.pin_ok(p_pin text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.offline_signed_at() is not null or app.check_my_pin(p_pin);
$$;

-- Certifying check: authorization valid on the day of signing (offline: the
-- day it was signed), then the PIN or a verified offline signature.
create or replace function app.require_certifying(p_aircraft uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_on   date := coalesce((app.offline_signed_at() at time zone
                  coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'))::date, current_date);
begin
  select aircraft_type_code into v_type from public.aircraft where id = p_aircraft;
  if not app.is_certifying(app.current_person_id(), v_type, v_on) then
    raise exception 'You do not hold a valid certifying authorization, licence and type rating for the % (D-043).', v_type
      using errcode = '42501';
  end if;
  if not app.pin_ok(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
end;
$$;

-- Tail status (D-215): PIN, or a verified offline signature.
create or replace function app.set_tail_status(
  p_aircraft uuid, p_status text, p_reason text, p_pin text, p_expected_rts date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can set a tail status (D-046).' using errcode = '42501';
  end if;
  if not app.pin_ok(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return app.set_tail_status_core(p_aircraft, p_status, p_reason, p_expected_rts);
end;
$$;

-- ----------------------------------------------- receive an offline signature
-- p_payload is the exact text the tablet signed (JSON). p_signature is the
-- HMAC-SHA256 of that text with the person's key, in hex. Never raises for a
-- refused signature: it records why and returns {ok:false, reason}, so the
-- record of the attempt is kept (D-217 (f)).
create or replace function app.submit_offline_signature(p_payload text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p          jsonb;
  a          jsonb;
  v_id       uuid;
  v_dev      uuid;
  v_action   text;
  v_signed   timestamptz;
  v_key      app.offline_key;
  v_problem  text;
  v_max      integer := coalesce((app.setting('offline.max_hours'))::integer, 72);
  v_maxbad   integer := coalesce((app.setting('offline.max_bad_signatures'))::integer, 3);
  v_existing public.offline_signature;
  v_result   text;
  v_rt       text;
  v_rid      uuid;
begin
  if app.current_person_id() is null then
    raise exception 'Only an active, signed-in user can send offline signatures.' using errcode = '42501';
  end if;
  begin
    p := p_payload::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'The signed record could not be read.');
  end;
  a        := coalesce(p -> 'args', '{}');
  v_dev    := (p ->> 'device')::uuid;
  v_action := p ->> 'action';
  v_signed := (p ->> 'signed_at')::timestamptz;

  -- Already received? Same answer again (a re-send after a dropped connection).
  select * into v_existing from public.offline_signature where nonce = (p ->> 'nonce')::uuid;
  if found then
    return jsonb_build_object('ok', v_existing.status = 'accepted', 'reason', v_existing.reason,
                              'result', v_existing.result, 'repeat', true);
  end if;

  -- Which record is it about (for display and Quality review)?
  v_rt := case
    when a ? 'p_snag' then 'snag' when a ? 'p_entry' then 'ddls_entry' when a ? 'p_nadd' then 'nadd'
    when a ? 'p_wo' then 'work_order' when a ? 'p_aircraft' then 'aircraft' end;
  v_rid := coalesce(a ->> 'p_snag', a ->> 'p_entry', a ->> 'p_nadd', a ->> 'p_wo', a ->> 'p_aircraft')::uuid;

  insert into public.offline_signature (nonce, device_id, user_id, person_id, action, args, payload, signature,
                                        signed_at, clock_kind, device_time, record_table, record_id)
  values ((p ->> 'nonce')::uuid, v_dev, auth.uid(), app.current_person_id(), coalesce(v_action, '?'), a,
          p_payload, p_signature, v_signed, p ->> 'clock', (p ->> 'device_time')::timestamptz, v_rt, v_rid)
  returning id into v_id;

  -- 1. Whose signature, on which tablet, and is the tablet still trusted?
  if (p ->> 'user')::uuid is distinct from auth.uid() then
    update public.offline_signature set status = 'rejected',
      reason = 'Signed by another user: it is sent when that user signs in on the tablet.' where id = v_id;
    return jsonb_build_object('ok', false, 'reason', 'Signed by another user.');
  end if;
  v_problem := app.device_problem(v_dev);
  if v_problem is not null then
    update public.offline_signature set status = 'rejected', reason = v_problem where id = v_id;
    return jsonb_build_object('ok', false, 'reason', v_problem);
  end if;
  select * into v_key from app.offline_key where user_id = auth.uid() and device_id = v_dev;
  if not found then
    update public.offline_signature set status = 'rejected', reason = 'Offline signing was not switched on for you on this tablet.' where id = v_id;
    return jsonb_build_object('ok', false, 'reason', 'Offline signing was not switched on for you on this tablet.');
  end if;

  -- 2. Is the signature genuine?
  if encode(extensions.hmac(convert_to(p_payload, 'UTF8'), v_key.key, 'sha256'), 'hex') <> lower(coalesce(p_signature, '')) then
    update public.offline_signature set status = 'rejected',
      reason = 'Signature not valid (wrong PIN when signing, or the record was altered).' where id = v_id;
    if (select count(*) from public.offline_signature
         where device_id = v_dev and status = 'rejected' and reason like 'Signature not valid%') >= v_maxbad then
      update public.device set blocked_at = now() where id = v_dev and blocked_at is null;
    end if;
    return jsonb_build_object('ok', false, 'reason', 'Signature not valid. Was the PIN typed correctly when signing?');
  end if;

  -- 3. Inside the offline window, and not in the future?
  if v_signed is null or v_signed < v_key.issued_at - interval '5 minutes'
     or v_signed > now() + interval '5 minutes'
     or v_signed > v_key.last_seen_at + make_interval(hours => v_max) then
    update public.offline_signature set status = 'rejected',
      reason = format('Signed outside the offline window (%s hours from last contact) or with an impossible time.', v_max)
     where id = v_id;
    return jsonb_build_object('ok', false, 'reason', 'Signed outside the offline window.');
  end if;

  -- 4. Run the action as if signed online at that time. Approvals and set-up
  --    are not on this list: they stay online only (D-217).
  perform set_config('nexus.offline_signature', v_id::text, true);
  begin
    case v_action
      when 'apply_mel' then
        v_result := app.apply_mel((a->>'p_snag')::uuid, (a->>'p_mel_item')::uuid, null,
          (a->>'p_m_done')::boolean, (a->>'p_o_passed')::boolean, (a->>'p_placard_fitted')::boolean,
          a->>'p_remarks', a->>'p_tlb_book', a->>'p_tlb_page', a->>'p_tlb_item',
          coalesce((a->>'p_set_svc_mel')::boolean, false))::text;
      when 'defer_on_ddls' then
        v_result := app.defer_on_ddls((a->>'p_snag')::uuid, (a->>'p_days_allowed')::integer, a->>'p_manual_reference', null,
          coalesce((a->>'p_m_required')::boolean, false), coalesce((a->>'p_o_required')::boolean, false),
          a->>'p_remarks', a->>'p_tlb_book', a->>'p_tlb_page', a->>'p_tlb_item',
          coalesce((a->>'p_set_svc_mel')::boolean, false))::text;
      when 'defer_as_nadd' then
        v_result := app.defer_as_nadd((a->>'p_snag')::uuid, null, (a->>'p_declaration')::boolean,
          a->>'p_zone', a->>'p_location', (a->>'p_limit_days')::integer)::text;
      when 'close_snag_no_fault_found' then
        perform app.close_snag_no_fault_found((a->>'p_snag')::uuid, a->>'p_findings', null, a->>'p_tlb_book', a->>'p_tlb_page');
      when 'clear_ddls_entry' then
        perform app.clear_ddls_entry((a->>'p_entry')::uuid, a->>'p_rectification', null, a->>'p_rect_tlb_book', a->>'p_rect_tlb_page');
      when 'confirm_nadd' then
        perform app.confirm_nadd((a->>'p_nadd')::uuid, null, (a->>'p_declaration')::boolean, (a->>'p_limit_days')::integer);
      when 'rectify_nadd' then
        perform app.rectify_nadd((a->>'p_nadd')::uuid, a->>'p_action_taken', null, a->>'p_rect_tlb_book', a->>'p_rect_tlb_page');
      when 'certify_work_order' then
        perform app.certify_work_order((a->>'p_wo')::uuid, null, a->>'p_note');
      when 'set_tail_status' then
        v_result := app.set_tail_status((a->>'p_aircraft')::uuid, a->>'p_status', a->>'p_reason', null,
          (a->>'p_expected_rts')::date)::text;
      else
        raise exception 'This action cannot be signed offline (D-217).' using errcode = '42501';
    end case;
  exception when others then
    perform set_config('nexus.offline_signature', '', true);
    update public.offline_signature set status = 'rejected', reason = sqlerrm where id = v_id;
    return jsonb_build_object('ok', false, 'reason', sqlerrm);
  end;
  perform set_config('nexus.offline_signature', '', true);

  update public.offline_signature set status = 'accepted', result = v_result where id = v_id;
  update app.offline_key set last_seen_at = now() where user_id = auth.uid() and device_id = v_dev;
  return jsonb_build_object('ok', true, 'result', v_result);
end;
$$;

-- -------------------------------------------------------------- security
-- "Can I see this record?" now also answers "no" safely when there is no
-- record (an offline signature that names none). Same rules as 0014.
create or replace function app.can_see_record(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_table is null or p_id is null
     or p_table not in ('snag', 'work_order', 'nadd', 'ddls_entry', 'mel_revision', 'technical_query') then
    return false;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', p_table) into v_ok using p_id;
  return v_ok;
end;
$$;

alter table public.device            enable row level security;
alter table public.offline_signature enable row level security;
-- Tablets: the requester, Engineering Super Admins, Quality and Command see them.
create policy read_devices on public.device for select to authenticated
  using (requested_by = app.current_person_id() or app.is_super_admin('ENG')
         or app.is_global_super_admin() or app.is_oversight());
-- Offline signatures: your own; Quality and Command; anyone who can see the record.
create policy read_offline_signatures on public.offline_signature for select to authenticated
  using (user_id = auth.uid() or app.is_oversight()
         or (record_table = 'aircraft' and app.can_see_aircraft(record_id))
         or (record_table in ('snag', 'work_order', 'nadd', 'ddls_entry') and app.can_see_record(record_table, record_id)));
revoke insert, update, delete, truncate on public.device, public.offline_signature from anon, authenticated;
revoke all on public.device, public.offline_signature from anon;

grant execute on function
  app.request_device(text), app.enrol_device(uuid), app.revoke_device(uuid, text, boolean),
  app.device_checkin(uuid), app.issue_offline_key(uuid, text),
  app.submit_offline_signature(text, text)
to authenticated;
-- Internal: not callable from the app.
revoke execute on function app.offline_signed_at(), app.pin_ok(text), app.device_problem(uuid)
  from public, anon, authenticated;
