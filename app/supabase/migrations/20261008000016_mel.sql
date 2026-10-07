-- =============================================================================
-- Nexus MRO · Phase 1 · 0016 MEL (Minimum Equipment List)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * The operator's APPROVED MEL is loaded into Nexus, one revision at a time
--     per aircraft type, by Quality / Technical Records (D-050). Nexus ships
--     empty: the operator loads its own MEL (D-112).
--   * Loading: Quality opens a revision ("loading"), adds the items, then
--     makes it ACTIVE. The previous active revision becomes "superseded" but
--     stays on record. Items cannot be changed once a revision is active; a
--     correction means a new revision.
--   * Each item holds what the MEL says: number, title, category (A to D),
--     interval and its unit, remarks or exceptions, and whether (M) and (O)
--     procedures apply (D-052).
--   * Type-ahead search (D-058): typing "213101", "21-31" or a word from the
--     title finds the items in the aircraft's active revision. An exact item
--     number comes first.
--   Applying an MEL item to a snag is in 0017 (it goes on the DDLS).
-- =============================================================================

create table public.mel_revision (
  id                  uuid primary key default gen_random_uuid(),
  aircraft_type_code  text not null references public.aircraft_type (code),
  revision            text not null,
  approval_date       date not null,
  approval_reference  text not null,           -- the authority's approval reference
  status              text not null default 'loading' check (status in ('loading', 'active', 'superseded')),
  loaded_by           uuid not null references public.person (id),
  activated_by        uuid references public.person (id),
  activated_at        timestamptz,
  superseded_at       timestamptz,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz,
  unique (aircraft_type_code, revision)
);
comment on table public.mel_revision is 'Approved MEL revisions loaded by Quality / Technical Records (D-050).';
create unique index mel_one_active_revision on public.mel_revision (aircraft_type_code) where status = 'active';
select app.apply_standard_rules('public.mel_revision');

create table public.mel_item (
  id              uuid primary key default gen_random_uuid(),
  revision_id     uuid not null references public.mel_revision (id),
  item_number     text not null check (item_number ~ '^[0-9]{2}(-[0-9]{2}){1,3}[A-Z]?$'),
  number_digits   text generated always as (regexp_replace(item_number, '[^0-9]', '', 'g')) stored,
  title           text not null,
  category        text not null check (category in ('A', 'B', 'C', 'D')),
  interval_value  numeric(8,1) check (interval_value is null or interval_value > 0),
  interval_unit   text not null check (interval_unit in
                    ('calendar_days', 'flight_hours', 'cycles', 'flights', 'as_specified')),
  remarks         text,                          -- remarks or exceptions, as written in the MEL
  m_procedure     boolean not null default false,
  o_procedure     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz,
  unique (revision_id, item_number),
  constraint interval_given check (interval_unit = 'as_specified' or interval_value is not null)
);
comment on table public.mel_item is 'MEL items as written in the approved MEL. Frozen once the revision is active.';
create index mel_item_digits on public.mel_item (revision_id, number_digits);
select app.apply_standard_rules('public.mel_item');

-- Items may only be added while the revision is loading; never changed after.
create or replace function app.check_mel_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select status from public.mel_revision where id = new.revision_id) <> 'loading' then
    raise exception 'MEL items can only be added while the revision is loading. A correction needs a new revision (D-050, D-023).'
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'MEL items are never edited. Load a new revision (D-023).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger a0_check_mel_item before insert or update on public.mel_item
  for each row execute function app.check_mel_item();

-- May the signed-in person load MELs? Quality, or anyone granted "Load MEL" (D-050).
create or replace function app.can_load_mel()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.has_department('QUA') or app.has_permission('LOAD_MEL'); $$;

