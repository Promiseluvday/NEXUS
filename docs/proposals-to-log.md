# Proposals to log (7 Oct 2026, updated 23:40)

**Status:** PROPOSALS. None of these is in `docs/DECISIONS.md` yet. Each was asked for by Promise or drawn on the design canvas this week. Promise or Claude Code logs the ones accepted, with D-numbers.

| # | Proposal | Affects |
|---|---|---|
| P8 | **Aircraft list in the left rail:** "All aircraft" is a link to the fleet overview; a small arrow beside it opens the list of tails (type and status word). Same on mobile and every department view. | Amends wording of D-096 ("the left rail lists All aircraft and each tail") |
| P10 | **Daily serviceability state print:** Engineering and Operations each print the fleet state from the statuses Engineering set, as at a chosen date and time. Engineering copy has full detail; Operations copy follows D-120 (no part numbers, snag technical detail or (M) procedures). | Extends D-097 |
| P11 | **Dates and times:** every date is chosen from a calendar; every time is entered as 24-hour HH:MM. Dates display as DD Mmm YYYY (07 Oct 2026) on every device. The build needs its own calendar control, because the browser's built-in picker follows the device language and can show 10/07/2026 (read as 10 July in UK format, 7 October in US format). | New; applies to every screen |
| P12 | **Flight requests, Outstanding missions, fleet roster, crew scheduling and flight order are built now** (Promise, 7 Oct 2026). Details in `workflows/scheduling.md` section 6. | Amends D-012, D-013, D-017; replaces P9 |
| P13 | **Sign-in and sign-out:** every top bar has a user menu (My record and qualifications, My access, Notifications, Sync queue, Sign out); mobile signs out from More. The designed sign-in page has: show/hide password, forgotten password (reset by the department Super Admin, D-033), first sign-in PIN (separate from the password), and request an account (Super Admin confirms, D-123). | Closes C6 on the canvas |
| P14 | **Technical queries:** a question thread tied to a record (part, certificate, work order, snag, order), assigned to a person or a department queue, with due date (calendar, 24-hour), notes, photos and PDFs. Notes are added, never edited. The assignee answers; the raiser closes. A query never changes the record. Reached from Queries in every rail, mobile More, notifications and "Raise query on this record". | New |
| P15 | **Similar and repeat defects:** from a snag or work order, find similar defects by tail, type, ATA and words. Flag a repeat at 3 reports on one tail in the same ATA sub-chapter within 30 days (setting). The flag alerts Engineering and Quality; it never grounds the aircraft. | Respects D-020 |
| P16 | **Cabin items on a cabin map:** cabin crew and pilots tap a zone on the aircraft type's layout to report. Engineering accepts as NADD, rejects with a reason the reporter sees, or raises as a snag (emergency equipment, exits, oxygen and lighting always go to the snag flow). Times show local with UTC beside them. | Extends the NADD flow (D-160s) |
| P17 | **Column chooser on every list:** tick and reorder columns, saved per user. Columns the user's access does not allow stay locked. | Respects D-121, D-125 |
| P18 | **Guided report builder:** record type → filters → columns → group and count → preview → save, print or download. Built on approved data views, never raw tables; each viewer sees only their own access; every run is logged. | Extends D-097 |
| P19 | **Colours: light blue, yellow, black and white** (Promise, 7 Oct 2026). Black header and text, white cards on a pale light-blue ground, light-blue buttons with black text, a deeper blue for links and focus outlines, yellow for the Liebetag mark and highlights. Status colours unchanged (D-091). Wireframes stay grey. Once logged, `docs/PROMPTING.md` (which still says navy and teal) needs the same change. | Amends D-090 |
| P20 | **Sign-in and account requests use a username or email; no service number** (Promise, 7 Oct 2026). Create account asks for a unique username, never reused. | New |

## Open questions raised with these

