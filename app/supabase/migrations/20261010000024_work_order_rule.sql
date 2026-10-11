-- =============================================================================
-- Nexus MRO · Migration 0024 · No work without an approved work order (D-218)
-- Proprietary to Liebetag. All rights reserved.
--
-- What changes:
--   * A work order can be requested on an ATTENDED snag (rectify now) or on a
--     DEFERRED snag (to rectify a MEL / DDLS / NADD deferral later). Only one
--     active work order per snag.
--   * Certifying the work order (certifying engineer, PIN) closes the snag
--     and, in the same signature, clears its open DDLS entry and rectifies
--     its open NADD. It can be certified as "no fault found" (troubleshooting
--     found nothing), with the tech log reference.
--   * Closing as no fault found and clearing a DDLS entry are no longer done
--     directly: both need a work order (Quality + CO approval, D-063).
--   * Unchanged: deferral under MEL, DDLS or NADD needs no work order, and a
--     NADD can still be rectified directly with PIN (it may be fixed at
--     another MRO during a heavy check).
-- =============================================================================

-- ------------------------------------------------------------- request -----
create or replace function app.request_work_order(p_snag uuid, p_scope text, p_est_man_hours numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s     public.snag;
  v_wo  uuid;
  v_num text;
  v_open text;
begin
  s := app.snag_for_engineer(p_snag, array['attended', 'deferred']);
  select number into v_open from public.work_order
   where snag_id = s.id and status in ('requested', 'pre_approved', 'open', 'work_complete') limit 1;
  if v_open is not null then
    raise exception 'Snag % already has work order % in progress.', s.number, v_open using errcode = 'P0001';
  end if;
  v_num := app.next_number('work_order', 'WO-{000000}');
  insert into public.work_order (number, aircraft_id, snag_id, scope, est_man_hours, requested_by)
  values (v_num, s.aircraft_id, s.id, p_scope, p_est_man_hours, app.current_person_id())
  returning id into v_wo;

  update public.work_order
     set approval_request_id = app.raise_approval('work_order', 'work_order', v_wo,
                                                  v_num || ' · ' || s.number || ' · ' || left(p_scope, 80))
   where id = v_wo;

  -- A newly assessed snag goes into work. A deferred snag stays deferred
  -- (its MEL / DDLS / NADD entry still controls the aircraft) until the
  -- work order is certified.
  if s.status = 'attended' then
    update public.snag
       set status = 'in_work', disposition = 'rectify_now',
           dispositioned_by = app.current_person_id(), dispositioned_at = now()
     where id = s.id;
  end if;
  return v_wo;
end;
$$;

-- ------------------------------------------------------------- certify -----
drop function app.certify_work_order(uuid, text, text);
create function app.certify_work_order(
  p_wo uuid, p_pin text, p_note text,
  p_no_fault_found boolean default false, p_tlb_book text default null, p_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w         public.work_order;
  v_missing text[];
  v_note    text;
begin
  w := app.work_order_for_engineer(p_wo, array['work_complete']);
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Describe what was done or found.' using errcode = '23514';
  end if;
  v_missing := app.work_order_missing_scans(p_wo);
  if cardinality(v_missing) > 0 then
    raise exception 'Attach the required scans first: % (D-065).', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;
  perform app.require_certifying(w.aircraft_id, p_pin);
  v_note := case when p_no_fault_found then 'No fault found under ' else 'Rectified under ' end || w.number || ': ' || p_note;

  update public.work_order
     set status = 'certified', certified_by = app.current_person_id(), certified_at = now(),
         certification_note = case when p_no_fault_found then 'No fault found: ' || p_note else p_note end
   where id = p_wo;

  -- Same signature clears any deferral still open for this snag (D-218).
  update public.ddls_entry
     set status = 'cleared', cleared_by = app.current_person_id(), cleared_at = now(),
         rectification = v_note, rect_tlb_book = p_tlb_book, rect_tlb_page = p_tlb_page
   where snag_id = w.snag_id and status = 'open';
  update public.nadd
     set status = 'rectified', rectified_by = app.current_person_id(), rectified_at = now(),
         action_taken = v_note, rect_tlb_book = p_tlb_book, rect_tlb_page = p_tlb_page
   where snag_id = w.snag_id and status = 'open';

  update public.snag
     set status = 'closed', closed_by = app.current_person_id(), closed_at = now(),
         closure_note = v_note,
         disposition = case when p_no_fault_found then 'nff' else disposition end,
         tlb_book = coalesce(p_tlb_book, tlb_book), tlb_page = coalesce(p_tlb_page, tlb_page)
   where id = w.snag_id;
end;
$$;
grant execute on function app.certify_work_order(uuid, text, text, boolean, text, text) to authenticated;

-- ------------------------------------------- no longer done directly -----
create or replace function app.close_snag_no_fault_found(
  p_snag uuid, p_findings text, p_pin text,
  p_tlb_book text default null, p_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Troubleshooting needs an approved work order (D-218). Request a work order; "No fault found" is recorded when it is certified.'
    using errcode = 'P0001';
end;
$$;

create or replace function app.clear_ddls_entry(
  p_entry uuid, p_rectification text, p_pin text,
  p_rect_tlb_book text default null, p_rect_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Clearing a DDLS entry needs an approved work order (D-218). Request a work order on its snag; certifying it clears the entry.'
    using errcode = 'P0001';
end;
$$;

comment on function app.close_snag_no_fault_found(uuid, text, text, text, text) is 'Refused since D-218: no fault found is recorded when a work order is certified.';
comment on function app.clear_ddls_entry(uuid, text, text, text, text) is 'Refused since D-218: a DDLS entry clears when its work order is certified.';

-- ------------------------------------------- offline signing (D-217) -----
-- Same as 0023, with the work order certification options passed through.
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
        perform app.certify_work_order((a->>'p_wo')::uuid, null, a->>'p_note',
          coalesce((a->>'p_no_fault_found')::boolean, false), a->>'p_tlb_book', a->>'p_tlb_page');
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
