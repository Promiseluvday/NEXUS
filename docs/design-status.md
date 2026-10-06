# Design status

**Canvas:** "Nexus MRO" in Claude Design (https://claude.ai/artifact/4p1QKFaK2PbZKd5PJq8a2m)
**As at:** 9 Oct 2026 · **139 artboards** on 3 pages (Home, Wireframe, Department views)
**Prompts run:** 1 to 8 (`docs/design-prompts.md`), plus Promise's own requests that became proposals P8 to P10 on the canvas.

---

## 1. What is designed

| Area | Screens | Rules followed |
|---|---|---|
| Home and fleet board | Home desktop and mobile (aircraft-first), All aircraft board, department fleet boards (Engineering, Operations, Supply, Procurement), "View as each user" prototype | D-045 to D-047, D-096, D-098, D-120 to D-127 |
| Sign-in, accounts, admin | Sign in, create account, account page, users and roles, aircraft register, add / deactivate aircraft, approval chain set-up, MEL loading, operator settings | D-015, D-033, D-121 to D-124, D-152 |
| Aircraft | Dashboard, components by position, removal / installation, flight records and versions, part requests, documents, history, ADs and SBs | D-016, D-022, D-027, D-098 |
| Snags and deferrals | Snag list / detail / assess / disposition (5 options), certify, report snag, MEL apply (type-ahead), DDLS, NADD, extensions, NADDS and DDLS prints | D-040 to D-049, D-058, D-160 to D-166 |
| Checks and work orders | Packages, A-check package, task cards, non-routine cards, work order request, Quality and CO approvals, completion evidence, CRS preview and signing | D-044, D-060 to D-069 |
| Parts and stores | Stores search, part detail, part request, issue, receiving inspection with mandatory documents, quarantine, U/S returns, transfers Main → Forward, Forward receipts, receipts to acknowledge | D-070 to D-077, D-140 to D-153 |
| Procurement | Requisitions, purchase orders, outside-MRO jobs and detail | D-075 to D-079, D-144 to D-149 |
| Workshops | Tire Bay (assemblies, internal WOs, requests to issue), Battery Workshop (batteries, capacity tests, internal WOs, requests to issue), AGE (draft) | D-018, D-019 |
| Oversight | Approvals inbox, reject with reason, notifications, audit trail, reports, search, people | D-079, D-097, D-126 |
| Operations | Operations availability, flight and crew scheduling placeholders, **draft** flight requests, outstanding missions, mission detail, fleet roster | D-017 (P9 pending) |
| Prints | NADDS, DDLS, CRS, daily serviceability state (Engineering and Operations copies) | D-049, D-066, D-161, P10 pending |
| Mobile | Fleet, aircraft, snags, report snag, stores, part request, sync queue, More, Operations (pilots) | D-090, D-093 |

---

## 2. Waiting on Promise

| Item | What | Where |
|---|---|---|
| **O-16 (P8)** | Aircraft list as a dropdown beside "All aircraft" instead of one rail row per tail. Amends D-096 | Canvas, every screen |
| **O-17 (P9)** | Flight requests, outstanding missions and fleet roster drawn as drafts. Decide: design now, build in Phase 6 (recommended), or bring forward. Plus Q-OP1 to Q-OP4 | OP2 to OP4, SCH1 |
| **O-18 (P10)** | Daily serviceability state print. Plus Q-PR1 to Q-PR3 | PRS, PRS2 |
| **O-19** | Fleet board v2 reference (`design/fleet-board/`): P-FB-1 to P-FB-4. P-FB-2 conflicts with D-045 (amber flag vs "Snag open" chip): choose one | `design/fleet-board/review.md` |
| O-15 | Workshops Q-WS1 to Q-WS5, and the AGE description | `workflows/workshops.md` |
| O-14 | Classification handling for scheduling data | `workflows/scheduling.md` |

## 3. Housekeeping still to do on the canvas (Prompt 9)

- The "Proposals awaiting decision" sticky still lists P1 to P7, which are already logged as decisions.
- Desktop has no account menu or Sign out (C6).
- Mission and roster screens call a "Snag open" tail "Not available"; D-045 says it is counted separately. Use "Awaiting engineer assessment".
- C7 (transfer screens) is now drawn; mark resolved.
