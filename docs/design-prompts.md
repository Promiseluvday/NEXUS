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
- Command: everything, read-only, including cost.
- Quality: Engineering and Operations records read-only; no cost; Supply
  and Procurement only as granted by a Super Admin.
- Inside a department, each user sees only what their permissions and
  aircraft scope allow (e.g. a storekeeper without "View cost" sees no
  price).
- Procurement: everything Supply sees plus requisitions with approval
  step, PO, supplier, ETA, overdue deliveries and cost. Actions: Raise PO,
  Update ETA.
Header shows the user's department, e.g. "Supply · Storekeeper".

SCOPE: New artboards:
1. "Fleet board · Operations" (desktop)
2. "Fleet board · Supply" (desktop)
3. "Fleet board · Procurement" (desktop)
4. "Create account" form (Super Admin): name, service number, appointment,
   home Department (required), extra departments (optional), role,
   permissions within each department (checkboxes, e.g. "View cost",
   "Issue parts", "Approve"), aircraft scope (all, by type, or pick tails),
   privileges, save with PIN.
5. "Account page" for an existing user: departments, permissions and
   aircraft scope, each with a "Change" button that asks for a reason and
   PIN, and a change log below (who, what, from, to, why, when).
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

All answers below were confirmed by Promise on 6 Oct 2026 and logged in `docs/DECISIONS.md`.

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
10. Flight hours are logged by Pilots and Engineering; every
    entry carries the name; Engineering can correct with a new version.
11. Deactivating an aircraft needs reason + PIN; no second
    approval.
12. Changing an approval chain: Quality proposes, CO approves.
    MEL extension approver is set in the approval chain set-up.
13. Audit trail: full access for Quality, Command, Super Admins. Every
    user sees the History of records they are allowed to see.
14. Mobile More: the user's department areas, Approvals (if any),
    Notifications, Sync queue, My account, Sign out.
15. Keep: mobile assess and certify come later.
16. Rejecting any approval needs a reason; the record returns to the
    person who submitted it, shown as "Rejected" with the reason;
    resubmitting creates a new version.
17. ADs and SBs stay in v1 as engineer-entered records.
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

---

## Prompt 5: Deferred defects: DDLS and NADDS

Rewritten 8 Oct 2026 with the operator's sheet layouts (D-160 to D-165). Run after Prompts 6 and 7.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Add the deferred-defect screens to the "Nexus MRO" canvas: the
Deferred Defects Log Sheet (DDLS) and the Non-Airworthiness Deferred
Defects (NADD) list, with their printable sheets.

CONTEXT: Read workflows/ddls.md and workflows/nadd.md.
- Every MEL deferral appears on the tail's DDLS automatically. Engineers
  can also put other airworthiness-related deferred defects on the DDLS.
- NADDs are convenience items only, on a separate NADDS. A pilot can
  propose a NADD; a certifying engineer confirms it (online, PIN,
  "not covered by MEL, no airworthiness effect").
- Countdown: DDLS uses days allowed (from MEL category or entered with a
  manual reference); NADD uses the operator default (120 days) from the
  report date. Amber approaching, red expired. Neither changes tail status.
- Every person has a 3LC (three-letter code), printed in Name columns.
- Paper technical log continues: snags, deferrals and clearances record
  TLB book, page and item numbers.

SCOPE:
1. Snag Disposition (D4): options become Rectify now (work order) ·
   Defer under MEL (→ DDLS automatically) · Defer on DDLS (not MEL) ·
   Defer as NADD · No fault found. Add TLB Book / Page / Item fields to
   Report snag and to every disposition.
2. DDLS screen per tail: page number; entries with TLB refs, MEL cat and
   ref, days allowed, defect text, M / O flags, defer date, due date,
   who; extension (only for categories the operator allows: B, C, D;
   no extension button for Cat A); clearing (actions, date, TLB ref,
   who, PIN). "Page closed" when all entries are cleared, with a notice
   to CAMO.
3. Defer on DDLS (not MEL) form: days allowed + manual reference
   required.
4. NADD list per tail sorted by days remaining; Log NADD form (engineer:
   log and confirm; pilot: "Propose as NADD"); NADD detail (confirmation,
   extension, rectify with PIN, reclassify to DDLS or Rectify now).
5. Print previews (A4 landscape), our own clean layout in the
   Hangar-grade theme, operator crest as an uploaded placeholder box:
   a. NADDS: header Aircraft Reg, Sheet No.; title "Non-Airworthiness
      Deferred Defects"; columns S/N · Date · Log Ref No or WO Ref ·
      Name (3LC) · Defect / Discrepancy · Action Taken · Date ·
      Name (3LC) · Log Ref No; 8 rows; remarks lines at the foot.
   b. DDLS: header Aircraft type, Registration, page No.; one block per
      entry with the opening, clearing and extension fields above;
      4 entries per page; footer "When all entries are closed, return
      the completed page to CAMO".
   Footer on both: "Printed from Nexus MRO · date · by [name] · version ·
   uncontrolled when printed".
