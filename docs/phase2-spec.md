# Nexus MRO: Phase 2 spec (Fleet and work)

**Status:** DRAFT, 10 Oct 2026. Written by the Documents assistant for Promise to review. Rules already decided are cited by their D-number. Anything not yet decided is marked **PROPOSAL (P-2.x)** or **QUESTION (Q-P2-x)**. Nothing in this file is a decision until it is logged in `docs/DECISIONS.md`.

**Who uses this file:** Promise answers section 9 and decides section 8. Claude Code then plans and builds Phase 2 from sections 3 to 7.

---

## 1. Scope

Phase 2 in `docs/ROADMAP.md` is "Fleet and work". It builds on Phase 1, which already has snags, MEL, DDLS, NADD, tail status (D-215, D-216), offline signing (D-217), queries, repeat defects and the core of work orders (D-214).

In Phase 2:

| # | Slice | Decisions it rests on |
|---|---|---|
| 1 | Flight records and aircraft totals (hours, cycles, landings) | D-022, D-027 |
| 2 | Components by position, removal and installation | D-011 |
| 3 | Due items, as entered by engineers | D-021, D-028 |
| 4 | Check packages, task cards and non-routine cards | D-060 to D-062, D-039, D-044, D-067 |
| 5 | CRS (Certificate of Release to Service) | D-066, D-069, D-214 |
| 6 | ADs and SBs | D-016 |
| 7 | Aircraft dashboard, history and department boards | D-096, D-098, D-120 to D-127 |
| 8 | Prints and exports for all of the above | D-097, D-203, D-211 |

**Exit test (from the ROADMAP):** an A-check package on a sample tail closes with its work order, Quality and CO approval, every task certified, its findings closed, and a compiled CRS.

**Not in Phase 2:** parts and stores (Phase 3 in the ROADMAP). See Q-P2-7: CLAUDE.md groups them differently.

---

## 2. Sample data for tests

Fictional only. Use the Phase 1 sample tails and users from `docs/local-test-script.md`.

- Tails: NX-101, NX-102, NX-203 (sample type as already seeded).
- Users: kdo (engineer, certifying), tmb (engineer), pla (pilot), qar (Quality), abe (CO), zem (Operations).
- Package: "A-check" on NX-101, work order WO-000231, CRS reference CRS-000001.

---

## 3. Data: new records

All new tables follow the Phase 1 pattern: append-only (D-023), named user plus device time and server time (D-024), standard rules applied, row-level security by aircraft scope (D-121, D-125). Corrections are new versions with a reason.

| Record | Main fields | Notes |
|---|---|---|
| `flight_record` | aircraft, date, take-off and landing times (24-hour), flight time, cycles, landings, entered by, version, supersedes, correction reason | Entered by pilots and Engineering (D-027). A correction is a new version by Engineering. |
| `aircraft_totals` (view) | aircraft, total hours, total cycles, total landings, as at | Sum of current flight-record versions plus the opening figures (P-2.1). Arithmetic only (D-022). |
| `position` | aircraft type, code, name, ATA | Positions per type, e.g. "ENG 1", "MLG LH". Loaded by Technical Records. |
| `component` | part number, serial number, description, opening hours / cycles (P-2.2) | One row per physical item. |
| `installation` | component, aircraft, position, installed at, installed by, removed at, removed by, removal reason, work order | A removal closes the open installation; never edited. |
| `due_item` | aircraft or component, title, reference, due figure (date, hours, cycles or landings), entered by | Figure entered by an engineer (D-021); status "Approaching" / "Reached" from the operator margin (D-028). |
| `check_package` | aircraft, check type, due figure, work pack PDF, work order, status | One work order per package (D-067). |
| `task_card` | package, number, title, assigned engineer, duplicate-inspection flag, status | Status: not started, in progress, done, certified (D-061). |
| `task_signature` | task card, kind (done / certify / second inspection), signer, PIN check, offline flag | Second inspector ≠ person who did the work (D-039). |
| `non_routine_card` | package, raised from task card, finding, linked snag | Enters the snag workflow (D-044). |
| `crs` | reference, package or work order, compiled at, compiled content snapshot, signed by, PDF | Fleet-wide sequence, never reused (D-069). |
| `ad_sb_record` | aircraft or component, kind (AD / SB), reference, applicability, compliance method, status, next-due figure, entered by, verified by (Quality) | Quality countersigns with PIN (D-016). |
| `print_log` | what, filters, date range, printed by, at, record version | Every print and download logged (D-049, D-211). |

