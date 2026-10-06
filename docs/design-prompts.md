# Claude Design prompts

Paste each prompt into Claude Design as written. Each starts with the Design standing rules from `docs/PROMPTING.md` section 1.

**Do not upload screenshots of CAMP, AMOS or any other commercial MRO system to Claude Design.** They show another company's trade dress (D-113) and often real registrations, names and phone numbers (D-112). The prompts below describe the layout we want in our own words.

---

## Prompt 1: Complete wireframe and navigation map

Run this first. It fixes how every screen links before any more screens get polished.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Create a low-fidelity, clickable wireframe of every Nexus MRO v1 screen
and how each link connects, on a new page called "Wireframe" in the
"Nexus MRO" canvas.

CONTEXT: Nexus connects Engineering, Supply, Procurement and Operations, with
Command and Quality approving and auditing. Rules that shape navigation:
- Tail first: every record belongs to an aircraft (tail).
- Pilot report alone shows "Snag open"; only an engineer sets U/S, AOG or SVC,
  and every status shows who set it and when.
- Super Admins add and deactivate aircraft and enter the tail number.
  Aircraft are deactivated, never deleted.
- Certifying, approving, MEL deferral and granting privileges need online
  and PIN re-entry. Offline state is always visible.
- Next-due figures are entered by engineers, never calculated.
- Cost is visible only to Supply, Procurement and Command.
- Each department (Engineering, Operations, Supply, Procurement) sees its own
  fleet board and home view. Detail per department: docs/department-views.md.
  Super Admins set a user's department during or after account creation;
  users cannot change their own.

SCOPE: Grey boxes, real labels, no colour except status words. One artboard
per screen (desktop 1440 wide), arranged in rows by area, with arrows or
prototype links for every navigation path. Screens:

A. Global frame: top bar (logo, search, sync status, notifications bell,
   user + role), left rail (aircraft list with status word per tail, and an
   "All aircraft" entry), main area.
B. Home: "All aircraft" selected = Fleet overview; one tail selected =
   Aircraft dashboard (see Prompt 2).
C. Aircraft: Overview | Snags | MEL deferrals | Checks and packages |
   Components by position | Flight records (hours, cycles, landings) |
   Part requests | Documents | History.
D. Snags: list -> snag detail -> assess -> disposition (Rectify now /
   Defer under MEL / No fault found) -> certify (PIN) -> closed.
   "Report snag" form (pilot or engineer).
E. MEL: deferral list -> deferral detail (countdown, M/O/placard
   confirmations) -> extension request (separate approval).