6. Home and fleet board: "DDLS 2 · NADD 3" counts; tiles open the lists.
   A-check package: panel "Open NADDs: rectify before A-check" (flagged
   only; it never blocks the package from closing, D-166). Add open and
   overdue NADDs to the pending / overdue list on Home.
7. Person record and Create account: add "3LC" field (3 letters, unique).
8. Operator settings: NADD default limit (days), DDLS extension-allowed
   categories, rows per printed sheet.
9. Mobile: DDLS and NADD lists, Log NADD / Propose NADD form.

NOT: No copying of the operator's actual sheet artwork, crest or form
numbers. Fictional data only (NX tails, invented defects, invented 3LCs).
No change to tail status from DDLS or NADD entries.
STOP IF: A field or rule isn't in workflows/ddls.md or workflows/nadd.md.
DONE = All screens linked both ways with sticky notes; list every
artboard added or changed.
```

---

## Prompt 6: Usability fixes from Promise's review (7 Oct 2026)

Canvas state when written: Prompts 1 to 4 and 3 done. Item 11 added 7 Oct (scheduling provision, D-017) (84 artboards, pages Fleet board, Wireframe, Department views). Prompt 5 (NADD) not yet run. Run this before Prompts 7 and 5.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Apply these usability fixes across every artboard on the "Nexus MRO"
canvas (all three pages, desktop and mobile).

CONTEXT: New rule D-098: every tile is clickable as a whole; every screen has
Back and a breadcrumb; a screen never asks for what it already knows;
"History" on a record opens that record's version history.

SCOPE:
1. Clickable tiles: every count tile and summary box (e.g. "Open snags 2")
   is one link covering the whole box, not just the number. Hover and
   focus state on the whole box.
2. Back and breadcrumb: every screen below Home gets a Back button and a
   breadcrumb under the top bar, e.g. "All aircraft › NX-102 › Snags ›
   SNAG-0142". Mobile: Back arrow in the header.
3. "All aircraft" (fleet overview, desktop and mobile): remove "Report
   snag" and "Log flight hours". These live only under a tail.
4. Log flight hours opened from a tail: the tail is already filled in and
   shown as read-only text, not a field.
5. Part detail → "Request this part": the part request form opens with the
   part number, description and store already filled in (read-only).
6. Flight records: "History" on an entry opens a new "Flight record
   version history" screen: every version of that entry, who, when and
   the reason for each correction. Add a separate "Aircraft history" link.
   Apply the same rule to every record's History link.
7. Stores search: add a Search button next to the field (Enter also
   searches). Show the results state: matching parts with quantity per
   store ("Main 4 · Forward 1"), certificate and shelf-life flags.
   Add an empty state "No parts match [P/N]".
8. Apply MEL item (from Disposition "Defer under MEL" and from MEL list):
   a type-ahead field "MEL item". As the engineer types, show suggestions
   from the aircraft's loaded MEL revision (item number and title). Typing
   an exact item number shows that item first. Choosing an item fills in,
   read-only: item, title, category, interval, remarks or exceptions,
   (M) and (O) procedure flags, MEL revision. Then the D-053 confirmations
   ((M) done, (O) passed to Operations, placard fitted), remarks, and
   "Apply MEL" (online, PIN).
9. Part request form: "Request type" = Aircraft part (tail + work order or
   task card required) or Consumable (no snag needed; work order or
   "General use" with purpose; tail optional). Remove the requirement to
   link a snag.
10. Conflicts on the open-questions sticky:
    C1: bring "Fleet board · desktop" and "Fleet board · mobile" in line
        with the Hangar-grade theme and the department rail rule.
    C2: add a "Sign in" screen (service number or email, password, then
        PIN set-up on first sign-in) and link "Sign out" to it.
    C3, C4: keep as they are.
11. Scheduling provision (D-017): add "Flight scheduling" and "Crew
    scheduling" to the Operations area of the left rail and to mobile
    More, each with a grey "Coming soon" tag. Each opens one placeholder
    screen: title, one line on what it will do ("Plan flights against
    aircraft availability from Engineering" / "Roster crew against
    qualifications and availability"), and "Coming soon". In Operator
    settings add two switches: "Show Flight scheduling (coming soon)" and
    "Show Crew scheduling (coming soon)". No scheduling features.
12. Engineering sections (D-018): add "Tire Bay", "Battery Workshop" and
    "Aerospace Ground Equipment (AGE)" under Engineering in the left rail
    (shown only to users granted them). Each opens a landing screen with
    the section name, an empty register table and a sticky "Records and
    workflow to be defined (O-15)". No invented workflows.
13. Account screens (Create account, Account page): add "Store access"
    (Main Store, Forward Store, checkboxes) and "Engineering sections"
    (Line, Base, Tire Bay, Battery Workshop, AGE) beside aircraft scope.
    Stores search and transfers show only the stores the user holds.

NOT: No new features beyond this list. Don't change decisions shown on
existing stickies. Fictional data only.
STOP IF: A fix conflicts with an existing screen's rule; note it on the
open-questions sticky.
DONE = Every artboard checked; list each one changed.
```

