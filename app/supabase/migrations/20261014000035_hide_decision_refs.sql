-- =============================================================================
-- Nexus MRO · Migration 0035 · Decision numbers stay private
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (Promise, 14 Oct):
--   The decision numbers (D-xxx) are Liebetag's internal design log. They
--   must not appear anywhere a user can see them. Earlier migrations put a
--   few into names the screens show: approval chain names (e.g.
--   "Work order (D-063)") and permission descriptions. This removes them.
--   Code comments keep their references; those are never shown.
--   (Database error messages and older setting reasons are cleaned by the
--   app before display.)
-- =============================================================================

create or replace function pg_temp.no_refs(p text)
returns text language sql immutable as $$
  select trim(regexp_replace(
           regexp_replace(p, '\s*\(D-[0-9]{3}([^()]*|\([^()]*\))*\)', '', 'g'),
           ',\s*D-[0-9]{3}(\s*,\s*D-[0-9]{3})*(?=\))', '', 'g'));
$$;

update public.approval_chain      set name = pg_temp.no_refs(name)               where name ~ 'D-[0-9]{3}';
update public.approval_chain_step set name = pg_temp.no_refs(name)               where name ~ 'D-[0-9]{3}';
update public.permission          set description = pg_temp.no_refs(description) where description ~ 'D-[0-9]{3}';
