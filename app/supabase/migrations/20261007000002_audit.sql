-- =============================================================================
-- Nexus MRO · Phase 0 · 0002 Audit trail
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   Every time any record is created or changed, a line is written to the
--   audit log: what changed, from what, to what, by whom, when.
--
--   The log is "hash-chained" (D-038). Each line carries a fingerprint made
--   from its own contents PLUS the previous line's fingerprint. If anyone
--   edits an old line, its fingerprint no longer matches, and every line after
--   it breaks too. audit.verify_chain() walks the log and reports the first
--   broken line.
--
--   The log itself cannot be edited or deleted.
--
-- Known limit (to close in Phase 4, D-038): the chain shows edits, but if the
-- newest lines were removed by someone with full database control, the chain
-- would still look whole. A copy sent to a separate machine fixes that.
-- =============================================================================

create schema if not exists audit;
comment on schema audit is 'Tamper-evident audit log (D-038). Read access: Quality, Command, Super Admins (D-126).';

create table audit.log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default clock_timestamp(),
  table_name    text        not null,
  row_id        text,
  action        text        not null check (action in ('INSERT', 'UPDATE')),
  actor_user    uuid,          -- sign-in id (auth.uid()); null for set-up scripts
  actor_role    text not null, -- database role the change came through
  old_data      jsonb,         -- the record before the change (updates only)
  new_data      jsonb not null,-- the record after the change
  prev_hash     text not null, -- fingerprint of the line before
  hash          text not null  -- fingerprint of this line
);

comment on table audit.log is 'Append-only, hash-chained record of every insert and update (D-023, D-038).';

-- -----------------------------------------------------------------------------
-- The fingerprint recipe. Kept in one function so writing and checking use
-- exactly the same steps. Time is written in UTC so the result never depends
-- on anyone's time-zone setting.
-- -----------------------------------------------------------------------------
create or replace function audit.fingerprint(
  p_prev_hash text, p_at timestamptz, p_table text, p_action text,
  p_actor uuid, p_old jsonb, p_new jsonb)
returns text
language sql
immutable
as $$
  select encode(
    sha256(convert_to(concat_ws('|',
      p_prev_hash,
      to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
      p_table,
      p_action,
      coalesce(p_actor::text, ''),
      coalesce(p_old::text, ''),
      p_new::text), 'UTF8')),
    'hex');
$$;

-- -----------------------------------------------------------------------------
-- The trigger that writes each audit line. "security definer" means it runs
-- with the database owner's rights, so ordinary users can trigger an audit
-- line but can never write to the log directly.
-- -----------------------------------------------------------------------------
create or replace function audit.capture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev  text;
  v_at    timestamptz := clock_timestamp();
  v_uid   uuid;
  v_old   jsonb;
  v_new   jsonb := to_jsonb(new);
  v_table text  := tg_table_schema || '.' || tg_table_name;
  v_role  text  := coalesce(nullif(current_setting('role', true), 'none'), session_user);
begin
  -- One writer at a time, so the chain never forks.
  perform pg_advisory_xact_lock(hashtext('nexus_audit_chain'));

  select l.hash into v_prev from audit.log l order by l.id desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');

  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
  end if;

  insert into audit.log (at, table_name, row_id, action, actor_user, actor_role,
                         old_data, new_data, prev_hash, hash)
  values (v_at, v_table, v_new ->> 'id', tg_op, v_uid, v_role,
          v_old, v_new, v_prev,
          audit.fingerprint(v_prev, v_at, v_table, tg_op, v_uid, v_old, v_new));

  return null;  -- AFTER trigger: return value is ignored
end;
$$;

-- -----------------------------------------------------------------------------
-- The log cannot be edited, deleted or emptied.
-- -----------------------------------------------------------------------------
create or replace function audit.forbid_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log cannot be changed or deleted (D-038).'
    using errcode = 'P0001';
end;
$$;

create trigger audit_log_no_update before update on audit.log
  for each row execute function audit.forbid_change();
create trigger audit_log_no_delete before delete on audit.log
  for each row execute function audit.forbid_change();
create trigger audit_log_no_truncate before truncate on audit.log
  for each statement execute function audit.forbid_change();

-- -----------------------------------------------------------------------------
-- Check the whole chain. Returns nothing if the log is intact, or the first
-- broken line and why.
-- -----------------------------------------------------------------------------
create or replace function audit.verify_chain()
returns table (broken_at_id bigint, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r      record;
  v_prev text := 'GENESIS';
begin
  for r in select * from audit.log order by id loop
    if r.prev_hash <> v_prev then
      broken_at_id := r.id;
      reason := 'Link to the previous line is broken (a line was changed or removed).';
      return next;
      return;
    end if;
    if audit.fingerprint(r.prev_hash, r.at, r.table_name, r.action,
                         r.actor_user, r.old_data, r.new_data) <> r.hash then
      broken_at_id := r.id;
      reason := 'This line''s contents do not match its fingerprint (it was edited).';
      return next;
      return;
    end if;
    v_prev := r.hash;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- One helper to plug any table into all the standard rules:
--   * server time and author on every row        (D-024)
--   * no delete, no truncate                      (D-023)
--   * every insert and update written to the log (D-038)
-- The table must have created_at, created_by and device_time columns.
-- -----------------------------------------------------------------------------
create or replace function app.apply_standard_rules(p_table regclass)
returns void
language plpgsql
as $$
begin
  execute format('create trigger aa_server_time before insert or update on %s
                    for each row execute function app.stamp_server_time()', p_table);
  execute format('create trigger zz_no_delete before delete on %s
                    for each row execute function app.forbid_delete()', p_table);
  execute format('create trigger zz_no_truncate before truncate on %s
                    for each statement execute function app.forbid_delete()', p_table);
  execute format('create trigger zz_audit after insert or update on %s
                    for each row execute function audit.capture()', p_table);
end;
$$;

-- Nobody reads or writes the log through the API except via the rules in 0009.
revoke all on audit.log from anon, authenticated;
