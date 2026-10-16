-- =============================================================================
-- Nexus MRO · Migration 0036 · Account lock, idle sign-out, closing queries
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (Promise, 14 Oct; D-232, D-233, D-237):
--   1. ACCOUNT LOCK. Every password attempt passes through a database check
--      (Supabase's "password verification" hook). After 5 wrong passwords in
--      a row (setting auth.max_failed_sign_ins) the account locks; even the
--      right password is then refused until a Super Admin unlocks it, with a
--      reason and their PIN. The lock and the unlock go in the change log.
--      A right password resets the count.
--   2. IDLE SIGN-OUT. The app signs out after 30 minutes without activity
--      (setting auth.idle_minutes). Only the setting lives here.
--   3. CLOSING QUERIES. Anyone who can see a query may close it (no longer
--      only whoever raised it). When the case closes (the snag is closed,
--      e.g. by certifying its work order, or a NADD is rectified), its open
--      queries close by themselves, with the reason recorded.
-- =============================================================================

insert into public.operator_setting (key, value, reason) values
  ('auth.max_failed_sign_ins', '5',  'Initial set-up: wrong passwords before an account locks'),
  ('auth.idle_minutes',        '30', 'Initial set-up: minutes without activity before signing out');

-- ------------------------------------------------------- 1. account lock -----
alter table public.user_account
  add column failed_sign_ins integer not null default 0 check (failed_sign_ins >= 0),
  add column locked_at       timestamptz;

-- Called by Supabase Auth on every password attempt (config.toml:
-- [auth.hook.password_verification_attempt]). Event: {"user_id", "valid"}.
create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (event ->> 'user_id')::uuid;
  v_valid boolean := coalesce((event ->> 'valid')::boolean, false);
  v_max   integer := coalesce((app.setting('auth.max_failed_sign_ins'))::integer, 5);
  a       public.user_account;
  v_count integer;
begin
  select * into a from public.user_account where id = v_user for update;
  if not found then
    return jsonb_build_object('decision', 'continue');   -- not a Nexus account
  end if;
  if a.locked_at is not null then
    return jsonb_build_object('decision', 'reject', 'should_logout_user', true,
      'message', 'This account is locked after too many wrong passwords. Ask your Super Admin to unlock it.');
  end if;
  if v_valid then
    if a.failed_sign_ins > 0 then
      update public.user_account set failed_sign_ins = 0 where id = v_user;
    end if;
    return jsonb_build_object('decision', 'continue');
  end if;

  v_count := a.failed_sign_ins + 1;
  if v_count >= v_max then
    update public.user_account set failed_sign_ins = v_count, locked_at = now() where id = v_user;
    insert into public.account_event (person_id, what, from_value, to_value, reason, done_by)
    values (a.person_id, 'Account locked', 'Unlocked', 'Locked',
            v_count || ' wrong passwords in a row', a.person_id);
    return jsonb_build_object('decision', 'reject', 'should_logout_user', true,
      'message', 'Too many wrong passwords: this account is now locked. Ask your Super Admin to unlock it.');
  end if;
  update public.user_account set failed_sign_ins = v_count where id = v_user;
  return jsonb_build_object('decision', 'continue');      -- Auth then reports the wrong password
end;
$$;
revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant usage on schema app to supabase_auth_admin;

-- The Super Admin's view of the lock, for the account page.
create or replace function app.admin_lock_state(p_person uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('locked_at', a.locked_at, 'failed_sign_ins', a.failed_sign_ins)
    from public.user_account a
   where a.person_id = p_person and app.is_super_admin()
     and (app.is_global_super_admin() or app.is_super_admin(app.person_admin_department(p_person)));
$$;

create or replace function app.admin_unlock_account(p_person uuid, p_reason text, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid;
  a    public.user_account;
begin
  v_me := app.admin_check(p_person, p_reason, p_pin);
  select * into a from public.user_account where person_id = p_person for update;
  if not found or a.locked_at is null then
    raise exception 'This account is not locked.' using errcode = 'P0001';
  end if;
  update public.user_account set locked_at = null, failed_sign_ins = 0 where id = a.id;
  insert into public.account_event (person_id, what, from_value, to_value, reason, done_by)
  values (p_person, 'Account unlocked', 'Locked', 'Unlocked', trim(p_reason), v_me);
end;
$$;

grant execute on function app.admin_lock_state(uuid), app.admin_unlock_account(uuid, text, text) to authenticated;

-- ------------------------------------------------------ 3. closing queries -----
alter table public.technical_query add column closed_reason text;

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
    new.status    := 'open'; new.closed_by := null; new.closed_at := null; new.closed_reason := null;
    return new;
  end if;
  if (to_jsonb(new) - array['status','closed_by','closed_at','closed_reason','created_at','created_by'])
     is distinct from (to_jsonb(old) - array['status','closed_by','closed_at','closed_reason','created_at','created_by']) then
    raise exception 'A query is never edited; add a note instead.' using errcode = 'P0001';
  end if;
  if old.status = 'closed' then
    raise exception 'This query is already closed.' using errcode = 'P0001';
  end if;
  if new.status = 'closed' then
    -- An automatic close (case closed) passes who closed the case.
    new.closed_by := coalesce(app.current_person_id(), new.closed_by);
    new.closed_at := now();
  end if;
  return new;
end;
$$;

drop policy close_by_raiser on public.technical_query;
create policy close_if_visible on public.technical_query for update to authenticated
  using (app.can_see_record(record_table, record_id)
         and app.involved_in_query(raised_by, assigned_person, assigned_department))
  with check (app.can_see_record(record_table, record_id));

-- Close the open queries of a case that has just closed.
create or replace function app.close_case_queries(p_tables text[], p_ids uuid[], p_reason text, p_by uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.technical_query q
     set status = 'closed', closed_reason = p_reason, closed_by = p_by
   where q.status = 'open'
     and exists (select 1 from unnest(p_tables, p_ids) as c(t, i) where c.t = q.record_table and c.i = q.record_id);
$$;

create or replace function app.queries_close_with_snag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tables text[] := array['snag'];
  v_ids    uuid[] := array[new.id];
  w        record;
begin
  if new.status <> 'closed' or old.status = 'closed' then
    return null;
  end if;
  for w in select id from public.work_order where snag_id = new.id loop
    v_tables := v_tables || 'work_order'::text;
    v_ids    := v_ids || w.id;
  end loop;
  for w in select id from public.nadd where snag_id = new.id loop
    v_tables := v_tables || 'nadd'::text;
    v_ids    := v_ids || w.id;
  end loop;
  perform app.close_case_queries(v_tables, v_ids, 'Closed automatically: ' || new.number || ' closed', new.closed_by);
  return null;
end;
$$;
create trigger queries_close_with_snag after update of status on public.snag
  for each row execute function app.queries_close_with_snag();

-- A NADD with no snag (a cabin item) rectified directly.
create or replace function app.queries_close_with_nadd()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'rectified' or old.status = 'rectified' then
    return null;
  end if;
  perform app.close_case_queries(array['nadd'], array[new.id], 'Closed automatically: ' || new.number || ' rectified', new.rectified_by);
  return null;
end;
$$;
create trigger queries_close_with_nadd after update of status on public.nadd
  for each row execute function app.queries_close_with_nadd();
