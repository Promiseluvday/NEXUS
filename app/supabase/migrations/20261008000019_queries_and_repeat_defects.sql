-- =============================================================================
-- Nexus MRO · Phase 1 · 0019 Technical queries and repeat-defect alerts
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--
--   TECHNICAL QUERIES (D-207): a question thread attached to a record (snag,
--   work order, NADD, DDLS entry, MEL revision). It is assigned to a person
--   or a department queue, with a due date and an "urgent" flag (urgent =
--   holds an aircraft). Notes are added, never edited. The raiser closes it.
--   A query NEVER changes the record it is about. You can only raise or see a
--   query on a record you can see.
--
--   REPEAT DEFECTS (D-208): "similar defects" finds earlier snags on the same
--   type by ATA and words. A REPEAT is flagged when one tail has 3 snags in
--   30 days in the same ATA sub-chapter (e.g. 21-31). Both numbers are
--   settings. It is an ALERT only; it never grounds an aircraft (D-020).
-- =============================================================================

create table public.technical_query (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  record_table        text not null check (record_table in ('snag', 'work_order', 'nadd', 'ddls_entry', 'mel_revision')),
  record_id           uuid not null,
  subject             text not null check (length(trim(subject)) > 0),
  body                text not null check (length(trim(body)) > 0),
  raised_by           uuid not null references public.person (id),
  assigned_person     uuid references public.person (id),
  assigned_department text references public.department (code),
  due_on              date,
  urgent              boolean not null default false,
  status              text not null default 'open' check (status in ('open', 'closed')),
  closed_by           uuid references public.person (id),
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz,
  constraint assigned_somewhere check (num_nonnulls(assigned_person, assigned_department) >= 1),
  constraint closure_recorded check (status <> 'closed' or (closed_by is not null and closed_at is not null))
);
comment on table public.technical_query is 'Question threads on records (D-207). Never change the record.';
select app.apply_standard_rules('public.technical_query');

create table public.technical_query_note (
  id          uuid primary key default gen_random_uuid(),
  query_id    uuid not null references public.technical_query (id),
  note        text not null check (length(trim(note)) > 0),
  author      uuid not null references public.person (id),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
create trigger a1_no_update before update on public.technical_query_note
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.technical_query_note');

-- Fill in number, raiser and author from the server; only closing is ever
-- allowed as a change, and only by the raiser.
create or replace function app.check_technical_query()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.number    := app.next_number('technical_query', 'TQ-{000000}');
    new.raised_by := app.current_person_id();
    new.status    := 'open'; new.closed_by := null; new.closed_at := null;
    return new;
  end if;
  if (to_jsonb(new) - array['status','closed_by','closed_at','created_at','created_by'])
     is distinct from (to_jsonb(old) - array['status','closed_by','closed_at','created_at','created_by']) then
    raise exception 'A query is never edited; add a note instead (D-207).' using errcode = 'P0001';
  end if;
  if old.status = 'closed' then
    raise exception 'This query is already closed.' using errcode = 'P0001';
  end if;
  if new.status = 'closed' then
    if old.raised_by <> app.current_person_id() then
      raise exception 'Only whoever raised the query can close it (D-207).' using errcode = '42501';
    end if;
    new.closed_by := app.current_person_id();
    new.closed_at := now();
  end if;
  return new;
end;
$$;
create trigger a0_check_query before insert or update on public.technical_query
  for each row execute function app.check_technical_query();

create or replace function app.check_query_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author := app.current_person_id();
  if (select status from public.technical_query where id = new.query_id) = 'closed' then
    raise exception 'This query is closed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger a0_check_note before insert on public.technical_query_note
  for each row execute function app.check_query_note();

-- Who is involved in a query: raiser, assignee, assigned department, oversight.
create or replace function app.involved_in_query(p_raised_by uuid, p_person uuid, p_department text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_person_id() in (p_raised_by, p_person)
      or (p_department is not null and app.has_department(p_department))
      or app.is_oversight();
$$;

alter table public.technical_query      enable row level security;
alter table public.technical_query_note enable row level security;
create policy read_involved on public.technical_query for select to authenticated
  using (app.can_see_record(record_table, record_id)
         and app.involved_in_query(raised_by, assigned_person, assigned_department));
create policy raise_on_visible_record on public.technical_query for insert to authenticated
  with check (app.current_person_id() is not null and app.can_see_record(record_table, record_id));
create policy close_by_raiser on public.technical_query for update to authenticated
  using (raised_by = app.current_person_id()) with check (raised_by = app.current_person_id());
create policy read_with_query on public.technical_query_note for select to authenticated
  using (exists (select 1 from public.technical_query q where q.id = technical_query_note.query_id));
create policy add_note_if_involved on public.technical_query_note for insert to authenticated
  with check (exists (select 1 from public.technical_query q where q.id = technical_query_note.query_id));
revoke delete, truncate on public.technical_query, public.technical_query_note from anon, authenticated, service_role;
revoke update on public.technical_query_note from authenticated;
revoke all on public.technical_query, public.technical_query_note from anon;


-- -----------------------------------------------------------------------------
-- REPEAT DEFECT flag (D-208). Runs with the user's rights.
-- Settings: repeat.threshold (default 3), repeat.window_days (default 30).
-- -----------------------------------------------------------------------------
create or replace function app.repeat_defect(p_snag uuid)
returns table (is_repeat boolean, reports_in_window integer, ata_sub_chapter text, window_days integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (select * from public.snag where id = p_snag),
       cfg as (select coalesce((app.setting('repeat.threshold'))::integer, 3)   as threshold,
                      coalesce((app.setting('repeat.window_days'))::integer, 30) as days)
  select count(o.id) >= cfg.threshold, count(o.id)::integer, left(s.ata, 5), cfg.days
    from s cross join cfg
    left join public.snag o
      on o.aircraft_id = s.aircraft_id
     and s.ata is not null and length(s.ata) >= 5 and left(o.ata, 5) = left(s.ata, 5)
     and o.created_at between s.created_at - make_interval(days => cfg.days) and s.created_at
   group by cfg.threshold, s.ata, cfg.days;
$$;

-- SIMILAR DEFECTS (D-208): same aircraft type, ranked by same tail, same ATA,
-- and shared words. Only snags the user may see.
create or replace function app.similar_snags(p_snag uuid, p_limit integer default 20)
returns table (id uuid, number text, tail text, ata text, description text, status text,
               reported_at timestamptz, same_tail boolean, same_ata boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (select sn.*, a.aircraft_type_code from public.snag sn
               join public.aircraft a on a.id = sn.aircraft_id where sn.id = p_snag)
  select o.id, o.number, a.tail, o.ata, o.description, o.status, o.created_at,
         o.aircraft_id = s.aircraft_id,
         (s.ata is not null and left(o.ata, 5) = left(s.ata, 5))
    from s
    join public.aircraft a on a.aircraft_type_code = s.aircraft_type_code
    join public.snag o on o.aircraft_id = a.id and o.id <> s.id
   where (s.ata is not null and left(o.ata, 2) = left(s.ata, 2))
      or to_tsvector('simple', o.description)
         @@ replace(plainto_tsquery('simple', s.description)::text, '&', '|')::tsquery  -- any shared word
   order by (o.aircraft_id = s.aircraft_id) desc,
            (s.ata is not null and left(o.ata, 5) = left(s.ata, 5)) desc,
            o.created_at desc
   limit greatest(1, least(p_limit, 50));
$$;
