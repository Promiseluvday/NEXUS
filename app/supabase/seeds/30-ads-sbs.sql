-- =============================================================================
-- Nexus MRO · Sample ADs and SBs (FICTIONAL, D-112) for local development ONLY
-- Proprietary to Liebetag. All rights reserved.
--
-- Every reference below is invented ([SAMPLE-...]); none is a real AD or SB.
-- Loaded after seed.sql by `npm run db:reset`. Written straight into the
-- tables (the set-up script has no signed-in engineer), the way seed.sql
-- writes its sample snags. Shows each state the screens handle:
--   verified, awaiting verification, rejected then corrected (version 2),
--   not applicable, complied, open, Approaching and Reached by date, and
--   Approaching by hours on NX-203 (figures chosen to sit near the sample
--   flight-record totals in 20-flight-records.sql).
-- =============================================================================

-- --------------------------------------------------------- settings (D-025)
insert into public.operator_setting (key, value, reason) values
  ('adsb.approaching_days',   '30', 'Initial set-up: days before an entered AD / SB due date to flag Approaching'),
  ('adsb.approaching_hours',  '50', 'Initial set-up: flight hours before an entered AD / SB due figure'),
  ('adsb.approaching_cycles', '25', 'Initial set-up: cycles before an entered AD / SB due figure'),
  ('adsb.compliance_methods',
   '["Modification embodied", "Repetitive inspection", "Terminating action", "Inspection, no findings", "Alternative method (AMOC)"]',
   'Initial set-up: suggestions on the AD / SB entry form; engineers may type their own');

-- ------------------------------------------------------------- register
-- ids 60000000-...-0000000000NN: document versions; document_key = id for version 1.
insert into public.adsb_document (id, document_key, doc_type, reference, title, issuing_authority,
                                  aircraft_type_code, applies_to_note, revision, effective_on, entered_by) values
  ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'AD', '[SAMPLE-2025-0012]',
   '[SAMPLE] Elevator hinge fitting, repetitive inspection', '[Sample Authority]', 'G550', null, '1', '2025-03-01',
   '10000000-0000-0000-0000-000000000005'),
  ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'AD', '[SAMPLE-2024-0207]',
   '[SAMPLE] Fuel quantity probe wiring, modification', '[Sample Authority]', 'G550', null, '0', '2024-09-15',
   '10000000-0000-0000-0000-000000000005'),
  ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'SB', '[SAMPLE-32-0101]',
   '[SAMPLE] Main landing gear door actuator bracket', '[Sample Manufacturer]', 'G550', '[SAMPLE] MSN 0201 to 0204', 'A', '2026-01-10',
   '10000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', 'SB', '[SAMPLE-25-0044]',
   '[SAMPLE] Galley drain valve replacement', '[Sample Manufacturer]', 'G550', null, null, '2026-06-01',
   '10000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000011', 'AD', '[SAMPLE-2025-0031]',
   '[SAMPLE] Pack outlet duct clamp, inspection', '[Sample Authority]', 'A330-200', null, '0', '2025-07-01',
   '10000000-0000-0000-0000-000000000003'),
  ('60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000012', 'SB', '[SAMPLE-21-0150]',
   '[SAMPLE] Cabin pressure controller software update', '[Sample Manufacturer]', 'A330-200', null, '2', '2026-04-20',
   '10000000-0000-0000-0000-000000000003');

