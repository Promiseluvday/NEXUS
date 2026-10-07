-- =============================================================================
-- Nexus MRO · Phase 1 · 0011 Approval engine and record numbering
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--
--   1. RECORD NUMBERS. Snags, work orders and NADDs get numbers like
--      SNAG-000214. Each series runs fleet-wide, is handed out by the server
--      (never the phone), and a number is never reused (D-064, D-213). The
--      look of the number is a setting, e.g. "SNAG-{000000}".
--
--   2. ONE APPROVAL ENGINE used by everything that needs sign-off: work
--      orders (Quality then CO, D-063), MEL / DDLS / NADD extensions
--      (D-056, D-160, D-163), workshop work orders (D-019)...
--      * Each kind of action has a CHAIN of steps, configured per operator
--        (D-076, D-078). A step is held by a department (e.g. Quality) or an
--        appointment (e.g. Engineering CO; acting deputies count, D-036).
--      * Rules: whoever raised it cannot approve any step; nobody approves
--        two steps of the same request (D-075, D-146); a rejection needs a
--        reason and sends it back to the raiser (D-079).
--      * Decisions are append-only: each approve / reject is its own record.
-- =============================================================================

-- ------------------------------------------------------------- numbering -----
create table app.number_series (
  series     text primary key,          -- e.g. 'snag', 'work_order', 'nadd'
  last_value bigint not null default 0
);
revoke all on app.number_series from anon, authenticated;