---

## Prompt 7: Work orders, completion evidence, CRS, two stores, reports, MRO oversight

Run after Prompt 6. Read `workflows/work-order.md` and section 11A of `workflows/part-request.md`. O-11 and O-12 were answered on 8 Oct with the recommendations (D-067 to D-069, D-150, D-151).

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Add the work order approval flow, completion evidence, CRS, two-store
stock, printable histories and Procurement's outside-MRO screens to the
"Nexus MRO" canvas, wireframe style, with link sticky notes.

CONTEXT: Rules D-063 to D-066, D-097, D-141 to D-144.

SCOPE:
A. WORK ORDERS
 1. Work order request form, raised from an assessed snag or a package:
    scope of work, estimated man-hours, parts (reserve only before
    approval). Number shown as "Assigned on submission".
 2. Work order detail with an approval strip: Requested → Quality
    pre-approval → CO final approval → Open → Work complete → Certified.
    Before approval: all task entries, updates and sign-offs are disabled,
    with the message "Locked until Quality and CO approve".
    Number in Plex Mono, e.g. WO-000214 (one sequence for the fleet).
 3. Approve / reject screens for Quality and for the CO (reason required
    to reject). Add both to the Approvals inbox.
 4. "Blocked by: work order awaiting CO · 3h" on the tail card and Home.
 5. Completion evidence step: upload scanned sign-off card, technical log
    page, aircraft logbook entry, engine logbook entry (PDF or image).
    "Certify and close" is disabled until the required scans are attached.
B. CRS
 6. Package detail: when all tasks are certified and findings closed,
    show "Compile CRS". CRS preview (A4): draft watermark "Not valid until
    signed", aircraft, package, work orders, tasks, deferred items carried
    forward (MEL, NADD), certifying staff block.
 7. Sign CRS (certifying engineer, online, PIN) → reference number
    assigned (e.g. CRS-000087) → Print and Download PDF.
C. TWO STORES
 8. Stores search and part detail: quantity per store (Main, Forward).
 9. Transfer: Main Store raises transfer to Forward → in transit →
    Forward confirms receipt → Main acknowledges.
10. Forward Store direct receipt: Forward records it and reports to Main;
    shown in Main's "Receipts to acknowledge" list until acknowledged.
10a. Receiving inspection and part registration: required uploads
    "Release certificate" (type: EASA Form 1 / FAA 8130-3 / CofC, as
    configured for the part class) and "Serviceable tag". "Accept to
    stock" is disabled until both are attached (D-153).
D. REPORTS AND HISTORIES
11. Reports screen with these reports, each with date range, Print and
    Download (PDF, spreadsheet): parts removal and installation; work
    order history; completed task history; parts received (month); parts
    purchased (month or year); total cost of parts. Cost reports visible
    only to users with "View cost".
12. Add Print / Download to every History screen.
E. PROCUREMENT: OUTSIDE MRO
13. Outside-MRO jobs list (Procurement): MRO name (fictional), aircraft,
    scope, quoted cost, negotiated cost, status.
14. MRO job detail: quotes and negotiation log, agreed cost, parts used by
    the MRO with cost, invoices (PDF), link to the Engineering work order.
    Technical acceptance shown as "Accepted by [Engineer] / [Quality]",
    not by Procurement.

