# Phase 1 test feedback: change requests

**From:** Promise, testing the built Phase 1 (10 Oct 2026).
**For:** Claude Code. The Documents assistant has not touched `app/`; file names below are where the change seems to belong, from reading the code.
**Canvas:** the designs already show these changes (Home, HomeMobile, WF-B2, WF-D2, WF-D4, WF-D5, WF-DD3, WF-NA3, WF-R4, WF-WO1).

| # | Change | Status |
|---|---|---|
| CR-1 | Totals, Engines and APU inside the Aircraft record section | **Built 10 Oct** |
| CR-2 | Calendar half its current size | **Built 10 Oct** |
| CR-3 | Click anywhere on a section bar to show or hide | **Built 10 Oct** |
| CR-4 | A visible way to request a work order | **Built 10 Oct**: snag page, ＋ New, aircraft page, DDLS sheet |
| CR-5 | Work order needed before work and before any clearance | **Built 10 Oct as D-218** (migration 0024) |

---

## CR-1: Totals, Engines and APU in the Aircraft record

**Promise:** "Totals, engine & APU should all appear in the aircraft record section."

- `app/src/screens/AircraftPage.tsx`: the `totals` and `engines` panels become two sub-headings inside the `record` panel ("Totals" with the Flight records link, "Engines and APU" with All components). Remove them from `PANELS`.
- Keep the "not recorded yet" wording until Phase 2 builds flight records and components (`docs/phase2-spec.md` slices 1 and 2).
- **Done when:** the aircraft page has no separate Totals or Engines and APU sections, and hiding Aircraft record hides all three.

## CR-2: Calendar half size

**Promise:** "the calendar for next 4 weeks should be smaller, half the current size."

- `Calendar` in `AircraftPage.tsx` and its styles in `theme.css`: half the width (grid about 50% of the panel, minimum about 340 px so it still fits a phone) and half the day-cell height; day numbers and event chips one size smaller.
- Event chips stay tappable as links (`docs/ui-rules.md`); if a chip gets too small to tap on a tablet, the day cell opens the list for that day.
- **Done when:** the four weeks take about half the space they took before, on desktop and tablet.

## CR-3: Click anywhere on the section bar

**Promise:** "We don't necessarily have to click on the show or hide button before we can view the items hidden. Any part of the box can be clicked to view the item."

- `Panel` in `AircraftPage.tsx`: the whole header bar toggles the section. Clicks on a link inside the bar (Flight records, All components, All snags) still open the link and do not toggle.
- Keep a real button (or make the bar itself the button) so keyboard and screen-reader users can still toggle with Enter / Space and hear "expanded / collapsed".
- Apply the same pattern to every collapsible section in the app, not just this page.
- **Done when:** clicking the title or empty space on a closed section opens it.

## CR-4: A visible way to request a work order

**Promise:** "I did not see a way to request work order. The option should also be incorporated into the snag section."

Today the request is only reachable inside Disposition → "Rectify now: request a work order" (`Disposition.tsx`, `request_work_order`). Add entry points:

1. **Snag detail** (`SnagDetail.tsx`): a "Work order" box near the top. With none yet: "No work order yet" and a **Request work order** button. With one: its number and state chip, linked.
2. **Work orders list** (`WorkOrders.tsx`): a **Request work order** button that asks for the tail and the snag (or package) it is for. A screen never asks for what it already knows (D-098): from a tail page or snag, those are filled in.
3. **＋ New menu** (`Home.tsx`): "Request work order" for engineers, beside Report snag.
4. **Aircraft page**: the "Work orders open" tile stays; Open items shows "Request work order" on each snag row without one.

- **Done when:** an engineer can reach the work order request from the snag, from Work orders and from ＋ New in no more than three taps (D-094).

## CR-5: Work order first (only after P21 is logged)

**Promise:** "When a snag or an observation is made, the request for work order is needed and approved before any thread or job can be carried out on the task. The only thing that can be allowed without a work order is deferring as an MEL or NADD item. A work order must have been raised before the fault can be cleared."

This changes **D-067**, so it is written as **proposal P21** with questions Q-WO7 to Q-WO11. Full rule and table: `workflows/work-order.md` section 8. Once logged:

- No fault found, DDLS deferral when not under the MEL, and every clearance (snag, MEL, DDLS, NADD) need an approved (Open) work order, enforced in the database.
- MEL and NADD deferral stay possible without a work order.
- Disposition is split into "Needs an approved work order" and "Allowed without a work order" (canvas WF-D4).
- Tests to add to `docs/local-test-script.md`: try to certify no-fault-found without a work order (refused); defer under MEL without one (allowed); clear that MEL item without one (refused); clear it with an approved one (allowed).
