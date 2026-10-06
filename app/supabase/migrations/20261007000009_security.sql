-- =============================================================================
-- Nexus MRO · Phase 0 · 0009 Security: row-level locks
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   Row-level security (RLS) is a lock on every single row. When a screen
--   asks the database for data, the database itself filters it down to what
--   that user may see. Hiding things only on screen is not enough, because
--   anyone can ask the database directly (D-125).
--
--   For every table we say who may READ, who may ADD, and who may CHANGE.
--   Nobody may delete (D-023): there are no delete rules at all, and the
--   triggers from 0001 refuse deletes anyway.
--
--   Anonymous visitors (not signed in) get nothing.
-- =============================================================================

-- Turn the locks on for every table. With RLS on and no rule, nobody sees anything.
alter table public.operator_setting        enable row level security;
alter table public.person                  enable row level security;
alter table public.user_account            enable row level security;
alter table public.department              enable row level security;
alter table public.engineering_section     enable row level security;
alter table public.appointment             enable row level security;
alter table public.appointment_holder      enable row level security;
alter table public.appointment_deputy      enable row level security;
alter table public.aircraft_type           enable row level security;
alter table public.aircraft                enable row level security;
alter table public.store                   enable row level security;
alter table public.permission              enable row level security;
alter table public.access_grant            enable row level security;
alter table public.qualification           enable row level security;
alter table public.certifying_authorization enable row level security;
alter table audit.log                      enable row level security;

-- No deletes, no truncates, nothing for anonymous visitors.
revoke delete, truncate on all tables in schema public from anon, authenticated, service_role;
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Reference lists everyone signed in can read (labels, codes).
-- Changes to them come through set-up, not the app, in Phase 0.
-- -----------------------------------------------------------------------------
create policy read_signed_in on public.department          for select to authenticated using (true);
create policy read_signed_in on public.engineering_section for select to authenticated using (true);
create policy read_signed_in on public.aircraft_type       for select to authenticated using (true);
create policy read_signed_in on public.permission          for select to authenticated using (true);
create policy read_signed_in on public.appointment         for select to authenticated using (true);
create policy read_signed_in on public.appointment_holder  for select to authenticated using (true);
create policy read_signed_in on public.appointment_deputy  for select to authenticated using (true);

-- Appointments, holders and deputies: changed only by the Commander / CEO (D-035).
create policy write_global_admin on public.appointment        for insert to authenticated with check (app.is_global_super_admin());
create policy edit_global_admin  on public.appointment        for update to authenticated using (app.is_global_super_admin()) with check (app.is_global_super_admin());
create policy write_global_admin on public.appointment_holder for insert to authenticated with check (app.is_global_super_admin());
create policy edit_global_admin  on public.appointment_holder for update to authenticated using (app.is_global_super_admin()) with check (app.is_global_super_admin());
create policy write_global_admin on public.appointment_deputy for insert to authenticated with check (app.is_global_super_admin());
create policy edit_global_admin  on public.appointment_deputy for update to authenticated using (app.is_global_super_admin()) with check (app.is_global_super_admin());

-- -----------------------------------------------------------------------------
-- Operator settings: everyone signed in reads; Super Admins add new versions
-- (D-025). Requirement changes that need Quality + CO (D-083) get their own
-- approval flow later.
-- -----------------------------------------------------------------------------
create policy read_signed_in   on public.operator_setting for select to authenticated using (true);
create policy add_super_admin  on public.operator_setting for insert to authenticated with check (app.is_super_admin());

-- -----------------------------------------------------------------------------
-- People: names and 3LCs are visible to everyone signed in (they appear on
-- every record). Super Admins add and correct them.
-- -----------------------------------------------------------------------------
create policy read_signed_in   on public.person for select to authenticated using (true);
create policy add_super_admin  on public.person for insert to authenticated with check (app.is_super_admin());
create policy edit_super_admin on public.person for update to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- Accounts: you see your own; Super Admins and oversight see all (D-122, D-126).
create policy read_own_or_admin on public.user_account for select to authenticated
  using (id = auth.uid() or app.is_super_admin() or app.is_oversight());
create policy add_super_admin   on public.user_account for insert to authenticated with check (app.is_super_admin());
create policy edit_super_admin  on public.user_account for update to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- -----------------------------------------------------------------------------
-- Aircraft: you see the tails in your aircraft scope (D-121); oversight and
-- Super Admins see all. Super Admins add and deactivate (D-015).
-- -----------------------------------------------------------------------------
create policy read_in_scope    on public.aircraft for select to authenticated using (app.can_see_aircraft(id));
create policy add_super_admin  on public.aircraft for insert to authenticated with check (app.is_super_admin());
create policy edit_super_admin on public.aircraft for update to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- Stores: you see the stores you hold (D-152); oversight sees all.
create policy read_in_scope on public.store for select to authenticated using (app.can_see_store(code));

-- -----------------------------------------------------------------------------
-- Access grants: you see your own; Super Admins and oversight see all.
-- Adding and revoking: Super Admins only. The trigger in 0007 checks reach,
-- self-grants and the Quality-cost rule.
-- -----------------------------------------------------------------------------
create policy read_own_or_admin on public.access_grant for select to authenticated
  using (person_id = app.current_person_id() or app.is_super_admin() or app.is_oversight());
create policy add_super_admin   on public.access_grant for insert to authenticated with check (app.is_super_admin());
create policy edit_super_admin  on public.access_grant for update to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- -----------------------------------------------------------------------------
-- Qualifications: you see your own; Quality, Command and Super Admins see all.
-- Quality records them.
-- -----------------------------------------------------------------------------
create policy read_own_or_oversight on public.qualification for select to authenticated
  using (person_id = app.current_person_id() or app.is_oversight() or app.is_super_admin());
create policy add_quality  on public.qualification for insert to authenticated with check (app.has_department('QUA'));
create policy edit_quality on public.qualification for update to authenticated using (app.has_department('QUA')) with check (app.has_department('QUA'));

-- Certifying authorizations: everyone signed in can see who is authorized
-- (needed to assign certifiers, D-032). Quality issues; CO/ECO approves;
-- the trigger in 0008 enforces who does which step.
create policy read_signed_in on public.certifying_authorization for select to authenticated using (true);
create policy add_quality    on public.certifying_authorization for insert to authenticated with check (app.has_department('QUA'));
create policy edit_issuer_or_approver on public.certifying_authorization for update to authenticated
  using (app.has_department('QUA') or app.can_approve_authorizations())
  with check (app.has_department('QUA') or app.can_approve_authorizations());

-- -----------------------------------------------------------------------------
-- Audit log: read by Quality, Command and Super Admins (D-126). Nobody writes
-- to it directly; only the audit trigger does.
-- -----------------------------------------------------------------------------
grant usage on schema audit to authenticated;
grant select on audit.log to authenticated;
create policy read_oversight on audit.log for select to authenticated
  using (app.is_oversight() or app.is_super_admin());

-- Helper functions are callable by signed-in users (they only answer about
-- the signed-in person, or check rules).
grant usage on schema app to authenticated;
revoke all on all functions in schema app from anon;
