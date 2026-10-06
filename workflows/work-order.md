# Work order, completion evidence and CRS workflow

**Status:** Rules agreed by Promise on 7 Oct 2026 and logged as **D-063 to D-066**. Questions in section 7 are open (O-11).
**Builds on:** D-020, D-023, D-026, D-036, D-040, D-043, D-044, D-060 to D-062, D-076, D-079, D-104, D-114

---

## 1. Summary

1. A snag is logged. An engineer assesses it (D-040).
2. If work is needed, the engineer raises a **work order request**.
3. **Quality pre-approves**, then the **Commanding Officer (CO) gives final approval**.
4. Only then does the work order open. **No updates, task entries or sign-offs** can be added before approval.
5. When the job is done, the engineer attaches **scanned copies** of the signed sign-off card and/or the technical log page, and the aircraft or engine logbook entry.
6. The **work order number** is generated automatically and runs **sequentially across the whole fleet** (one sequence for all aircraft).
7. When a **work package** is complete, Nexus **compiles the Certificate of Release to Service (CRS)** with an automatic reference number. It can be printed or downloaded.

---

## 2. Work order states

| # | State | Holder | Leaves when |
|---|---|---|---|
| WO-1 | **Requested** | Quality | Quality pre-approves or rejects (reason required, D-079) |
| WO-2 | **Pre-approved – awaiting CO** | CO (or acting deputy, D-036) | CO approves or rejects |
| WO-3 | **Open** | Engineering | Work starts; tasks, part requests and updates are now allowed |
| WO-4 | **Work complete – evidence required** | Engineering | Scanned sign-off card / tech log / logbook pages attached |
| WO-5 | **Certified – closed** | — | Certifying engineer signs (D-043), PIN, online (D-104) |
| WO-6 | **Rejected** | Requester | Revised (new version) or cancelled |
| WO-7 | **Cancelled** | — | End. Soft cancel with who, when, why (D-023) |

The holder at each state feeds "Blocked by" (D-006). A tail waiting on CO approval shows **"Blocked by: work order awaiting CO · 3h"**.

---

## 3. Work order number

- **Assigned by the server** when the request is submitted. One sequence for the whole fleet, e.g. `WO-000214`, `WO-000215`.
- Format (prefix, digits, yearly reset or not) is a setting (D-025). Default: continuous, no reset.
- **Numbers are never reused.** A rejected or cancelled work order keeps its number, so every gap in the sequence is explained by a record.
- Because approval needs to be online anyway (D-104), there is no offline numbering problem. A request drafted offline shows "Number on submission".

---

## 4. Completion evidence

- Required before a work order can be certified closed: at least one scanned document of the types the operator requires (configurable): **sign-off card**, **technical log page**, **aircraft logbook entry**, **engine logbook entry**.
- PDF or images only (D-026). Each scan records who uploaded it and when, and cannot be replaced, only superseded by a new version (D-023).
- **Paper vs electronic:** the scans are evidence attached to the electronic record. The electronic record stays the master (D-114).

---

## 5. CRS (Certificate of Release to Service)

**What Nexus does:** when every task card in a work package is certified and every finding is closed (D-044), Nexus **compiles** the CRS: aircraft, work package, work orders, tasks, references, deferred items carried forward (MEL and NADD), and certifying staff details. It assigns a **sequential CRS reference number** and produces a printable and downloadable PDF.

**What Nexus does not do:** issue the CRS by itself. A CRS is a certification by authorized certifying staff (D-020, D-043). The compiled CRS is **"Draft – not valid until signed"** until a certifying engineer with a valid authorization for that type signs it (online, PIN). Only then does it get the reference number and print as valid.

**Why:** a CRS printed by the software without a named, authorized signature would not be acceptable to NCAA, and it would make Nexus the one making the airworthiness release.

**Template:** CRS layout and wording are a configurable template, so each operator matches its approved MOE/CAME and the NCAA format. Fictional sample only during development (D-112).

---

## 6. Risks

| # | Risk | How it fails | Mitigation |
|---|---|---|---|
| RW-1 | **Two approvals on every job slow AOG recovery** | CO is away at night or at weekends; an AOG aircraft waits | Acting deputy with time-limited authority (D-036); escalation alert when a WO waits longer than a set time; possible AOG path (Q-W1) |
| RW-2 | Work done before approval, entered later | Engineers fix the aircraft first and back-fill the WO | Server time on every entry (D-024) shows the order; Quality report of work entered after approval within minutes of completion |
| RW-3 | Evidence scan unreadable or wrong page | Upload passes the check but is the wrong document | Certifying engineer confirms "scans checked" when closing; Quality sampling |
| RW-4 | CRS printed before signature | Draft taken to the aircraft as if valid | Draft watermark; no reference number until signed |
| RW-5 | Approval used as a rubber stamp | Quality and CO approve dozens without reading | Approval screen shows assessment, parts and estimated man-hours; approval-time report |

---

## 7. Questions for Promise (open item O-11)

| # | Question | Recommendation |
|---|---|---|
| Q-W1 | **Is there an AOG or emergency path** when the CO is unavailable (acting deputy only, or verbal approval recorded afterwards)? | Acting deputy (D-036) only; no verbal path. Keeps the record clean |
| Q-W2 | Do **MEL deferrals, NADDs and no-fault-found** also need a work order with both approvals, or only "Rectify now"? | Only "Rectify now" and check packages. MEL and NADD already have their own controls |
| Q-W3 | Can an engineer **reserve parts** before the work order is approved, so an AOG part isn't lost? | Yes: reserve only; issue after approval |
| Q-W4 | Does a **scheduled check package** need one work order with both approvals, or one per task? | One work order for the package; non-routine findings get their own |
| Q-W5 | Which evidence scans are mandatory: all four types, or any one? | Configurable; PAF to set |
| Q-W6 | Does the CRS reference run in one fleet-wide sequence, like work orders? | Yes, fleet-wide, never reused |