-- Open a new revision for loading.
create or replace function app.open_mel_revision(
  p_aircraft_type text, p_revision text, p_approval_date date, p_approval_reference text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if app.current_person_id() is null or not app.can_load_mel() then
    raise exception 'Only Quality or Technical Records can load an MEL revision (D-050).' using errcode = '42501';
  end if;
  insert into public.mel_revision (aircraft_type_code, revision, approval_date, approval_reference, loaded_by)
  values (p_aircraft_type, p_revision, p_approval_date, p_approval_reference, app.current_person_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- Add items to a loading revision. p_items is a list, e.g.
--   [{"item_number":"21-31-01","title":"...","category":"C","interval_value":10,
--     "interval_unit":"calendar_days","remarks":"...","m_procedure":true,"o_procedure":false}]
create or replace function app.add_mel_items(p_revision uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if app.current_person_id() is null or not app.can_load_mel() then
    raise exception 'Only Quality or Technical Records can load an MEL revision (D-050).' using errcode = '42501';
  end if;
  insert into public.mel_item (revision_id, item_number, title, category, interval_value, interval_unit,
                               remarks, m_procedure, o_procedure)
  select p_revision, i.item_number, i.title, i.category, i.interval_value, i.interval_unit,
         i.remarks, coalesce(i.m_procedure, false), coalesce(i.o_procedure, false)
    from jsonb_to_recordset(p_items) as i(item_number text, title text, category text, interval_value numeric,
                                          interval_unit text, remarks text, m_procedure boolean, o_procedure boolean);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Make a loaded revision the one in force. The previous one is superseded.
create or replace function app.activate_mel_revision(p_revision uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.mel_revision;
begin
  if app.current_person_id() is null or not app.can_load_mel() then
    raise exception 'Only Quality or Technical Records can activate an MEL revision (D-050).' using errcode = '42501';
  end if;
  select * into r from public.mel_revision where id = p_revision for update;
  if r.status <> 'loading' then
    raise exception 'Only a revision that is loading can be activated.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.mel_item where revision_id = p_revision) then
    raise exception 'This revision has no items.' using errcode = 'P0001';
  end if;
  update public.mel_revision set status = 'superseded', superseded_at = now()
   where aircraft_type_code = r.aircraft_type_code and status = 'active';
  update public.mel_revision set status = 'active', activated_by = app.current_person_id(), activated_at = now()
   where id = p_revision;
end;
$$;

-- -----------------------------------------------------------------------------
-- Type-ahead search for an aircraft (D-058): its type's ACTIVE revision only.
-- Order: exact item number, then numbers starting with what was typed,
-- then title words.
-- -----------------------------------------------------------------------------
create or replace function app.search_mel(p_aircraft uuid, p_query text, p_limit integer default 20)
returns table (id uuid, item_number text, title text, category text, interval_value numeric,
               interval_unit text, remarks text, m_procedure boolean, o_procedure boolean,
               revision text, revision_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select trim(p_query) as text, regexp_replace(p_query, '[^0-9]', '', 'g') as digits),
       rev as (select r.* from public.mel_revision r
                 join public.aircraft a on a.aircraft_type_code = r.aircraft_type_code
                where a.id = p_aircraft and r.status = 'active' and app.can_see_aircraft(p_aircraft))
  select i.id, i.item_number, i.title, i.category, i.interval_value, i.interval_unit,
         i.remarks, i.m_procedure, i.o_procedure, rev.revision, rev.id
    from public.mel_item i join rev on rev.id = i.revision_id, q
   where (q.digits <> '' and i.number_digits like q.digits || '%')
      or (length(q.text) >= 2 and i.title ilike '%' || q.text || '%')
   order by (q.digits <> '' and i.number_digits = q.digits) desc,
            (q.digits <> '' and i.number_digits like q.digits || '%') desc,
            i.item_number
   limit greatest(1, least(p_limit, 50));
$$;

alter table public.mel_revision enable row level security;
alter table public.mel_item     enable row level security;
-- The MEL is reference material: everyone signed in may read it.
create policy read_signed_in on public.mel_revision for select to authenticated using (true);
create policy read_signed_in on public.mel_item     for select to authenticated using (true);
revoke insert, update, delete, truncate on public.mel_revision, public.mel_item from anon, authenticated;
revoke all on public.mel_revision, public.mel_item from anon;