Numbering: reuse `app.number_series` from Phase 1 for CRS and package numbers.

---

## 4. Slices, screens and done-when tests

Canvas screen IDs refer to the "Nexus MRO" design canvas.

### Slice 1: Flight records and totals
- **Screens:** WF-H1 Log flight hours, WF-C2 Flight records, WF-FR1 Correct flight record, WF-FV1 Flight record versions.
- **Who:** pilots and Engineering enter; Engineering corrects; everyone with access to the tail views.
- **Offline:** recording hours works offline (D-103) and syncs.
- **Done when:**
  - pla logs a flight on NX-101 and the totals rise by exactly the entered figures;
  - kdo corrects it with a reason; the original stays in versions and the totals use only the new version;
  - a flight logged offline appears after sync with both device and server time.

### Slice 2: Components by position
- **Screens:** WF-C1 Components by position, WF-CR1 Record removal / installation, WF-C5 Aircraft history.
- **Who:** engineers record; Quality and Command read.
- **Done when:**
  - removing a component from NX-101 "ENG 1" and installing another is recorded against a work order;
  - one position never shows two installed components at once;
  - the component's history lists every aircraft and position it was fitted to.

### Slice 3: Due items
- **Screens:** due list on WF-B2 Aircraft dashboard; tiles open the filtered list (D-098).
- **Done when:**
  - an engineer enters a due figure; it turns amber inside the operator margin and red at the figure;
  - the system never calculates a next-due figure itself (D-021).

### Slice 4: Check packages and task cards
- **Screens:** WF-F1 Package list, WF-F5 Create package, WF-F2 Package detail, WF-AC1 A-check package detail, WF-F3 Task card, WF-F6 Certify task card, WF-F4 Raise non-routine card.
- **Who:** engineers create packages and work tasks; certifying engineers certify; Quality and CO approve the package work order (D-063).
- **Rules:**
  - progress shows "X of Y tasks completed" (D-062);
  - an A-check package lists every open NADD on the tail, flagged "rectify before A-check", but they never block closing (D-165, D-166);
  - a package cannot close while a non-routine card is open (D-044);
  - opening a package can set the tail to "In check", signed with the PIN (D-215).
- **Offline:** updating tasks works offline (D-103); certifying may be signed offline on an enrolled device and is marked as such (D-217).
- **Done when:**
  - kdo creates an A-check on NX-101 with 3 task cards, one flagged for duplicate inspection;
  - tmb completes the flagged task and the system refuses tmb as second inspector;
  - a finding raised as a non-routine card blocks closing until its snag is closed.

### Slice 5: CRS
- **Screens:** WF-CRS1 CRS preview, WF-CRS2 Sign CRS.
- **Rules:** when every task is certified and every finding closed, Nexus compiles the CRS with the next fleet-wide reference (D-066, D-069). It is printable and downloadable.
- **Done when:**
  - the CRS button stays disabled while any task is uncertified;
  - CRS-000001 is compiled, signed with the PIN, and the number is never reused, even if the CRS is withdrawn (P-2.6).

### Slice 6: ADs and SBs
- **Screens:** WF-S1 ADs and SBs.
- **Done when:**
  - an engineer enters an AD for NX-101 with a next-due figure;
  - it shows "Awaiting Quality verification" until qar countersigns with the PIN (D-016).

### Slice 7: Dashboard, history and department boards
- **Screens:** WF-B1 Fleet overview, WF-B2 Aircraft dashboard, WF-C5 Aircraft history, the department views.
- **Done when:** totals, due items, open packages and installed components appear on WF-B2, and every tile opens its list (D-098).