-- Hand out the next number for a series and format it with the operator's
-- setting "<series>.number_format", e.g. "SNAG-{000000}" -> SNAG-000214.
create or replace function app.next_number(p_series text, p_default_format text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n      bigint;
  v_format text := coalesce(app.setting(p_series || '.number_format') #>> '{}', p_default_format);
  v_digits int;
  v_token  text;
begin
  insert into app.number_series (series, last_value) values (p_series, 1)
  on conflict (series) do update set last_value = app.number_series.last_value + 1
  returning last_value into v_n;

  v_token := substring(v_format from '\{0+\}');
  if v_token is null then
    return v_format || v_n::text;
  end if;
  v_digits := length(v_token) - 2;
  return replace(v_format, v_token, lpad(v_n::text, v_digits, '0'));
end;
$$;

-- ------------------------------------------------------- approval chains -----
create table public.approval_chain (
  action_type text primary key check (action_type ~ '^[a-z_]{3,40}$'),
  name        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
comment on table public.approval_chain is 'Which approvals each kind of action needs (D-076, D-078).';
select app.apply_standard_rules('public.approval_chain');

create table public.approval_chain_step (
  id              uuid primary key default gen_random_uuid(),
  action_type     text not null references public.approval_chain (action_type),
  step_no         integer not null check (step_no between 1 and 9),
  name            text not null,                       -- e.g. "Quality pre-approval"
  department_code text references public.department (code),
  appointment_id  uuid references public.appointment (id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz,
  unique (action_type, step_no),
  constraint one_holder check (num_nonnulls(department_code, appointment_id) = 1)
);
comment on table public.approval_chain_step is 'Each step is held by a department or an appointment (acting deputies count, D-036).';
select app.apply_standard_rules('public.approval_chain_step');

-- ------------------------------------------------------ approval requests -----
create table public.approval_request (
  id            uuid primary key default gen_random_uuid(),
  action_type   text not null references public.approval_chain (action_type),
  record_table  text not null,
  record_id     uuid not null,
  summary       text not null,
  raised_by     uuid not null references public.person (id),
  raised_at     timestamptz not null default now(),
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  current_step  integer not null default 1,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  device_time   timestamptz
);
comment on table public.approval_request is 'One request per thing needing approval. Status changes only through app.decide_approval().';
select app.apply_standard_rules('public.approval_request');

create table public.approval_decision (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.approval_request (id),
  step_no     integer not null,
  decision    text not null check (decision in ('approve', 'reject')),
  decided_by  uuid not null references public.person (id),
  reason      text,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz,
  constraint reject_needs_reason check (decision <> 'reject' or length(trim(coalesce(reason, ''))) > 0)
);
comment on table public.approval_decision is 'Append-only record of every approve and reject (D-079).';
create trigger a1_no_update before update on public.approval_decision
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.approval_decision');

-- May the signed-in person act on this step? (department member or appointment holder / deputy)
create or replace function app.holds_step(p_action text, p_step integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.approval_chain_step s
     where s.action_type = p_action and s.step_no = p_step
       and ((s.department_code is not null and app.has_department(s.department_code))
            or (s.appointment_id is not null
                and exists (select 1 from app.my_active_appointments() a where a.id = s.appointment_id))));
$$;

-- Raise a request. Called by the functions that create work orders, extensions...
create or replace function app.raise_approval(
  p_action text, p_record_table text, p_record_id uuid, p_summary text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_me uuid := app.current_person_id();
begin
  if v_me is null then
    raise exception 'Only an active, signed-in user can raise an approval.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.approval_chain_step where action_type = p_action) then
    raise exception 'No approval chain is set up for "%". A Super Admin must configure it (D-078).', p_action
      using errcode = '22023';
  end if;
  insert into public.approval_request (action_type, record_table, record_id, summary, raised_by)
  values (p_action, p_record_table, p_record_id, p_summary, v_me)
  returning id into v_id;
  return v_id;
end;
$$;

-- Approve or reject the current step. Online and PIN-checked by the app (D-104).
create or replace function app.decide_approval(p_request uuid, p_decision text, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       public.approval_request;
  v_me    uuid := app.current_person_id();
  v_last  integer;
begin
  select * into r from public.approval_request where id = p_request for update;
  if not found then
    raise exception 'Approval request not found.' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request is already %.', r.status using errcode = 'P0001';
  end if;
  if v_me is null or not app.holds_step(r.action_type, r.current_step) then
    raise exception 'You do not hold step % of this approval.', r.current_step using errcode = '42501';
  end if;
  if v_me = r.raised_by then
    raise exception 'Whoever raised a request cannot approve it (D-075, D-146).' using errcode = '42501';
  end if;
  if exists (select 1 from public.approval_decision d where d.request_id = r.id and d.decided_by = v_me) then
    raise exception 'Nobody approves two steps of the same request (D-146).' using errcode = '42501';
  end if;
  if p_decision = 'reject' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A rejection needs a reason (D-079).' using errcode = '23514';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.' using errcode = '22023';
  end if;

  insert into public.approval_decision (request_id, step_no, decision, decided_by, reason)
  values (r.id, r.current_step, p_decision, v_me, p_reason);

  select max(step_no) into v_last from public.approval_chain_step where action_type = r.action_type;

  if p_decision = 'reject' then
    update public.approval_request set status = 'rejected', decided_at = now() where id = r.id;
    return 'rejected';
  elsif r.current_step >= v_last then
    update public.approval_request set status = 'approved', decided_at = now() where id = r.id;
    return 'approved';
  else
    update public.approval_request set current_step = r.current_step + 1 where id = r.id;
    return 'step ' || (r.current_step + 1)::text;
  end if;
end;
$$;

-- -------------------------------------------------------------- security -----
alter table public.approval_chain      enable row level security;
alter table public.approval_chain_step enable row level security;
alter table public.approval_request    enable row level security;
alter table public.approval_decision   enable row level security;

create policy read_signed_in on public.approval_chain      for select to authenticated using (true);
create policy read_signed_in on public.approval_chain_step for select to authenticated using (true);
-- Chains are configured by the Commander for now; D-078's Quality-proposes /
-- CO-approves flow for chain changes is a later screen.
create policy write_global_admin on public.approval_chain      for insert to authenticated with check (app.is_global_super_admin());
create policy write_global_admin on public.approval_chain_step for insert to authenticated with check (app.is_global_super_admin());

-- Requests and decisions: the raiser, anyone holding a step of that chain,
-- and oversight can see them. Changes happen only through the functions above.
create policy read_involved on public.approval_request for select to authenticated
  using (raised_by = app.current_person_id()
         or app.is_oversight()
         or exists (select 1 from public.approval_chain_step s
                     where s.action_type = approval_request.action_type
                       and app.holds_step(s.action_type, s.step_no)));
create policy read_involved on public.approval_decision for select to authenticated
  using (exists (select 1 from public.approval_request r where r.id = approval_decision.request_id));

revoke insert, update, delete, truncate on public.approval_request, public.approval_decision from anon, authenticated;
revoke all on public.approval_chain, public.approval_chain_step, public.approval_request, public.approval_decision from anon;
