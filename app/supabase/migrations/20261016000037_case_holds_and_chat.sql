-- =============================================================================
-- Nexus MRO · Migration 0037 · "In hand" holds and case chat
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (Promise, 14 and 16 Oct):
--   1. IN HAND. When an engineer opens a snag or work order to work on it,
--      Nexus records "in hand: KDO since 10:02". If someone from the SAME
--      department opens it while it is in hand, they are told who has it and
--      when; they can read it but the screen locks its actions. The hold
--      ends when the holder leaves the page, after 30 minutes without the
--      page being open (setting case.hold_minutes), or when a Super Admin or
--      Command releases it with a reason. Nothing about the aircraft
--      changes: a hold only says who is working on the case.
--   2. CASE CHAT. Each case has a simple message thread: a snag and its work
--      order share one. Anyone who can see the case can read and post.
--      Messages are never edited or deleted. People who have opened or
--      posted in a thread see new messages counted on the bell.
--   Formal technical queries stay as they are.
-- =============================================================================

insert into public.operator_setting (key, value, reason) values
  ('case.hold_minutes', '30', 'Initial set-up: minutes a case stays in hand after its page was last open');

-- ------------------------------------------------------------- holds -----
create table public.case_hold (
  id             uuid primary key default gen_random_uuid(),
  record_table   text not null check (record_table in ('snag', 'work_order')),
  record_id      uuid not null,
  aircraft_id    uuid not null references public.aircraft (id),
  held_by        uuid not null references public.person (id),
  taken_at       timestamptz not null default now(),
  seen_at        timestamptz not null default now(),     -- last time the holder's page was open
  released_at    timestamptz,
  released_by    uuid references public.person (id),
  release_reason text,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  device_time    timestamptz
);
comment on table public.case_hold is 'Who has a snag or work order in hand. Released, never deleted.';
create unique index case_hold_one_open on public.case_hold (record_table, record_id, held_by) where released_at is null;
select app.apply_standard_rules('public.case_hold');
alter table public.case_hold enable row level security;
create policy read_with_record on public.case_hold for select to authenticated
  using (app.can_see_record(record_table, record_id));
revoke insert, update, delete, truncate on public.case_hold from anon, authenticated;
revoke all on public.case_hold from anon;

