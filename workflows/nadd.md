# Non-Airworthiness Deferred Defects (NADD) workflow

**Status:** Core rules logged as **D-048, D-049** (7 Oct). All section 8 questions answered with the recommendations on 8 Oct and logged as **D-160 to D-165**. O-13 answered (D-166): open NADDs never block an A-check, only flagged there and in the pending / overdue list; 4 months = 120 days (30-day months).
**Builds on:** D-020, D-021, D-023, D-025, D-040 to D-047, D-050 to D-057 (MEL pattern), D-091, D-104

---

## 1. Summary

A **NADD** is a defect that does **not affect airworthiness** (e.g. a cabin reading light, a torn seat cover, a sticking galley drawer) and is deferred outside the MEL.

- **Engineers and pilots can log a NADD.**
- Each NADD gets a **countdown**: **120 days by default**, or the limit the operator defines (D-025).
- NADDs are listed per aircraft, sorted by time remaining.
- NADDs can be **printed**. Nexus produces a print that emulates the operator's **Non-Airworthiness Deferred Defects Sheet (NADDS)**.

**How it fits the snag workflow:** a NADD is a fourth way of dispositioning a snag, alongside Rectify now, Defer under MEL and No fault found (D-040). It does not change the aircraft's serviceability status.

---

## 2. The safeguard: who decides a defect is "non-airworthiness"

Calling a defect *non-airworthiness* is itself an airworthiness judgment. Under D-020 and D-042, that judgment belongs to a licensed engineer, not to the pilot or the system.

**Proposed (Q-N1):**

| Who logs it | What happens |
|---|---|
| **Pilot** | Logs the defect and ticks "Proposed as NADD". It appears as **"NADD proposed · awaiting engineer"**. An engineer confirms or reclassifies it (rectify now, MEL, or no fault found) |
| **Engineer** | Logs and classifies in one step |

**Confirming a NADD needs:** a certifying engineer (D-043), online, PIN re-entry (D-104), and a confirmation that the item is **not covered by the MEL** and **does not affect airworthiness**, with a reference to the operator's NADD procedure.

**Why it matters:** without this step, a NADD becomes a way to sidestep the MEL. Items that should have a 3-day Cat B limit could sit for 120 days with nobody accountable.

---

## 3. States

| # | State | Holder | Leaves when | Offline? |
|---|---|---|---|---|
| N-1 | **Proposed** (pilot-logged) | Engineering | Engineer confirms as NADD, or reclassifies | Logging: yes |
| N-2 | **Open – countdown running** | Engineering | Rectified, extended, reclassified or expired | Confirming: online only |
| N-3 | **Extension requested** | Approver (configured, D-078) | Approved (new limit) or rejected (D-079) | Online only |
| N-4 | **Expired** | Engineering | Rectified or extended. Alerts escalate (same pattern as D-057) | — |
| N-5 | **Rectified – closed** | — | End. Certifying engineer signs (D-043) | Online only |
| N-6 | **Reclassified** | — | Moves to MEL deferral or Rectify now; the NADD record stays in history | Online only |

**Countdown:**
- Starts on the **date the defect was reported**, not on the date it was confirmed (recommended, Q-N2), so a slow confirmation never extends the window.
- The default limit is a configured setting: 120 days for PAF. An engineer may set a **shorter** limit; a **longer** one needs an extension approval with a reason (same pattern as D-056).
- Display: days remaining. Amber "Approaching" inside the operator margin (D-028), red "Expired" at the limit.
- **Expiry:** the item turns red and alerts go to Engineering and Quality. The system does not ground the aircraft (D-057 pattern); NADDs are non-airworthiness by definition.

---

## 4. What gets recorded

| Field | Notes |
|---|---|
| NADD number | Running number per aircraft or per operator (configurable format) |
| Tail | Required |
| Date and time reported, reported by | Server time authoritative (D-024) |
| Location / zone / item | e.g. "Cabin, seat 12C, reading light" |
| Description | Free text, photos (PDF and images only, D-026) |
| ATA chapter | Optional, engineer-entered |
| Limit | Default from settings; shorter if the engineer chooses |
| Expiry date | Report date + limit (calendar arithmetic on a human-set limit, like D-054) |
| Confirmed by, licence / authorization ref, date | Certifying engineer, PIN |
| Parts required | Optional link to a part request (`workflows/part-request.md`) |
| Extensions | Each with approver, authority reference, new limit, reason |
| Rectification | Action taken, certifying engineer, date, PIN |

