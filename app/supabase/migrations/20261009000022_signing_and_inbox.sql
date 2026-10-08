-- =============================================================================
-- Nexus MRO · Phase 1 · 0022 PIN on tail status and approvals; SVC · MEL at
-- deferral; the approvals inbox
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--
--   1. SETTING A TAIL STATUS NOW NEEDS THE PIN (D-215). A status is a signed
--      statement by an engineer, so it is signed like one (D-094).
--
--   2. APPROVING OR REJECTING NOW NEEDS THE PIN (D-094, D-104). Until now the
--      screen was meant to ask for it; now the database insists.
--
--   3. DEFERRAL CAN SET "SERVICEABLE · MEL" IN THE SAME SIGNED STEP (D-216).
--      When an engineer defers under the MEL (or on the DDLS), the form offers
--      "also set the tail to Serviceable · MEL". It is the engineer's tick and
--      the engineer's PIN: Nexus never sets a status by itself (D-020, D-046).
--      Both happen together or not at all.
--
--   4. "WAITING FOR ME": the approvals the signed-in person can act on now.
--
--   How: the existing functions are renamed "..._core" (their checks stay
--   exactly as tested) and new functions with the old names wrap them with
--   the extra step. The _core functions cannot be called from the app.
-- =============================================================================

-- ------------------------------------------------------------ 1. tail status
alter function app.set_tail_status(uuid, text, text, date) rename to set_tail_status_core;
revoke execute on function app.set_tail_status_core(uuid, text, text, date) from public, anon, authenticated;

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
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return app.set_tail_status_core(p_aircraft, p_status, p_reason, p_expected_rts);
end;
$$;
comment on function app.set_tail_status(uuid, text, text, text, date) is
  'Engineer sets the tail status, signed with PIN (D-046, D-094, D-215).';

-- -------------------------------------------------------------- 2. approvals
alter function app.decide_approval(uuid, text, text) rename to decide_approval_core;
revoke execute on function app.decide_approval_core(uuid, text, text) from public, anon, authenticated;

create or replace function app.decide_approval(
  p_request uuid, p_decision text, p_pin text, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result text;
begin
  -- All the approval rules first (step holder, not the raiser, not two steps,
  -- reason for a reject), so their messages come first...
  v_result := app.decide_approval_core(p_request, p_decision, p_reason);
  -- ...then the signature. A wrong PIN undoes the whole decision.
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return v_result;
end;
$$;
comment on function app.decide_approval(uuid, text, text, text) is
  'Approve or reject the current step, signed with PIN (D-079, D-094, D-104).';

-- --------------------------------------------- 3. SVC · MEL at deferral
-- Records the status the engineer ticked, in the same transaction as the
-- deferral. Only ever "SVC_MEL", only when asked.
create or replace function app.record_svc_mel(p_snag uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tail_status_event (aircraft_id, status, reason, set_by)
  select s.aircraft_id, 'SVC_MEL', p_reason, app.current_person_id()
    from public.snag s where s.id = p_snag;
end;
$$;
revoke execute on function app.record_svc_mel(uuid, text) from public, anon, authenticated;

alter function app.apply_mel(uuid, uuid, text, boolean, boolean, boolean, text, text, text, text)
  rename to apply_mel_core;
revoke execute on function app.apply_mel_core(uuid, uuid, text, boolean, boolean, boolean, text, text, text, text)
  from public, anon, authenticated;

create or replace function app.apply_mel(
  p_snag uuid, p_mel_item uuid, p_pin text,
  p_m_done boolean, p_o_passed boolean, p_placard_fitted boolean,
  p_remarks text default null,
  p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null,
  p_set_svc_mel boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  e    public.ddls_entry;
begin
  v_id := app.apply_mel_core(p_snag, p_mel_item, p_pin, p_m_done, p_o_passed, p_placard_fitted,
                             p_remarks, p_tlb_book, p_tlb_page, p_tlb_item);
  if p_set_svc_mel then
    select * into e from public.ddls_entry where id = v_id;
    perform app.record_svc_mel(p_snag, format('Deferred under MEL %s, DDLS page %s entry %s (%s)',
      e.mel_ref, e.page_no, e.entry_no, (select number from public.snag where id = p_snag)));
  end if;
  return v_id;
end;
$$;

alter function app.defer_on_ddls(uuid, integer, text, text, boolean, boolean, text, text, text, text)
  rename to defer_on_ddls_core;
revoke execute on function app.defer_on_ddls_core(uuid, integer, text, text, boolean, boolean, text, text, text, text)
  from public, anon, authenticated;

create or replace function app.defer_on_ddls(
  p_snag uuid, p_days_allowed integer, p_manual_reference text, p_pin text,
  p_m_required boolean default false, p_o_required boolean default false,
  p_remarks text default null,
  p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null,
  p_set_svc_mel boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  e    public.ddls_entry;
begin
  v_id := app.defer_on_ddls_core(p_snag, p_days_allowed, p_manual_reference, p_pin,
                                 p_m_required, p_o_required, p_remarks, p_tlb_book, p_tlb_page, p_tlb_item);
  if p_set_svc_mel then
    select * into e from public.ddls_entry where id = v_id;
    perform app.record_svc_mel(p_snag, format('Deferred on DDLS page %s entry %s, %s (%s)',
      e.page_no, e.entry_no, e.manual_reference, (select number from public.snag where id = p_snag)));
  end if;
  return v_id;
end;
$$;

-- -------------------------------------------------------- 4. approvals inbox
-- Requests waiting at a step the signed-in person holds, that they did not
-- raise and have not already decided. Oldest first.
create or replace function app.my_pending_approvals()
returns table (
  id uuid, action_type text, chain_name text, record_table text, record_id uuid,
  summary text, step_no integer, step_name text, raised_by text, raised_at timestamptz,
  waiting_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.action_type, c.name, r.record_table, r.record_id, r.summary,
         r.current_step, st.name, p.three_letter_code, r.raised_at,
         coalesce((select max(d.created_at) from public.approval_decision d where d.request_id = r.id), r.raised_at)
    from public.approval_request r
    join public.approval_chain c on c.action_type = r.action_type
    join public.approval_chain_step st on st.action_type = r.action_type and st.step_no = r.current_step
    join public.person p on p.id = r.raised_by
   where r.status = 'pending'
     and app.current_person_id() is not null
     and app.holds_step(r.action_type, r.current_step)
     and r.raised_by <> app.current_person_id()
     and not exists (select 1 from public.approval_decision d
                      where d.request_id = r.id and d.decided_by = app.current_person_id())
   order by r.raised_at;
$$;

-- --------------------------------------------------------------- access
grant execute on function
  app.set_tail_status(uuid, text, text, text, date),
  app.decide_approval(uuid, text, text, text),
  app.apply_mel(uuid, uuid, text, boolean, boolean, boolean, text, text, text, text, boolean),
  app.defer_on_ddls(uuid, integer, text, text, boolean, boolean, text, text, text, text, boolean),
  app.my_pending_approvals()
to authenticated;

-- ------------------------------------------- 5. who can read the approval trail
-- Anyone who can see the record (e.g. the engineers working the work order)
-- can see its approvals and the reasons given. The approvers and Quality
-- already could. Reading only; decisions still go through decide_approval.
create policy read_with_record on public.approval_request for select to authenticated
  using (app.can_see_record(record_table, record_id));