-- -------------------------------------------------------- compliance entries
-- ids 61000000-...: entry versions; entry_key = id of version 1.
insert into public.adsb_compliance (id, entry_key, version, supersedes_id, aircraft_id, document_key, document_id,
  applicability, not_applicable_reason, compliance_method, status,
  last_complied_on, last_complied_hours, last_complied_cycles,
  next_due_on, next_due_hours, next_due_cycles, next_due_text,
  compliance_reference, remarks, correction_reason, entered_by, entered_at) values
  -- NX-201: recurring (verified), complied (verified), SB open (awaiting)
  ('61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 1, null,
   '40000000-0000-0000-0000-000000000201', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'applicable', null, 'Repetitive inspection', 'recurring', '2026-08-12', 6100.0, 2990,
   '2027-08-12', 7000.0, null, '900 FH or 12 months, whichever first',
   'WO-[SAMPLE-0412]', null, null, '10000000-0000-0000-0000-000000000005', '2026-08-12 15:20+01'),
  ('61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 1, null,
   '40000000-0000-0000-0000-000000000201', '60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
   'applicable', null, 'Modification embodied', 'complied', '2025-02-03', null, null,
   null, null, null, null, 'WO-[SAMPLE-0107] · logbook entry [SAMPLE-14]', null, null,
   '10000000-0000-0000-0000-000000000006', '2025-02-03 17:05+01'),
  ('61000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', 1, null,
   '40000000-0000-0000-0000-000000000201', '60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003',
   'applicable', null, 'To be embodied at the 1200 FH inspection', 'open', null, null, null,
   null, null, null, 'Planned: at the 1200 FH inspection', null, null, null,
   '10000000-0000-0000-0000-000000000005', now() - interval '20 days'),
  -- NX-202: recurring due by date inside the margin (Approaching), SB not applicable (verified)
  ('61000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', 1, null,
   '40000000-0000-0000-0000-000000000202', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'applicable', null, 'Repetitive inspection', 'recurring', current_date - 353, null, null,
   current_date + 12, null, null, '12 months from last inspection', 'WO-[SAMPLE-0388]', null, null,
   '10000000-0000-0000-0000-000000000005', now() - interval '6 days'),
  ('61000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000005', 1, null,
   '40000000-0000-0000-0000-000000000202', '60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003',
   'not_applicable', '[SAMPLE] Bracket already of the new standard from production', null, 'not_applicable', null, null, null,
   null, null, null, null, null, null, null, '10000000-0000-0000-0000-000000000006', now() - interval '15 days'),
  -- NX-203: version 1 rejected by Quality, version 2 corrected and awaiting
  ('61000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000006', 1, null,
   '40000000-0000-0000-0000-000000000203', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'applicable', null, 'Repetitive inspection', 'recurring', '2026-09-01', 6820.0, null,
   null, 7320.0, null, null, 'WO-[SAMPLE-0455]', null, null,
   '10000000-0000-0000-0000-000000000005', now() - interval '9 days'),
  ('61000000-0000-0000-0000-000000000007', '61000000-0000-0000-0000-000000000006', 2, '61000000-0000-0000-0000-000000000006',
   '40000000-0000-0000-0000-000000000203', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'applicable', null, 'Repetitive inspection', 'recurring', '2026-09-01', 6820.0, null,
   '2027-09-01', 7320.0, null, '500 FH or 12 months, whichever first', 'WO-[SAMPLE-0455]', null,
   'Calendar limit added as Quality asked', '10000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  -- NX-204: open, due date already reached
  ('61000000-0000-0000-0000-000000000008', '61000000-0000-0000-0000-000000000008', 1, null,
   '40000000-0000-0000-0000-000000000204', '60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
   'applicable', null, 'Modification to be embodied', 'open', null, null, null,
   current_date - 2, null, null, 'Compliance by the AD date', null, '[SAMPLE] Kit on order', null,
   '10000000-0000-0000-0000-000000000006', now() - interval '30 days'),
  -- NX-101 (A330): recurring, verified
  ('61000000-0000-0000-0000-000000000011', '61000000-0000-0000-0000-000000000011', 1, null,
   '40000000-0000-0000-0000-000000000101', '60000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000011',
   'applicable', null, 'Repetitive inspection', 'recurring', current_date - 90, 18050.0, 6010,
   current_date + 90, 19650.0, null, '1,600 FH or 6 months, whichever first', 'WO-[SAMPLE-0399]', null, null,
   '10000000-0000-0000-0000-000000000003', now() - interval '90 days'),
  -- NX-102 (A330): SB open, nothing due entered
  ('61000000-0000-0000-0000-000000000012', '61000000-0000-0000-0000-000000000012', 1, null,
   '40000000-0000-0000-0000-000000000102', '60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000012',
   'applicable', null, null, 'open', null, null, null,
   null, null, null, null, null, '[SAMPLE] Review at the current check', null,
   '10000000-0000-0000-0000-000000000003', now() - interval '3 days');

-- ------------------------------------------------- Quality's decisions (QAR)
insert into public.adsb_verification (compliance_id, decision, note, decided_by, decided_at) values
  ('61000000-0000-0000-0000-000000000001', 'verified', null, '10000000-0000-0000-0000-000000000004', '2026-08-13 09:10+01'),
  ('61000000-0000-0000-0000-000000000002', 'verified', null, '10000000-0000-0000-0000-000000000004', '2025-02-04 10:00+01'),
  ('61000000-0000-0000-0000-000000000005', 'verified', null, '10000000-0000-0000-0000-000000000004', now() - interval '14 days'),
  ('61000000-0000-0000-0000-000000000006', 'rejected', 'The AD also sets a calendar limit; enter it.',
   '10000000-0000-0000-0000-000000000004', now() - interval '8 days'),
  ('61000000-0000-0000-0000-000000000011', 'verified', null, '10000000-0000-0000-0000-000000000004', now() - interval '89 days');
