-- =============================================================================
-- Nexus MRO · Phase 0 · 0003 Operator settings
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   "Configure, don't hard-code" (D-025). Anything that differs between
--   operators (NADD limit, counting conventions, labels, number formats...) is
--   a setting, not a value written into the code.
--
--   Settings are append-only: changing one adds a new version with who, when,
--   why and the authority reference. The newest version is the one in force.
--   Older versions stay, so you can always see what applied on a given date.
--
--   One database per operator (agreed 9 Oct 2026), so there is no "operator"
--   column: the whole database belongs to one operator.
-- =============================================================================

create table public.operator_setting (
  id             uuid primary key default gen_random_uuid(),
  key            text        not null check (key ~ '^[a-z0-9_.]+$'),
  value          jsonb       not null,
  version        integer     not null,
  reason         text        not null check (length(trim(reason)) > 0),
  authority_ref  text,                     -- e.g. a CO's approval reference
  effective_from timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid,                     -- person (set automatically)
  device_time    timestamptz,
  unique (key, version)
);

comment on table public.operator_setting is 'Versioned operator settings (D-025). Append-only; newest version per key is in force.';

-- Number each new version of a key automatically: 1, 2, 3 ...
create or replace function app.next_setting_version()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('setting:' || new.key));
  select coalesce(max(s.version), 0) + 1 into new.version
    from public.operator_setting s where s.key = new.key;
  return new;
end;
$$;

create trigger a0_next_version before insert on public.operator_setting
  for each row execute function app.next_setting_version();
create trigger a1_no_update before update on public.operator_setting
  for each row execute function app.forbid_update();

select app.apply_standard_rules('public.operator_setting');

-- The settings currently in force (newest version of each key).
create view public.operator_setting_current
with (security_invoker = true) as
select distinct on (s.key)
       s.key, s.value, s.version, s.effective_from, s.created_by, s.reason, s.authority_ref
  from public.operator_setting s
 where s.effective_from <= now()
 order by s.key, s.version desc;

-- Read one setting's current value from inside the database.
create or replace function app.setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.value from public.operator_setting s
   where s.key = p_key and s.effective_from <= now()
   order by s.version desc limit 1;
$$;
