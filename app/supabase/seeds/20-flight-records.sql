-- =============================================================================
-- Nexus MRO · Fictional sample flight records for local development ONLY (D-112)
-- Proprietary to Liebetag. All rights reserved.
--
-- Everything here is invented: NX tails, figures, places (XN.. codes) and
-- tech log references. For each tail:
--   * brought-forward totals "as at" 45 days ago, entered by the Engineering
--     CO (ABE) from the paper logbook (sample reason);
--   * about one flight a day since then, entered by the pilot (PLA) on the
--     G550s and by the Engineering CO on the A330s;
--   * one correction on NX-201 (version 2, by KDO) so the version history
--     has something to show.
-- Loaded after seed.sql (see seeds/README.md). Written directly, as seed.sql
-- does, because nobody is signed in while the sample data loads.
-- =============================================================================

-- ------------------------------------------------- brought-forward totals ---
insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, hours, hours_basis,
                                  cycles, landings, apu_hours, apu_cycles, log_ref, reason, entered_by, entered_at)
select b.id, b.id, 'baseline', b.aircraft_id, current_date - 45, b.hours, 'flight', b.cycles, b.landings,
       b.apu_hours, b.apu_cycles, '[SAMPLE] Aircraft logbook vol. 3',
       '[SAMPLE] Brought forward from the paper aircraft logbook at go-live',
       '10000000-0000-0000-0000-000000000003', now() - interval '44 days'
  from (values
    ('71000000-0000-0000-0000-000000000101'::uuid, '40000000-0000-0000-0000-000000000101'::uuid, 18742.6, 6131, 6134, 21550.4, 9012),
    ('71000000-0000-0000-0000-000000000102'::uuid, '40000000-0000-0000-0000-000000000102'::uuid, 15208.3, 5277, 5280, 17895.0, 7810),
    ('71000000-0000-0000-0000-000000000201'::uuid, '40000000-0000-0000-0000-000000000201'::uuid,  6481.9, 3012, 3015,  5120.7, 4466),
    ('71000000-0000-0000-0000-000000000202'::uuid, '40000000-0000-0000-0000-000000000202'::uuid,  5893.4, 2788, 2790,  4702.2, 4103),
    ('71000000-0000-0000-0000-000000000203'::uuid, '40000000-0000-0000-0000-000000000203'::uuid,  7210.0, 3390, 3392,  5655.9, 4920),
    ('71000000-0000-0000-0000-000000000204'::uuid, '40000000-0000-0000-0000-000000000204'::uuid,  4377.5, 2104, 2104,  3510.3, 3077)
  ) as b(id, aircraft_id, hours, cycles, landings, apu_hours, apu_cycles);

-- --------------------------------------------------------- recent flights ---
-- Days 44 to 1 ago. Not every tail flies every day (a fixed, invented
-- pattern); A330 sectors are longer than G550 sectors.
insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, from_place, to_place,
                                  hours, hours_basis, cycles, landings, apu_hours, apu_cycles, log_ref,
                                  entered_by, entered_at, device_time)
select f.id, f.id, 'flight', f.aircraft_id, f.flight_date, f.from_place, f.to_place,
       f.hours, 'flight', f.cycles, f.cycles, round(f.hours * 0.3 + 0.4, 1), f.cycles,
       '[SAMPLE] TLB ' || f.book || '/' || lpad(f.page::text, 3, '0'),
       f.entered_by, f.flight_date + time '20:30', f.flight_date + time '20:28'
  from (
    select gen_random_uuid() as id, a.id as aircraft_id, (current_date - d) as flight_date,
           case when d % 2 = 0 then 'XNAA' else 'XNBB' end as from_place,
           case when d % 2 = 0 then 'XNBB' else 'XNAA' end as to_place,
           case when a.aircraft_type_code = 'A330-200'
                then round((3.2 + ((d * 7 + a.n * 3) % 50) / 10.0)::numeric, 1)
                else round((1.1 + ((d * 5 + a.n * 7) % 30) / 10.0)::numeric, 1) end as hours,
           case when (d + a.n) % 5 = 0 then 2 else 1 end as cycles,
           a.n * 10 + 1 as book, 100 - d as page,
           case when a.aircraft_type_code = 'A330-200' then '10000000-0000-0000-0000-000000000003'::uuid
                else '10000000-0000-0000-0000-000000000007'::uuid end as entered_by
      from (select x.*, row_number() over (order by x.tail)::integer as n
              from public.aircraft x where x.tail in ('NX-101', 'NX-102', 'NX-201', 'NX-202', 'NX-203', 'NX-204')) a
      cross join generate_series(1, 44) as d
     where (d + a.n) % 4 <> 0                         -- some days on the ground
       and not (a.tail = 'NX-101' and d <= 6)         -- AOG this week: no flying
       and not (a.tail = 'NX-102' and d <= 10)        -- in check
  ) f;

-- ------------------------------------------------- one sample correction ---
-- PLA logged 3.1 h on NX-201 seven days ago; KDO corrected it to 3.4 h from
-- the tech log. The original stays as version 1.
insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, from_place, to_place,
                                  hours, hours_basis, cycles, landings, apu_hours, apu_cycles, log_ref,
                                  entered_by, entered_at, device_time)
values ('72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'flight',
        '40000000-0000-0000-0000-000000000201', current_date - 7, 'XNAA', 'XNCC', 3.1, 'flight', 1, 1, 1.2, 1,
        '[SAMPLE] TLB 31/094', '10000000-0000-0000-0000-000000000007',
        (current_date - 7) + time '22:10', (current_date - 7) + time '22:09');
insert into public.flight_record (id, record_id, version, supersedes, kind, aircraft_id, flight_date, from_place, to_place,
                                  hours, hours_basis, cycles, landings, apu_hours, apu_cycles, log_ref, reason,
                                  entered_by, entered_at, device_time)
values ('72000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 2,
        '72000000-0000-0000-0000-000000000001', 'flight',
        '40000000-0000-0000-0000-000000000201', current_date - 7, 'XNAA', 'XNCC', 3.4, 'flight', 1, 1, 1.2, 1,
        '[SAMPLE] TLB 31/094', '[SAMPLE] Tech log page reads 3.4 h; 3.1 was a typing slip',
        '10000000-0000-0000-0000-000000000005',
        (current_date - 6) + time '08:15', (current_date - 6) + time '08:14');