NOT: No CRS without a certifying engineer's signature. No cost on screens
for users without "View cost". No real MRO names or PAF data.
STOP IF: A screen needs a rule not in D-063 to D-066, D-097, D-141 to D-144.
DONE = All screens linked both ways with sticky notes; list every
artboard added or changed.
```

**Run order now:** Prompt 6 → Prompt 7 → Prompt 5 (DDLS and NADDS).

---

## Prompt 8: Workshops, and review fixes after Prompts 5 to 7

Canvas state when written (8 Oct 2026): 117 artboards on pages Home, Wireframe, Department views. Prompts 1 to 7 done. Workshop rules: D-019, `workflows/workshops.md`. Items marked (DEFAULT) follow Claude's recommendations for open questions Q-WS1 to Q-WS3; change them if Promise answers differently.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Design the Tire Bay and Battery Workshop screens, and fix the review
items below, on the "Nexus MRO" canvas (wireframe style, link stickies).

CONTEXT: Read workflows/workshops.md. Workshops raise their own work
orders (Quality pre-approval, CO final approval). When an aircraft work
order needing a tire assembly or battery is approved, the workshop gets a
request to issue one by serial number.

SCOPE:
A. TIRE BAY (replace the placeholder TB1)
 1. Tire Bay home: tiles (whole tile clickable) for Requests to issue,
    Serviceable assemblies, Internal work orders, Removed units awaiting
    strip; registers: Wheels, Tires, Assemblies.
 2. Assembly detail: assembly ref, tire S/N, wheel S/N, built by (3LC),
    build date, pressure recorded, status (serviceable / fitted /
    removed), fitted to tail and position, landings while fitted (sum of
    flight records), history.
 3. Internal work order request (Tire Bay): job type = Tire request,
    Wheel request, Tire and wheel build-up, Strip and inspect; goes to
    Quality then CO, same approval strip as aircraft WOs.
 4. Request to issue (from an approved fleet WO): shows WO number, tail,
    position, assembly P/N; pick a serviceable assembly by S/N; Issue
    (PIN). Unapproved WOs never appear here.
 5. Tire Bay stock location (DEFAULT): serviceable assemblies appear in
    Stores search as location "Tire Bay".
B. BATTERY WORKSHOP (replace the placeholder BW1)
 6. Battery Workshop home: tiles for Requests to issue, Serviceable
    batteries, Capacity tests due (date entered by staff), Internal work
    orders.
 7. Battery detail: S/N, P/N, type, status, fitted to, capacity test
    history (date, result, by, next test date as entered), charge records.
 8. Record capacity test: result, notes, next test date (entered), sign
    (PIN).
 9. Internal work order (Battery): job type = Capacity test, Servicing;
    periodic work order option "Routine tests for [month]" approved once
    (DEFAULT).
10. Request to issue battery from an approved fleet WO, as in 4.
C. FLEET SIDE
11. Aircraft work order request: when scope is "Tire change" or "Battery
    change", add "Workshop request: issue tire assembly / battery,
    position [ ]". After CO approval, the WO detail shows "Request sent to
    Tire Bay / Battery Workshop" and then "Issued: S/N [ ] by [3LC]".
D. FIXES FROM REVIEW
12. CO final approval (WCO): show "CO or acting deputy" (D-067).
13. Completion evidence (WOE): an item is either "Required" or "Not
    required for this work order", never both.
14. Outside-MRO job detail (MRO2): breadcrumb "Procurement › Outside-MRO
    jobs › MRO-0007"; link it to a work order on the same tail (NX-101).
15. CRS preview: NADD carried forward shows its expiry date as well as
    "before next A-check".
16. Add "Check type: A-check" to Create package, and draw an A-check
    package detail with the "Open NADDs: rectify before A-check" panel
    (flagged only, never blocks closing).
17. Approval chain set-up (P4): add rows "NADD extension (default:
    Quality)", "DDLS extension", "Workshop work orders".
18. Operator settings: add "Completion scans required per work order
    type" table (aircraft, workshop, package).
19. Open-questions sticky: mark C8 resolved (decisions now logged), C9
    resolved (D-067: acting deputy only, no verbal path), C10 to C12
    resolved by items 16 to 18.
20. AGE placeholder stays; sticky "Waiting for AGE description (O-15)".

NOT: No invented AGE workflow. No calculated test or due dates. Fictional
data only (NX tails, invented serials and 3LCs).
STOP IF: A screen needs a rule not in workflows/workshops.md or the
decisions log.
DONE = All screens linked both ways; list every artboard added or changed.
```

---

## Prompt 9: Housekeeping (9 Oct 2026)

Canvas state when written: 139 artboards; Prompts 1 to 8 done. See `docs/design-status.md`.

```
[Design standing rules from docs/PROMPTING.md section 1]

TASK: Tidy the "Nexus MRO" canvas. No new features.

SCOPE:
1. "Proposals awaiting decision" sticky: mark P1 to P7 as DECIDED with
   their decision IDs: P1 → D-063, D-067; P2 → D-065; P3 → D-064;
   P4 → D-066, D-069; P5 → D-141, D-142, D-150 to D-152; P6 → D-097;
   P7 → D-144. Keep P8, P9 and P10 as open (O-16, O-17, O-18).
2. Open-questions sticky: mark C7 resolved (transfer screens TR1, FWD1,
   ACK1 exist).
3. C6: on every desktop screen the user name in the top bar opens a small
   account menu: My account, Sign out (→ Sign in screen).
4. Mission detail (OP4) and fleet roster (SCH1): for a "Snag open" tail,
   show "Awaiting engineer assessment · not assignable" instead of "Not
   available" (D-045: Snag open is counted separately, never as not
   available).

NOT: No other changes.
DONE = List every artboard changed.
```
