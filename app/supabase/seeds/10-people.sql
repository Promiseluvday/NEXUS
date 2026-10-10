-- =============================================================================
-- Nexus MRO · Fictional sample data: people, qualifications, authorizations
-- (migration 0026). Local development ONLY (D-112). Everything is invented.
-- Proprietary to Liebetag. All rights reserved.
--
-- Loaded after seed.sql (people and IDs are defined there).
--   * Who approves certifying authorizations: the Engineering CO appointment
--     (operator set-up of the approval chain, D-032, D-078).
--   * PLA (pilot): a licence and a G550 type rating that is APPROACHING
--     expiry (inside the 60-day margin), to show the amber flag.
--   * KDO (duty engineer): a new A330-200 authorization issued by Quality and
--     WAITING for the CO in the Approvals inbox. Even once approved KDO cannot
--     certify until Quality records a current licence (KDO's has expired):
--     the screen shows why (D-043).
-- =============================================================================

-- Who approves: the Engineering CO (acting deputies count, D-036).
insert into public.approval_chain_step (action_type, step_no, name, department_code, appointment_id) values
  ('certifying_authorization', 1, 'CO / ECO approval', null, '30000000-0000-0000-0000-000000000002');

-- Pilot's licence and type rating, recorded by Quality (QAR).
insert into public.qualification (person_id, kind, reference, licence_category, aircraft_type_code,
                                  issuing_authority, issued_on, expires_on, recorded_by) values
  ('10000000-0000-0000-0000-000000000007', 'licence',     'PL-[SAMPLE-007]', '[Category]', null,
   '[Authority]', '2024-04-01', '2029-03-31', '10000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000007', 'type_rating', 'TR-[SAMPLE-007]', null,         'G550',
   '[Authority]', '2025-11-05', current_date + 25, '10000000-0000-0000-0000-000000000004');

-- KDO: renewal of the expired A330-200 authorization, waiting for the CO.
insert into public.certifying_authorization (person_id, reference, aircraft_type_code, valid_from, expires_on, issued_by)
values ('10000000-0000-0000-0000-000000000005', 'QA/AUTH/[SAMPLE-0003]',
        'A330-200', current_date, current_date + 365, '10000000-0000-0000-0000-000000000004');

insert into public.approval_request (action_type, record_table, record_id, summary, raised_by, raised_at)
select 'certifying_authorization', 'certifying_authorization', c.id,
       format('Certifying authorization %s · %s · for %s %s · valid %s to %s', c.reference, c.aircraft_type_code,
              p.three_letter_code, p.full_name, to_char(c.valid_from, 'DD Mon YYYY'), to_char(c.expires_on, 'DD Mon YYYY')),
       c.issued_by, now() - interval '3 hours'
  from public.certifying_authorization c join public.person p on p.id = c.person_id
 where c.reference = 'QA/AUTH/[SAMPLE-0003]';
