-- =============================================================================
-- Nexus MRO · Phase 1 · 0020 Fleet board
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   One read-only list, one row per aircraft the user may see (D-121), with:
--     * the status an ENGINEER set, who set it and when (D-046)
--     * the snag chip: blue "Snag open" / amber "Snag attended" (D-200)
--     * expected return to service, as entered by Engineering (D-047)
--     * counts: open snags, DDLS entries, NADDs, and the next due times
--     * "Blocked by" (D-006): the item that has been held longest, which
--       department holds it, and since when
--   The headline never includes defect descriptions, so every department,
--   including Operations, can see it (D-120). Nothing here is calculated
--   about airworthiness: it only counts and shows what people recorded
--   (D-020).
-- =============================================================================

create or replace function app.fleet_board()
returns table (
  aircraft_id       uuid,
  tail              text,
  aircraft_type     text,
  status            text,
  status_set_by     text,      -- 3LC
  status_set_at     timestamptz,
  expected_rts_on   date,
  snag_display      text,      -- 'snag_open' (blue) | 'snag_attended' (amber) | null
  open_snags        integer,
  open_ddls         integer,
  next_ddls_due     timestamptz,
  open_nadds        integer,
  next_nadd_due     timestamptz,
  blocked_by        text,      -- e.g. "Work order awaiting CO final approval"
  blocked_ref       text,      -- e.g. WO-000214
  blocked_holder    text,      -- department or appointment holding it
  blocked_since     timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select a.* from public.aircraft a
     where a.status = 'active' and app.can_see_aircraft(a.id)),
  cur as (
    select distinct on (e.aircraft_id) e.aircraft_id, e.status, e.set_at, e.expected_rts_on, p.three_letter_code
      from public.tail_status_event e join public.person p on p.id = e.set_by
     order by e.aircraft_id, e.set_at desc),
  -- Everything that can hold an aircraft, with who holds it and since when.
  holds as (
    select s.aircraft_id, 'Snag open, awaiting engineer' as what, s.number as ref,
           'Engineering' as holder, s.created_at as since
      from public.snag s where s.status = 'reported'
    union all
    select s.aircraft_id, 'Snag attended, disposition pending', s.number, 'Engineering', s.attended_at
      from public.snag s where s.status = 'attended'
    union all
    select w.aircraft_id,
           'Work order awaiting ' || st.name, w.number,
           coalesce(ap.title, d.name), coalesce(
             (select max(dd.created_at) from public.approval_decision dd where dd.request_id = r.id), r.raised_at)
      from public.work_order w
      join public.approval_request r on r.id = w.approval_request_id and r.status = 'pending'
      join public.approval_chain_step st on st.action_type = r.action_type and st.step_no = r.current_step
      left join public.appointment ap on ap.id = st.appointment_id
      left join public.department d on d.code = st.department_code
    union all
    select w.aircraft_id, 'Work order in progress', w.number, 'Engineering', r.decided_at
      from public.work_order w join public.approval_request r on r.id = w.approval_request_id
     where w.status = 'open'
    union all
    select w.aircraft_id, 'Work order awaiting certification', w.number, 'Engineering', w.work_completed_at
      from public.work_order w where w.status = 'work_complete')
  select v.id, v.tail, v.aircraft_type_code,
         c.status, c.three_letter_code, c.set_at, c.expected_rts_on,
         case when exists (select 1 from public.snag s where s.aircraft_id = v.id and s.status = 'reported') then 'snag_open'
              when exists (select 1 from public.snag s where s.aircraft_id = v.id and s.status = 'attended') then 'snag_attended'
         end,
         (select count(*)::integer from public.snag s where s.aircraft_id = v.id and s.status <> 'closed'),
         (select count(*)::integer from public.ddls_entry e where e.aircraft_id = v.id and e.status = 'open'),
         (select min(e.due_at) from public.ddls_entry e where e.aircraft_id = v.id and e.status = 'open'),
         (select count(*)::integer from public.nadd n where n.aircraft_id = v.id and n.status = 'open'),
         (select min(n.due_at) from public.nadd n where n.aircraft_id = v.id and n.status = 'open'),
         b.what, b.ref, b.holder, b.since
    from visible v
    left join cur c on c.aircraft_id = v.id
    left join lateral (select h.* from holds h where h.aircraft_id = v.id order by h.since asc limit 1) b on true
   order by v.tail;
$$;
comment on function app.fleet_board() is 'Fleet board rows for the signed-in user (D-006, D-046, D-120, D-200).';