create or replace function app.case_aircraft(p_table text, p_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case p_table
           when 'snag'       then (select s.aircraft_id from public.snag s where s.id = p_id)
           when 'work_order' then (select w.aircraft_id from public.work_order w where w.id = p_id)
           when 'nadd'       then (select n.aircraft_id from public.nadd n where n.id = p_id)
         end;
$$;

-- The holds still in force on a case.
create or replace function app.case_live_holds(p_table text, p_id uuid)
returns setof public.case_hold
language sql stable security definer set search_path = ''
as $$
  select h.* from public.case_hold h
   where h.record_table = p_table and h.record_id = p_id and h.released_at is null
     and h.seen_at > now() - make_interval(mins => coalesce((app.setting('case.hold_minutes'))::integer, 30));
$$;

-- Do two people share a department?
create or replace function app.share_department(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.department d
                  where app.person_has_department(p_a, d.code) and app.person_has_department(p_b, d.code));
$$;

-- Open a case to work on it. Engineers take (or refresh) the hold, unless
-- someone from their department already has it in hand.
create or replace function app.take_case(p_table text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := app.current_person_id();
  v_aircraft uuid := app.case_aircraft(p_table, p_id);
  o          record;
begin
  if v_me is null or v_aircraft is null or not app.can_see_aircraft(v_aircraft) then
    raise exception 'Case not found, or not in your view.' using errcode = '42501';
  end if;
  select h.held_by, h.taken_at, p.three_letter_code, p.full_name into o
    from app.case_live_holds(p_table, p_id) h join public.person p on p.id = h.held_by
   where h.held_by <> v_me and app.share_department(h.held_by, v_me)
   order by h.taken_at limit 1;
  if found then
    return jsonb_build_object('mine', false, 'held_by', o.three_letter_code, 'held_by_name', o.full_name,
                              'since', o.taken_at);
  end if;
  if not app.has_department('ENG') then
    return jsonb_build_object('mine', false);          -- readers (Quality, Command …) never take a hold
  end if;
  -- A hold of mine that timed out is closed before a new one starts.
  update public.case_hold set released_at = now(), released_by = v_me, release_reason = 'Timed out'
   where record_table = p_table and record_id = p_id and held_by = v_me and released_at is null
     and not exists (select 1 from app.case_live_holds(p_table, p_id) l where l.id = case_hold.id);
  update public.case_hold set seen_at = now()
   where record_table = p_table and record_id = p_id and held_by = v_me and released_at is null;
  if not found then
    insert into public.case_hold (record_table, record_id, aircraft_id, held_by)
    values (p_table, p_id, v_aircraft, v_me);
  end if;
  perform app.follow_case(case when p_table = 'work_order' then 'work_order' else p_table end, p_id);
  return jsonb_build_object('mine', true);
end;
$$;

-- Leaving the page.
create or replace function app.release_case(p_table text, p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.case_hold set released_at = now(), released_by = app.current_person_id(), release_reason = 'Left the case'
   where record_table = p_table and record_id = p_id and held_by = app.current_person_id() and released_at is null;
$$;

-- A Super Admin or Command releases someone else's hold.
create or replace function app.force_release_case(p_table text, p_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := app.current_person_id();
  v_count integer;
  v_who   text;
begin
  if v_me is null or not (app.is_super_admin() or app.has_department('CMD')) then
    raise exception 'Only a Super Admin or Command can release a case someone has in hand.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for releasing it.' using errcode = '23514';
  end if;
  select string_agg(p.three_letter_code, ', ') into v_who
    from public.case_hold h join public.person p on p.id = h.held_by
   where h.record_table = p_table and h.record_id = p_id and h.released_at is null and h.held_by <> v_me;
  update public.case_hold set released_at = now(), released_by = v_me, release_reason = trim(p_reason)
   where record_table = p_table and record_id = p_id and released_at is null and held_by <> v_me;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Nobody else has this case in hand.' using errcode = 'P0001';
  end if;
  insert into public.case_message (record_table, record_id, aircraft_id, body, author, kind)
  values (app.case_thread_table(p_table, p_id), app.case_thread_id(p_table, p_id), app.case_aircraft(p_table, p_id),
          'Released from ' || v_who || ': ' || trim(p_reason), v_me, 'system');
  return v_count;
end;
$$;

-- ------------------------------------------------------------ case chat -----
-- A work order with a snag talks in its snag's thread.
create or replace function app.case_thread_table(p_table text, p_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when p_table = 'work_order'
                   and (select w.snag_id from public.work_order w where w.id = p_id) is not null
              then 'snag' else p_table end;
$$;
create or replace function app.case_thread_id(p_table text, p_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when p_table = 'work_order'
              then coalesce((select w.snag_id from public.work_order w where w.id = p_id), p_id) else p_id end;
$$;

create table public.case_message (
  id           uuid primary key default gen_random_uuid(),
  record_table text not null check (record_table in ('snag', 'work_order', 'nadd')),
  record_id    uuid not null,
  aircraft_id  uuid not null references public.aircraft (id),
  body         text not null check (length(trim(body)) between 1 and 2000),
  author       uuid not null references public.person (id),
  kind         text not null default 'message' check (kind in ('message', 'system')),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  device_time  timestamptz
);
comment on table public.case_message is 'Case chat: short messages on a snag (and its work order) or a NADD. Append-only.';
create index case_message_thread on public.case_message (record_table, record_id, created_at);
create trigger a1_no_update before update on public.case_message
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.case_message');
alter table public.case_message enable row level security;
create policy read_with_record on public.case_message for select to authenticated
  using (app.can_see_record(record_table, record_id));
revoke update, delete, truncate on public.case_message from anon, authenticated;
revoke all on public.case_message from anon;

-- Who follows a thread, and up to when they have read it.
create table public.case_message_read (
  person_id    uuid not null references public.person (id),
  record_table text not null,
  record_id    uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (person_id, record_table, record_id)
);
alter table public.case_message_read enable row level security;
create policy read_own on public.case_message_read for select to authenticated
  using (person_id = app.current_person_id());
revoke insert, update, delete, truncate on public.case_message_read from anon, authenticated;

create or replace function app.follow_case(p_table text, p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.case_message_read (person_id, record_table, record_id, last_read_at)
  select app.current_person_id(), app.case_thread_table(p_table, p_id), app.case_thread_id(p_table, p_id), now()
   where app.current_person_id() is not null
  on conflict (person_id, record_table, record_id) do update set last_read_at = now();
$$;

-- Posting: the signed-in person inserts the message; the table's rule checks
-- they can see the case (as themselves), and a trigger fills in the author,
-- the aircraft and the kind, so nobody can post as someone else.
create or replace function app.fill_case_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.aircraft_id := app.case_aircraft(new.record_table, new.record_id);
  -- People may only write record, case and text (column grant below), so
  -- the kind stays "message"; the author is always the signed-in person.
  new.author := coalesce(app.current_person_id(), new.author);
  new.body := trim(new.body);
  return new;
end;
$$;
create trigger a0_fill before insert on public.case_message
  for each row execute function app.fill_case_message();
grant insert (record_table, record_id, body) on public.case_message to authenticated;
create policy post_if_visible on public.case_message for insert to authenticated
  with check (app.current_person_id() is not null and app.can_see_record(record_table, record_id));

-- Post a message on a case (a work order posts in its snag's thread).
create or replace function app.post_case_message(p_table text, p_id uuid, p_body text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text := app.case_thread_table(p_table, p_id);
  v_id    uuid := app.case_thread_id(p_table, p_id);
  v_msg   uuid;
begin
  if app.current_person_id() is null or not app.can_see_record(v_table, v_id) then
    raise exception 'Case not found, or not in your view.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Write a message.' using errcode = '23514';
  end if;
  insert into public.case_message (record_table, record_id, body) values (v_table, v_id, p_body)
  returning id into v_msg;
  perform app.follow_case(v_table, v_id);
  return v_msg;
end;
$$;

-- The thread on a case, oldest first; opening it marks it read.
create or replace function app.case_messages(p_table text, p_id uuid)
returns table (id uuid, body text, kind text, author text, author_name text, created_at timestamptz, mine boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text := app.case_thread_table(p_table, p_id);
  v_id    uuid := app.case_thread_id(p_table, p_id);
begin
  if not app.can_see_record(v_table, v_id) then
    raise exception 'Case not found, or not in your view.' using errcode = '42501';
  end if;
  perform app.follow_case(v_table, v_id);
  return query
    select m.id, m.body, m.kind, p.three_letter_code, p.full_name, m.created_at, m.author = app.current_person_id()
      from public.case_message m join public.person p on p.id = m.author
     where m.record_table = v_table and m.record_id = v_id
     order by m.created_at;
end;
$$;

-- Threads I follow that have messages from others since I last read them.
create or replace function app.my_case_threads()
returns table (record_table text, record_id uuid, aircraft_id uuid, title text, unread integer,
               last_body text, last_author text, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.record_table, r.record_id, m.aircraft_id,
         a.tail || ' · ' || coalesce(
           (select s.number || ' ' || left(s.description, 60) from public.snag s where r.record_table = 'snag' and s.id = r.record_id),
           (select app.work_order_label(w.number, w.revision) from public.work_order w where r.record_table = 'work_order' and w.id = r.record_id),
           (select n.number from public.nadd n where r.record_table = 'nadd' and n.id = r.record_id), ''),
         m.unread, m.body, p.three_letter_code, m.created_at
    from public.case_message_read r
    join lateral (
      select x.aircraft_id, x.body, x.author, x.created_at,
             count(*) over ()::integer as unread
        from public.case_message x
       where x.record_table = r.record_table and x.record_id = r.record_id
         and x.created_at > r.last_read_at and x.author <> r.person_id
       order by x.created_at desc limit 1) m on true
    join public.aircraft a on a.id = m.aircraft_id
    join public.person p on p.id = m.author
   where r.person_id = app.current_person_id() and app.can_see_aircraft(m.aircraft_id)
   order by m.created_at desc;
$$;

create or replace function app.my_unread_messages()
returns integer
language sql stable security definer set search_path = ''
as $$ select coalesce(sum(unread), 0)::integer from app.my_case_threads(); $$;

grant execute on function
  app.take_case(text, uuid), app.release_case(text, uuid), app.force_release_case(text, uuid, text),
  app.post_case_message(text, uuid, text), app.case_messages(text, uuid),
  app.my_case_threads(), app.my_unread_messages(), app.follow_case(text, uuid)
to authenticated;
