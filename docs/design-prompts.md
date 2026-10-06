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

NOT: Users cannot change their own department, so no department picker in
the user's own settings. No cost on Operations or Engineering views. Don't
change the Engineering Fleet board.
STOP IF: A department needs information not listed above.
DONE = Six artboards; a sticky note on each view listing what is hidden
from that department.
```
