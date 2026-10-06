# Engineering workshops: Tire Bay, Battery Workshop, AGE

**Status:** Core rules agreed by Promise on 8 Oct 2026 and logged as **D-019** (sections created by D-018). Questions in section 5 are open (O-15). AGE details still to come.
**Builds on:** D-018, D-022, D-032, D-063 to D-069, D-121, D-141 to D-153

---

## 1. Summary

Each workshop works in two ways:

1. **Its own internal jobs.** The workshop raises its **own work orders**, with the same **Quality pre-approval and CO final approval** as aircraft work orders (D-063). Examples:
   - Battery Workshop: battery capacity test
   - Tire Bay: tire request (from stores), wheel request (from stores), tire and wheel build-up
2. **Requests from the fleet.** A fleet engineer raises a work order on an aircraft, e.g. "tire change, NX-102, No. 3 main wheel". **Once that work order is approved**, the workshop receives a request to **issue a tire assembly** (or a battery). The workshop issues a serviceable unit by serial number to the line.

```
Fleet WO (NX-102 tire change) ── Quality ✓ ── CO ✓ ──► request to Tire Bay
                                                         │
Tire Bay internal WO (build-up) ── Quality ✓ ── CO ✓ ──► serviceable assembly
                                                         │
                                          Tire Bay issues assembly S/N to the line
                                                         │
                                   Removed assembly returns to Tire Bay (U/S)
```

---

## 2. Tire Bay

| Record | Notes |
|---|---|
| Wheel register | Wheel serials, part numbers, condition |
| Tire register | Tire serials, part numbers, new or retread, retread count, condition |
| Assembly | Built-up tire-and-wheel assembly with its own reference; which tire S/N on which wheel S/N, build date, built by, inflation pressure recorded |
| Fitted to | Tail and position (e.g. NX-102, No. 3 main). Landings per assembly come from the flight records while it is fitted (sum of human-entered records, D-022) |
| Internal jobs | Tire request and wheel request from stores, build-up, strip-down after removal, inspection |
| Fleet requests | Issue tire assembly against an approved aircraft WO |

## 3. Battery Workshop

| Record | Notes |
|---|---|
| Battery register | Battery serials, part numbers, type |
| Capacity tests | Date, result, done by; next test date **entered by staff**, never calculated (D-021) |
| Charging and servicing | Charge records, deep cycle, cell checks |
| Fitted to | Tail and position |
| Internal jobs | Capacity test, servicing |
| Fleet requests | Issue battery against an approved aircraft WO |

## 4. AGE (to be defined)

Expected: equipment register (GPU, tugs, jacks, test sets), serviceability, servicing and calibration dates entered by staff, defects, internal work orders. Waiting for Promise's description.

---

## 5. Questions for Promise (open item O-15)

| # | Question | Recommendation |
|---|---|---|
| Q-WS1 | **Do built-up assemblies and serviceable batteries count as stock** in a workshop location (alongside Main and Forward), or only in the workshop's own register? | Treat the Tire Bay and Battery Workshop serviceable racks as **stock locations** (D-141 list), so every assembly and battery has one traceable location and the reports (D-097) cover them |
| Q-WS2 | **Routine jobs:** a capacity test on every battery, each needing Quality and CO approval, could flood the CO's inbox. Should routine workshop jobs be raised as one **periodic work order** (e.g. "April battery capacity tests") approved once? | Yes: allow periodic work orders for routine workshop tasks; each individual test is still recorded and signed |
| Q-WS3 | **Who signs off** a tire build-up or a battery capacity test? | Workshop staff holding a workshop authorization issued by Quality (same pattern as D-032), scoped to that workshop |
| Q-WS4 | **What happens to removed units:** does the Tire Bay strip and inspect every removed assembly, and do worn tires go to a retread vendor through Procurement (outside-MRO job, D-144)? | Yes, both, recorded as Tire Bay internal jobs and an outside-MRO job |
| Q-WS5 | **AGE:** what does it record, and does it raise work orders the same way? | Promise to describe |
