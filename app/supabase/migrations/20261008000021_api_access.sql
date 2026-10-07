-- =============================================================================
-- Nexus MRO · Phase 1 · 0021 Which functions the app may call
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   The screens talk to the database by calling the functions in the "app"
--   area (report_snag, apply_mel, certify_work_order...). By default
--   PostgreSQL lets EVERYONE run EVERY function. That would let someone call
--   an internal helper directly and skip the checks around it.
--
--   So: lock every function first, then unlock only:
--     * the ACTIONS a signed-in user is meant to take (each one checks who
--       you are and what you may do), and
--     * the QUESTIONS the security rules ask (e.g. "can this user see this
--       aircraft?"), which run with the user's own rights.
--   Internal helpers stay locked. They still work when an action calls them,
--   because actions run with the database owner's rights.
--   Anonymous visitors can run nothing.
-- =============================================================================

revoke execute on all functions in schema app   from public, anon, authenticated;
revoke execute on all functions in schema audit from public, anon, authenticated;

-- New functions added to these schemas later start locked too.
alter default privileges in schema app   revoke execute on functions from public;
alter default privileges in schema audit revoke execute on functions from public;

grant usage on schema app to authenticated;

-- ------------------------------------------- questions used by the security rules
grant execute on function
  app.current_person_id(),
  app.my_active_appointments(),
  app.is_super_admin(text),
  app.is_global_super_admin(),
  app.can_approve_authorizations(),
  app.has_department(text),
  app.has_permission(text),
  app.is_oversight(),
  app.can_view_cost(),
  app.can_see_aircraft(uuid),
  app.can_see_store(text),
  app.has_section(text),
  app.holds_step(text, integer),
  app.can_see_record(text, uuid),
  app.involved_in_query(uuid, uuid, text),
  app.can_load_mel(),
  app.setting(text)
to authenticated;

-- ------------------------------------------------------------- user actions
grant execute on function
  -- accounts and PIN (D-094, D-206)
  app.request_account(text, text, text, text, text),
  app.set_my_pin(text),
  app.check_my_pin(text),
  app.my_pin_is_set(),
  app.is_certifying(uuid, text, date),
  -- approvals (D-079)
  app.decide_approval(uuid, text, text),
  -- tail status (D-046)
  app.set_tail_status(uuid, text, text, date),
  -- snags (D-040 to D-044)
  app.report_snag(uuid, text, boolean, text, text, text, text, uuid, timestamptz),
  app.attend_snag(uuid, text),
  app.close_snag_no_fault_found(uuid, text, text, text, text),
  -- work orders (D-063 to D-069)
  app.request_work_order(uuid, text, numeric),
  app.add_work_order_entry(uuid, text),
  app.complete_work_order(uuid, text),
  app.work_order_missing_scans(uuid),
  app.certify_work_order(uuid, text, text),
  -- MEL (D-050 to D-058)
  app.open_mel_revision(text, text, date, text),
  app.add_mel_items(uuid, jsonb),
  app.activate_mel_revision(uuid),
  app.search_mel(uuid, text, integer),
  -- DDLS (D-163, D-164)
  app.apply_mel(uuid, uuid, text, boolean, boolean, boolean, text, text, text, text),
  app.defer_on_ddls(uuid, integer, text, text, boolean, boolean, text, text, text, text),
  app.clear_ddls_entry(uuid, text, text, text, text),
  app.request_ddls_extension(uuid, integer, text, text),
  -- NADD and cabin items (D-160 to D-166, D-209)
  app.propose_nadd(uuid, text, text, text, text, text, text, text, uuid, timestamptz),
  app.confirm_nadd(uuid, text, boolean, integer),
  app.reject_nadd(uuid, text),
  app.reclassify_nadd_as_snag(uuid, text),
  app.defer_as_nadd(uuid, text, boolean, text, text, integer),
  app.rectify_nadd(uuid, text, text, text, text),
  app.request_nadd_extension(uuid, integer, text),
  -- repeat defects (D-208)
  app.repeat_defect(uuid),
  app.similar_snags(uuid, integer),
  -- fleet board (D-006, D-200)
  app.fleet_board()
to authenticated;

-- Quality, Command and Super Admins may check the audit chain (D-038, D-126).
grant execute on function audit.verify_chain() to authenticated;