### Slice 8: Prints and exports
- **Screens:** WF-RP1 Reports, WF-RB1 Build a report, WF-CC1 Choose columns.
- **Covers:** flight records, removal and installation history, task history, package and CRS, AD/SB register, by date range (D-097).
- **Done when:** each print carries who printed it, when, the record version and "uncontrolled when printed" (D-049), and appears in the print log.

---

## 5. Suggested build order

1. Flight records and totals (nothing depends on later slices).
2. Positions, components, installations.
3. Due items.
4. Check packages, task cards, non-routine cards (uses the Phase 1 work order).
5. CRS.
6. ADs and SBs.
7. Dashboard and boards.
8. Prints and exports.

---

## 6. Security checks to add to the test suite

- Row-level security blocks reading flight records, components and packages for tails outside the user's scope (D-125).
- No update or delete on any new table; corrections are versions (D-023).
- Duplicate inspection: the server, not just the screen, refuses the same person (D-039).
- CRS numbers: no gaps caused by retries and no reuse (D-069).
- Quality cannot see cost on anything Phase 2 adds (D-127).

---

## 7. Offline summary

| Action | Offline? |
|---|---|
| Log a flight, update a task, attach photos | Yes (D-103) |
| Certify a task card | Yes on an enrolled device, marked "Signed offline" (D-217) |
| Approve a package work order, compile or sign the CRS, verify an AD/SB | Online only (D-104), unless decided otherwise (Q-P2-9) |

---

## 8. Proposals (not decisions)

| ID | Proposal |
|---|---|
| **P-2.1** | **Opening figures.** When an aircraft is added, Technical Records enters its total hours, cycles and landings as at a date, verified by Quality. Totals = opening figures + flight records after that date. |
| **P-2.2** | **Component hours and cycles** = opening figures entered for the component + sum of the aircraft's flight records while it was installed. Arithmetic only, as D-022. Life limits stay engineer-entered due items (D-021). |
| **P-2.3** | **Engine and APU** use the same component model (an engine is a component at position "ENG 1"). APU hours are entered separately only if Q-P2-1 says so. |
| **P-2.4** | **Task cards** can be typed one by one or imported from a spreadsheet; the uploaded work pack PDF remains the controlled reference. |
| **P-2.5** | **CRS template** is an operator setting (D-025), like the NADDS print (D-049): fixed fields, operator wording, signature block. |
| **P-2.6** | **A CRS is never edited.** If it was wrong, it is withdrawn with a reason (Quality) and a new CRS gets the next number; the withdrawn one stays visible. |
| **P-2.7** | **Opening a check package sets the tail to "In check"** through the same PIN-signed status step (D-215), with the box pre-ticked. Closing the package does not set the tail back; the certifying engineer sets the status. |
| **P-2.8** | **Flight records come from the tech log page.** Each flight record carries the tech log page reference, linking it to the snags reported on that page (D-164). |

---

## 9. Questions for Promise

| ID | Question |
|---|---|
| **Q-P2-1** | Does PAF track hours per engine and APU separately, or only airframe hours? |
| **Q-P2-2** | Is a flight record entered per sortie (each take-off and landing) or as a daily total per tail? |
| **Q-P2-3** | Do landings and cycles differ on your types (e.g. touch-and-go counts as a landing but not a cycle)? |
| **Q-P2-4** | Which fields must appear on a PAF CRS? Please share a blank copy (fictional data is fine) so P-2.5 can follow it. |
| **Q-P2-5** | Who signs the CRS: the certifying engineer only, or also Quality or the CO? |
| **Q-P2-6** | Who enters ADs and SBs: engineers on the tail, or Technical Records centrally? (D-016 says an engineer enters and Quality verifies.) |
| **Q-P2-7** | ROADMAP puts parts and stores in Phase 3, but CLAUDE.md groups them with Phase 2. Which is right? (I cannot edit CLAUDE.md; Claude Code or you would update whichever is wrong.) |
| **Q-P2-8** | Which check types does PAF use (A-check, B-check, phase inspections, others), and does each need its own task-card template? |
| **Q-P2-9** | Should compiling or signing the CRS be allowed offline on an enrolled device, like certifying under D-217, or stay online only? |

When answered, log each as a D-number in `docs/DECISIONS.md` and mark it here.
