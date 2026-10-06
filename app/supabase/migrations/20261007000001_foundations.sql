-- =============================================================================
-- Nexus MRO · Phase 0 · 0001 Foundations
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   1. Creates a private "app" area for Nexus's helper functions.
--   2. Adds the rule that NOTHING is ever deleted (D-023). Any attempt to delete
--      or empty a table is refused with an explanation.
--   3. Adds the rule that the SERVER's clock is the one that counts (D-024).
--      The device's own time can be stored alongside, but never replaces it.
--
-- Every table built later is plugged into these rules with one line:
--     select app.apply_standard_rules('public.<table>');
-- (that helper is defined in 0002, once the audit log exists).
-- =============================================================================

create schema if not exists app;
comment on schema app is 'Nexus MRO helper functions. Not exposed to the API directly.';

-- pgcrypto gives us safe password-style hashing for signing PINs (0004).
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Rule D-023: no hard deletes, ever.
-- Used as a trigger on every table. It fires BEFORE a delete or truncate and
-- stops it. This works even for database administrators, unless they
-- deliberately switch the trigger off (which is itself visible in the logs).
-- -----------------------------------------------------------------------------
create or replace function app.forbid_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Nexus records are never deleted (D-023). Deactivate or correct with a new version instead. Table: %.%',
    tg_table_schema, tg_table_name
    using errcode = 'P0001';
end;
$$;

-- -----------------------------------------------------------------------------
-- Rule for append-only tables (e.g. settings history): rows can be added, never
-- changed. A change is made by adding a new row (a new version).
-- -----------------------------------------------------------------------------
create or replace function app.forbid_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This record is append-only (D-023). Add a new version instead of editing. Table: %.%',
    tg_table_schema, tg_table_name
    using errcode = 'P0001';
end;
$$;

-- -----------------------------------------------------------------------------
-- Rule D-024: server time is authoritative.
-- Every standard table has: created_at (server time), created_by (person) and
-- device_time (optional, what the phone or PC said).
--   * On insert: created_at is forced to the server's clock, whatever the
--     device sent. created_by is set to the signed-in person when known.
--   * On update: created_at and created_by can never be changed.
-- -----------------------------------------------------------------------------
create or replace function app.stamp_server_time()
returns trigger
language plpgsql
as $$
declare
  v_person uuid;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    v_person := app.current_person_id();       -- defined in 0004
    if v_person is not null then
      new.created_by := v_person;
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Database-level privileges: the API roles can never delete or truncate.
-- (The trigger above is the second lock on the same door.)
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke delete, truncate on tables from anon, authenticated, service_role;