F. Checks and packages: package list -> package detail ("X of Y tasks
   completed") -> task card -> raise non-routine card (enters snag flow).
G. Work orders: list -> detail.
H. Log flight hours form.
I. Parts and stock: stores search -> part detail (stock, certificate,
   shelf life) -> part request form (from a snag or task card) -> part
   request detail (state, holder, time held).
J. Supply: issue, receiving inspection, quarantine, U/S returns.
K. Procurement: requisitions -> requisition detail (approval chain steps)
   -> purchase order (cost, invoice).
L. Approvals inbox: requisitions, MEL extensions, authorizations,
   requirement changes. Each opens its record.
M. Notifications list. Every notification opens its record.
N. Audit trail: search by record, person or date.
O. People: person record -> licences, type ratings, medicals ->
   certifying authorizations (Quality issues, CO/ECO approves).
P. Administration (Super Admins only): aircraft register (add, deactivate,
   tail number), users and roles (create account form with a Department
   field; account page with "Change department" and its change log),
   approval chain set-up, MEL revision
   loading (Quality / Technical Records), operator settings.
Q. Sync queue: items waiting to sync and conflicts to review.
R. Mobile (390 wide) for B, D, I and Q only, with bottom bar:
   Fleet | Snags | Report | Parts | More.

Add a sticky note on each artboard listing: which departments can see it, and
what every button or link on it opens.

NOT: No visual styling beyond grey boxes. No flight scheduling, crew
rostering, forecasting, "projected" or "average daily use" figures,
analytics or finance screens. No copying of any commercial MRO system's
layout labels or look.
STOP IF: A link needs a screen not listed above, or a rule not listed
above. List it as an open question on a sticky note instead of inventing it.
DONE = Every screen above exists as an artboard; every button and link
leads somewhere; a final sticky note lists all open questions.
```

---

## Prompt 2: Home page as an aircraft dashboard

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Design the Nexus MRO home page as an aircraft dashboard, desktop and
mobile, on the "Nexus MRO" canvas. Keep the existing Fleet board artboards.

CONTEXT: Same rules as the Wireframe page. The home page has three zones:
1. Left rail: "All aircraft" at the top, then each tail (NX-101 to NX-204)
   with its type and status word. Selected tail expands to show its
   sections: Overview, Snags, MEL deferrals, Checks and packages,
   Components, Flight records, Part requests, Documents, History.
   "+" beside Snags (report snag) and Part requests (new request).
   Choosing "All aircraft" shows the existing Fleet board.
2. Main area for the selected tail (use NX-102, A330-200, in check),
   a 2 x 2 grid of panels, each with a title, an expand button and a
   "view all" link:
   - Aircraft info: tail (Plex Mono), type, serial (fictional), operator
     base, status chip with "Set by [Engineer] · time", photo placeholder.
   - Aircraft status: hours, cycles, landings as of the last flight record
     (entered by [name], date). Next due figures as ENTERED BY ENGINEERS,
     each labelled with who entered it. Nothing calculated or projected.
   - Open items: snags, MEL deferrals with countdown, part requests with
     holder and time held ("Blocked by" first).
   - Recent activity: last 5 signed entries, each with name and time,
     linking to the audit trail.
3. Bottom strip: 4-week calendar for the tail showing check package
   dates and MEL expiry dates, with previous / next buttons.

Department views: this layout is the Engineering view. Other departments
get the same frame with different panels (see Prompt 3).

SCOPE: Two new artboards: "Home · desktop" (1440 wide, page) and
"Home · mobile" (390 x 844). On mobile the left rail becomes a tail
picker at the top; panels stack; bottom bar Fleet | Snags | Report |
Parts | More.

NOT: No "Projected", "average daily use" or forecast rows. No analytics,
scheduling or finance. No colours beyond the Hangar-grade theme. Do not
imitate any commercial MRO system's look, icons or panel names.
STOP IF: A panel needs data the rules above don't allow (calculated due
dates, forecasts, cost for an engineer).
DONE = Both artboards; every link labelled with where it goes.
```

---

## Prompt 3: Fleet board by department, and department on the account

Run after Prompt 4. The "All aircraft" view on Home is the fleet board these variants replace.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Design the fleet board as each department sees it, plus the account
screens where a Super Admin sets a user's department.

CONTEXT: Same fleet (NX-101 to NX-204), same statuses and "Set by" lines as
the current Fleet board. Every department sees: tail, type, status word,
who set it and when, and the "Blocked by" headline with holding department
and time held. Detail differs:
- Engineering: the current Fleet board. Leave as is.
- Operations: availability, open MEL items with category, countdown,
  the (O) operational procedure and placard, engineer-entered return to
  service estimate, hours / cycles / landings, the user's own pilot
  reports. No part numbers, stock, procurement, cost or engineering notes.
  Actions: Report snag (pilots), Log flight hours.
- Supply: per tail, part requests (P/N, qty, priority, state, holder,
  time held), reserved awaiting issue, U/S returns due, shelf-life and
  certificate alerts. AOG requests first. No snag technical detail, no
  MEL detail. Actions: Issue part, Receive goods.
- Procurement: everything Supply sees plus requisitions with approval
  step, PO, supplier, ETA, overdue deliveries and cost. Actions: Raise PO,
  Update ETA.
Header shows the user's department, e.g. "Supply · Storekeeper".

SCOPE: New artboards:
1. "Fleet board · Operations" (desktop)
2. "Fleet board · Supply" (desktop)
3. "Fleet board · Procurement" (desktop)
4. "Create account" form (Super Admin): name, service number, appointment,
   Department (required dropdown), role, privileges, save.
5. "Account page" for an existing user: Department with a
   "Change department" button, which opens a dialog asking for a reason
   and PIN, and a change log below (who, from, to, why, when).
6. "Fleet board · Operations" mobile (390 x 844), dark, for pilots.
7. "Home · Supply" desktop: the Home aircraft dashboard for NX-102 as a
   storekeeper sees it (panels: Aircraft record, Part requests and
   reservations, U/S returns, Recent activity; no snag detail, no MEL,
   no ADs and SBs, no due items).

NOT: Users cannot change their own department, so no department picker in
the user's own settings. No cost on Operations or Engineering views. Don't
change the Engineering Fleet board.
STOP IF: A department needs information not listed above.
DONE = Six artboards; a sticky note on each view listing what is hidden
from that department.
```

---

## Prompt 4: Fix-up round after the first wireframe and home page

Status of the canvas on 6 Oct 2026: Prompt 1 done (60 wireframe screens, A to S plus OP, with link notes and 19 open questions). Prompt 2 done (Home desktop and mobile). Prompt 3 not yet run.

**Before pasting:** the answers in section 3 are Claude's recommendations. Items marked (CONFIRM) need Promise's decision. Change any you disagree with.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Revise the "Nexus MRO" canvas: fix the issues below, answer the open
questions on the Wireframe page using the answers given, and add the missing
screens. Do not start the department views yet.

CONTEXT: Read the "OPEN QUESTIONS" sticky on the Wireframe page and the
Home link notes before starting.

SCOPE:

1. FIXES TO EXISTING SCREENS
a. Home desktop and mobile: use the Hangar-grade theme (navy #0E1B2C,
   teal #0B6E69 for actions, light grey ground #EEF1F4). Replace the light
   blue page background #CFE6F5 and blue links #0369A1. Blue is reserved
   for the "information" status only.
b. Home "Due items": add an amber "Approaching" flag when the current total
   is within a configurable margin of the figure the engineer entered
   (set in Operator settings), and red "Reached" when it reaches it.
   Label: "Margin set in operator settings". Still no projections.
c. Home and every wireframe left rail: show only the work areas for the
   signed-in user's department, plus oversight items their role allows.
   Example for the Engineering duty engineer: Engineering work orders,
   Stores search, Approvals (only if they hold an approval step).
   Administration appears only for Super Admins. Add a sticky explaining
   the rule.
d. B2 "Aircraft dashboard (one tail)": replace the placeholder with the
   Home layout (it is the same screen). Remove open question 2.
e. OP1 Operations availability: NX-203 "Snag open" must not be counted as
   "Not available". Use four counts: Available, Available with MEL
   restrictions, Not available (AOG / U/S, in check), Snag open
   (awaiting engineer). Add a column "Hours · cycles · landings".
f. P2 Add aircraft: add fields: registration effective date; opening
   totals (hours, cycles, landings) with "as of" date and "entered by";
   engines and APU positions with serials and opening totals; MEL to
   assign (from loaded MEL revisions). Save requires PIN.
g. P1 Aircraft register: Deactivate opens a dialog with reason + PIN.
   Deactivated aircraft stay listed under a "Deactivated" filter with who
   and when. No delete button anywhere.
h. P3 Users and roles: keep the Department column. "Approve sign-up" opens
   a review screen where the Super Admin confirms the department the
   person requested before activating.

2. ANSWERS TO THE OPEN QUESTIONS (update the sticky; mark each answered)
 1. Left rail shows only the user's own department areas (fix 1c).
 2. Answered by fix 1d.
 3. Add a Search results screen (grouped: Aircraft, Snags, MEL, Parts,
    People), showing only what the user's department may see.
 4. Add a People list screen (Quality, department CO, Super Admins).
 5. Add "Record removal / installation" from C1 and from a task card:
    position, S/N off (with condition), S/N on (from an issued part),
    linked task card, engineer, PIN.
 6. "Correct entry" on a flight record opens a form that creates a new
    version with a reason; the original stays visible in History.
 7. Add "Upload document" (PDF and images only, linked to aircraft,
    snag, package or part) and a "Document viewer".
 8. Add "Create package": check type, due figure entered by engineer,
    work pack upload (PDF), task card list.
 9. Task card certification uses the same Certify (PIN) pattern as D5;
    for duplicate-inspection cards a second, different engineer signs.
10. (CONFIRM) Flight hours are logged by Pilots and Engineering; every
    entry carries the name; Engineering can correct with a new version.
11. (CONFIRM) Deactivating an aircraft needs reason + PIN; no second
    approval.
12. (CONFIRM) Changing an approval chain: Quality proposes, CO approves.
    MEL extension approver is set in the approval chain set-up.
13. Audit trail: full access for Quality, Command, Super Admins. Every
    user sees the History of records they are allowed to see.
14. Mobile More: the user's department areas, Approvals (if any),
    Notifications, Sync queue, My account, Sign out.
15. Keep: mobile assess and certify come later.
16. Rejecting any approval needs a reason; the record returns to the
    person who submitted it, shown as "Rejected" with the reason;
    resubmitting creates a new version.
17. (CONFIRM) ADs and SBs stay in v1 as engineer-entered records.
    Quality verifies each entry (countersign with PIN). The system does
    not decide applicability.
18. Expected return to service is entered by Engineering (duty or
    certifying engineer) with name and time; visible to all departments.
19. Keep: dedicated mobile Supply / Procurement / Operations screens
    come later.

3. NEW SCREENS (wireframe style, same frame, with link sticky notes)
   Search results · People list · Record removal / installation ·
   Correct flight record · Upload document · Document viewer ·
   Create package · Certify task card (with second signatory) ·
   Approve sign-up review · Deactivate aircraft dialog · Reject with
   reason dialog.

NOT: No new features beyond this list. No department views yet. No
projections, average daily use or calculated due dates. Don't copy any
commercial MRO system's look or labels. Fictional data only.
STOP IF: A fix or answer conflicts with something already on the canvas.
Put the conflict on the open-questions sticky instead of guessing.
DONE = Every fix applied; the open-questions sticky shows each item as
answered or still open; new screens linked both ways; list every
artboard changed or added.
```
