# Design status

**Canvas:** "Nexus MRO" in Claude Design (https://claude.ai/artifact/4p1QKFaK2PbZKd5PJq8a2m)
**As at:** 11 Oct 2026 · **155 artboards** on 3 pages (Home, Wireframe, Department views) · canvas version 70
**Prompts run:** 1 to 10 (`docs/design-prompts.md`), plus Promise's own requests from 6 to 8 Oct (all now logged as D-200 to D-213).
**Next:** Prompt 11, to bring the canvas in line with what Claude Code built in Phase 1 and with `docs/ui-rules.md`.

---

## 1. What is designed

| Area | Screens | Rules followed |
|---|---|---|
| Home and fleet board | Home · All aircraft (filter chips, cards with "Blocked by", Needs attention), aircraft dashboard NX-102 with yellow quick-access rail, mobile versions, department boards (Engineering, Operations, Supply, Procurement), "View as" prototype (11 users, two with two departments) | D-045 to D-047, D-096, D-098, D-120 to D-127, D-200 |
| Sign-in and accounts | Designed sign-in (desktop and mobile): username or email, show/hide password, forgotten password, first-sign-in PIN, request an account; account menu (My account, Sign out) on every desktop top bar | D-123, D-206 |
| Navigation | Rail: "All aircraft" with tail dropdown, then department dropdowns (home open), Approvals, Queries, Reports, Administration for Super Admins; mobile "More" with the same structure; shared search box (MEL items, tails, snags, work orders, parts, people) | D-201, D-202 |
| Aircraft | Components by position, removal / installation, flight records and versions, part requests, documents, history, ADs and SBs | D-016, D-022, D-027, D-098 |
| Snags and deferrals | Snag list / detail / assess / disposition (5 options), certify, report snag, MEL apply (live type-ahead), DDLS, NADD, extensions, NADDS and DDLS prints, similar and repeat defects, cabin items on a cabin map and Engineering's review | D-040 to D-049, D-058, D-160 to D-166, D-200, D-208, D-209 |
| Checks and work orders | Packages, A-check package, task cards, non-routine cards, work order request, Quality and CO approvals, completion evidence, CRS preview and signing, column chooser | D-044, D-060 to D-069, D-210 |
| Parts and stores | Stores search, part detail, part request, issue, receiving inspection with mandatory documents, quarantine, U/S returns, transfers Main → Forward, Forward receipts, receipts to acknowledge | D-070 to D-077, D-140 to D-153 |
| Procurement | Requisitions, purchase orders, outside-MRO jobs and detail | D-075 to D-079, D-144 to D-149 |
| Workshops | Tire Bay, Battery Workshop, AGE (draft until O-15) | D-018, D-019 |
| Oversight | Approvals inbox, reject with reason, notifications, audit trail, reports and guided report builder, technical queries (list, detail, raise, mobile), people | D-079, D-097, D-126, D-207, D-211 |
| Operations | Operations availability, flight requests, Outstanding missions, mission detail, fleet roster, crew roster, assign crew, flight order, crew "My duties" (mobile) | D-205 (O-14 and O-20 still open) |
| Prints | NADDS, DDLS, CRS, flight order, daily serviceability state (Engineering and Operations copies) | D-049, D-066, D-161, D-203 |
| Mobile | Fleet, aircraft, snags, report snag, cabin map, stores, part request, queries, sync queue, More, pilot board, My duties | D-093, D-209 |
| Look | Light blue, yellow, black and white; status colours unchanged; dates "07 Oct 2026", times 24-hour | D-091, D-204, D-212 |

## 2. Where the canvas and the built app differ (for Prompt 11)

Claude Code's UX pass (`docs/ui-rules.md`, `app/src/components/Rail.tsx`) went further than the canvas:

| Built app | Canvas today |
|---|---|
| Rail groups one level deeper (Engineering ▸ Snags & deferrals ▸ Snags, DDLS, NADDs; Workshops ▸ Tire Bay, Battery Workshop, AGE), one department open at a time, Quality and Command get "Other departments ▾" marked View, unbuilt screens tagged "Soon" | Department dropdowns without groups; no "Soon" tags |
| Tail search box under "All aircraft" ("Go to a tail", each match with its status chip) | Arrow dropdown with the tail list |
| **＋ New ▾** menu in the top bar for actions (Report snag, Cabin item, Request part, Raise technical query), filtered to what the user may do | Actions as buttons on screens; yellow quick-access rail on the aircraft dashboard |
| User menu (3LC ▾): Change PIN, This tablet and offline signing, My account, Sign out | My account, Sign out |
| Phone: rail behind ☰; fleet filter is one "Show: … ▾" dropdown; top bar ☰, mark, offline pill (only when offline), ＋ New, user menu | Filter chips on phone; More in the bottom bar |
| Setting a tail status asks for the PIN (D-215); MEL and DDLS deferral offer "Also set the tail to Serviceable · MEL" (D-216) | Not shown |
| Offline signing on enrolled tablets: "Signed offline · awaiting server check" on screen and on prints; "This tablet", "Send queue", Quality's "Offline signatures" screens (D-217) | Not designed |
| Snag numbers SNAG-000001 (D-213) | Sample data still SNAG-0142 |

## 3. Waiting on Promise

| Item | What | Where |
|---|---|---|
| Phase 1 test | Run `docs/local-test-script.md` on the PC and a real tablet | `docs/local-test-script.md` |
| Phase 2 questions | Q-P2-1 to Q-P2-9 and proposals P-2.1 to P-2.8 | `docs/phase2-spec.md` |
| Quick-access rail | The yellow quick-access rail on the aircraft dashboard (Promise's request, 7 Oct) and `ui-rules.md` ("actions live in ＋ New, not repeated as buttons") pull in different directions. Keep both, or keep only ＋ New? | Prompt 11, item 4 |
| O-14 | Classification handling for scheduling data; must close before scheduling is built (D-205) | `workflows/scheduling.md` |
| O-15 | Workshops Q-WS1 to Q-WS5 and the AGE description | `workflows/workshops.md` |
| O-20 | Scheduling details Q-OP1 to Q-OP4 | `workflows/scheduling.md` |
| Canvas questions | Q-SO1, Q-LG1 to Q-LG3, Q-CR1 to Q-CR3, Q-FO1, Q-TQ1 to Q-TQ2, Q-RD1, Q-CI1 to Q-CI2, Q-CC1, Q-RB1 (defaults drawn; some answered by the build, e.g. the raiser closes a query) | "Open questions (2)" sticky on the Wireframe page |

## 4. Notes for Claude Code

- `CLAUDE.md` line 35 still describes the theme as navy and teal; D-212 replaced it (light blue, yellow, black, white). `docs/PROMPTING.md` is updated.
- The canvas's connection check (green sticky, Wireframe page) lists 39 end-to-end flows; all connect.


## Update 11 Oct 2026: canvas aligned with the built app

Source: the app on GitHub `main` (Phase C, commit "Phase C1: snag screens follow the design", 10 Oct) and Promise's screenshot of the rail. The copy of `app/` in this folder is older than GitHub.

| Area | Now on the canvas |
|---|---|
| Rail (124 boards) | All aircraft (arrow opens tails) · Technical queries · Go to a tail · MY DEPARTMENTS · departments with groups: Engineering ▸ Snags & deferrals (Snags, MEL / DDLS, NADDs, Cabin items to review), Work orders, Workshops (Tire Bay, Battery Workshop, AGE) · Approvals, Reports. Selected item: light blue with a yellow bar. Mobile More (R11) the same |
| Top bar (125 boards) | ＋ New: Report snag, Cabin item, Request work order, Request part (Soon), Raise technical query. Account menu: My account · change PIN, This tablet and offline signing, Send queue, Sign out |
| D-218 | D2, R4, D4, D5, DD3, NA3, WO1 follow the decided rule (deferral under MEL, DDLS or NADD without a work order; NFF tick at certification; NADD direct rectification) |
| D-213 | Sample snags renumbered SNAG-000142 style |
| New screens | WF-TAB1 This tablet and offline signing; WF-OFS1 Offline signatures (Quality) |
| Names | "Sync queue" → "Send queue" |

**Still different from Prompt 11:** the View as boards keep their role-specific rails; the D-215 PIN on tail status and the D-216 "Also set Serviceable · MEL" box are not yet drawn on every screen; the phone top bar is unchanged.