---

## 5. Who sees NADDs

| Department | Sees |
|---|---|
| Engineering | Everything |
| Operations / pilots | The NADD list per tail, with description, location and expiry, so crews know what's inoperative in the cabin before a flight. No engineering notes |
| Supply / Procurement | Only part requests linked to a NADD |
| Command | Everything, read-only (D-122) |
| Quality | Everything, read-only, plus a **NADD review report** (D-127 limits Quality's Supply and Procurement access, not this) |

**On the fleet board:** NADDs do **not** change the tail status. The card shows a count, e.g. "NADD 3 · next expires in 12 days". Amber only when one is approaching expiry, red when one has expired.

---

## 6. The NADDS print

- Nexus prints a **NADDS** for a tail: all open NADDs, or one selected NADD.
- The print **layout is a configurable template** (D-025). PAF's NADDS is the first template. Other operators get their own.
- **PAF layout (D-161):** header *Aircraft Reg* and *Sheet No.*; title "Non-Airworthiness Deferred Defects"; columns **S/N · Date · Log Ref No or WO Ref · Name (3LC) · Defect / Discrepancy · Action Taken · Date · Name (3LC) · Log Ref No**; 8 rows per sheet; remarks lines at the foot (PAF: "convenience items only"; "rectify before A-check but not later than 4 months after entry"). The first Date / Name / Log Ref belong to the entry; the second set to the rectification.
- **3LC:** each person's three-letter code (D-162) prints in the Name columns.
- **A-check:** open NADDs are listed and flagged in any A-check package opened on the tail (D-165).
- **Every print carries:** "Printed from Nexus MRO · [date/time] · by [name] · record version [n] · uncontrolled when printed".
- **The electronic record is the master** (D-023, D-114). If the paper sheet is signed by hand, the signature must also be entered in Nexus, or the paper becomes a second, conflicting record (Q-N4).
- **Fictional data only during development** (D-112). The template is built from a **field list Promise describes**, not from a scanned real sheet. A blank form layout from PAF must not be committed to Git.

---

## 7. Risks

| # | Risk | How it fails | Mitigation |
|---|---|---|---|
| RN-1 | NADD used to dodge the MEL | An MEL item is logged as NADD to get 120 days instead of 3 | Certifying engineer confirms with "not covered by MEL" declaration; Quality review report of all NADDs; reclassification keeps the history |
| RN-2 | Pilot classification | Pilot's NADD treated as final | Pilot only proposes; engineer confirms (Q-N1) |
| RN-3 | NADD pile-up | 40 open NADDs on one tail; cabin degrades; VIP fleet image suffers | Optional configurable cap per tail with an alert to Quality and Command; NADD age report |
| RN-4 | Paper and system disagree | Printed sheet signed by hand, Nexus not updated | Electronic record is master; print marked uncontrolled; Q-N4 |
| RN-5 | Rolling extensions | Same NADD extended repeatedly | Each extension is a separate approval with reason; extension count visible; Quality report |

---

## 8. Questions for Promise (open item O-10)

| # | Question | Recommendation |
|---|---|---|
| **Q-N1** | Pilots log NADDs as **proposals** that an engineer confirms? | **Yes.** Keeps D-020 and D-042 intact |
| **Q-N2** | Does the countdown start on the report date or the confirmation date? | **Report date** |
| **Q-N3** | Who approves a NADD extension? | Set in approval chain set-up (D-078); suggest Quality |
| **Q-N4** | Is the signed paper NADDS ever the legal record, or is it always a copy? | Always a copy; the electronic record is master |
| **Q-N5** | What fields and layout does PAF's NADDS have? Describe them in words (column names, header, signature boxes). Don't send a real filled sheet | Needed to build the print template |
| **Q-N6** | Is there a maximum number of NADDs per aircraft in the PAF procedure? | Configurable cap, off by default |
| **Q-N7** | Is the 120 days the same for every NADD, or does it vary by category (e.g. cabin vs cargo)? | One default, configurable per category later |