| # | Question | Drawn default |
|---|---|---|
| Q-SO1 | Signing out with items waiting to sync | Items stay on the device, send at next sign-in |
| Q-LG1 | Offline sign-in | Only on a device the user has signed in on before |
| Q-LG2 | Lock after wrong passwords | 5 attempts, Super Admin unlocks |
| Q-LG3 | Idle sign-out on shared terminals | 30 minutes (setting) |
| Q-PR1 | Signatures on the serviceability print | Prepared / Checked (Engineering); Prepared / Received (Operations) |
| Q-PR2 | Fixed daily time for the state | On demand, as at any chosen time |
| Q-PR3 | Header details and classification marking on the print | Unit name; marking if the operator sets one |
| Q-CR1 | Crew qualification expiring within the alert window | Allowed with a warning |
| Q-CR2 | Flight duty and rest limits | Only duty clashes flagged |
| Q-CR3 | Crew positions per aircraft type | G550: Captain, First officer, Cabin crew ×1 |
| Q-FO1 | Flight order issuer, signature, number format | Operations issues; FO-000031 |
| Q-TQ1 | Who closes a query | The person who raised it |
| Q-TQ2 | Does an open query hold anything (e.g. a part in quarantine) | No; the record's own process decides |
| Q-RD1 | Repeat-defect rule | 3 reports, same tail, same ATA sub-chapter, 30 days |
| Q-CI1 | Who provides each type's cabin layout | Operator setting (uploaded drawing) |
| Q-CI2 | Who may accept or reject cabin items | Anyone who may confirm NADDs |
| Q-CC1 | Column choices: per user only, or department defaults too | Per user |
| Q-RB1 | Can saved reports be shared with a department | Yes; each viewer sees only their own access |

## Connection check (7 Oct 2026)

All 144 design boards were checked by script: 0 broken links, 0 empty links, every screen reachable and with a way back. Thirty end-to-end processes were walked screen by screen across Engineering, Supply, Procurement, Operations, Quality, Command and administration; all connect. Records that appear on several screens (WO-000214, PR-0033, REQ-0014, SNAG-0142, NADD-0019, FR-0000xx) now show the same state everywhere.

---

## From Phase 1 testing (10 Oct 2026)

**Status (updated 11 Oct 2026):** both are now done. P21 was logged by Claude Code as **D-218** (10 Oct) and built (migration 0024); P22 was built as described. D-218 differs from the P21 wording in two places, and D-218 governs: deferral **on the DDLS** is also allowed without a work order, and a **NADD may still be rectified directly** with the PIN (it may be fixed at another MRO).

| # | Proposal | Affects |
|---|---|---|
| P21 | **DECIDED → D-218.** **Work order first.** When a snag or observation is reported, a work order is requested and approved (Quality pre-approves, then the CO, D-063) **before any work is recorded on it**. The only things allowed without a work order are **deferring under the MEL** and **deferring as a NADD**. **A fault is never cleared without an approved work order**, including the later clearance of a deferred MEL, DDLS or NADD item. Promise's words: "the only thing that can be allowed without a work order is deferring as an MEL or NADD item. A work order must have been raised before the fault can be cleared." | Amends **D-067** (which lets no-fault-found and DDLS go without a work order) and the D-040 lifecycle. Detail and drawn defaults: `workflows/work-order.md` section 8. Canvas: D2, D4, D5, DD3, NA3, R4, WO1 |
| P22 | **BUILT (10 Oct).** **Aircraft page layout.** Totals (hours, cycles, landings) and Engines and APU sit **inside the Aircraft record section**, not in separate sections. The "Calendar · next 4 weeks" is half its current size. Clicking **anywhere on a section's bar** shows or hides it; the Show / Hide button is not the only target. | UI only; refines D-096 and D-098. Canvas: Home, HomeMobile, B2. Build: `docs/phase1-feedback.md` CR-1 to CR-3 |

### Questions raised with P21

| # | Question | Drawn default (until answered) |
|---|---|---|
| Q-WO7 | **No fault found** now needs a work order for the checks (by P21's wording). Confirm? | **Answered by D-218:** yes; NFF is a tick when the work order is certified |
| Q-WO8 | **Deferring on the DDLS when not under the MEL** (e.g. damage within manual limits): does that need a work order? P21's wording allows only MEL and NADD without one | **Answered by D-218:** no, DDLS deferral is allowed without one; clearing the DDLS entry needs one |
| Q-WO9 | **AOG at night with the CO away**: D-067 says acting deputy only, no verbal path. Does P21 keep that? | Yes, unchanged |
| Q-WO10 | **Answered by D-218 (assess first, then request).** Can an engineer **assess** (inspect, read, comment, attach photos, raise a query) before the work order is approved? Assessment is what the work order request is based on | Yes: looking and recording findings is allowed; no rectification or clearance |
| Q-WO11 | **Answered by D-218: one active work order per snag.** One work order per snag, or can one work order cover **several snags on the same tail**? | One per snag; a check package keeps one for the package (D-067) |
