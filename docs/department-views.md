# Department views

**Status:** Agreed by Promise on 6 Oct 2026. To be logged in `docs/DECISIONS.md` (proposed IDs below) once Promise gives the go-ahead.
**Builds on:** D-010, D-033, D-035, D-077, D-094 ("role-based home screens"), D-101 (row-level security)

---

## 1. Summary

Every department sees the **same fleet and the same tail statuses**, but each sees a **different level of detail**, matched to its job:

| Department | Sees |
|---|---|
| **Engineering** | Everything about the aircraft |
| **Operations** | What the pilot and the flight need: availability, operational limitations, placards |
| **Supply** | Parts activity per tail: requests, reservations, issues, returns, shelf life |
| **Procurement** | Supply's parts view plus requisitions, approvals, orders, suppliers and cost |
| **Command / Quality** | Across all four (proposed; see Q-D3) |

The department is set on the user's account, **during or after account creation**.

---

## 2. What each department sees on the fleet board

✅ = shown · ◐ = headline only, no detail · — = hidden

| Information | Eng | Ops | Supply | Proc |
|---|---|---|---|---|
| Tail, type, status word, who set it and when | ✅ | ✅ | ✅ | ✅ |
| "Blocked by": headline, holding department, time held | ✅ | ✅ | ✅ | ✅ |
| Snag technical detail, engineering notes | ✅ | — | — | — |
| Pilot reports the user raised (own reports, state only) | ✅ | ✅ | — | — |
| MEL item: category, countdown, expiry | ✅ | ✅ | — | — |
| MEL **(O)** operational procedure and placard | ✅ | ✅ | — | — |
| MEL **(M)** maintenance procedure | ✅ | — | — | — |
| Engineer-entered return to service estimate | ✅ | ✅ | ◐ | ◐ |
| Check package and "X of Y tasks completed" | ✅ | ◐ (in check, until when) | — | — |
| Hours, cycles, landings | ✅ | ✅ | — | — |
| Engineer-entered next-due figures | ✅ | — | — | — |
| Part requests per tail: P/N, qty, priority, state, holder | ✅ | — | ✅ | ✅ |
| Stock, reservations, awaiting issue, U/S returns | ◐ (own requests) | — | ✅ | ✅ |
| Shelf-life and certificate alerts | ◐ | — | ✅ | ✅ |
| Requisitions, approval step, PO, supplier, ETA | ◐ (state and ETA) | — | ✅ | ✅ |
| Cost, invoice, price history | — | — | ✅ (D-077) | ✅ (D-077) |
| "Needs attention" panel | Eng items | Ops items | Supply items | Proc + Supply items |
| Main actions | Report snag, Log hours | Report snag (pilots), Log hours | Issue, Receive | Raise PO, Update ETA |

**Why "Blocked by" stays visible to every department:** it is the signature feature (D-006). Its value is that each department can see when *it* is the one holding an aircraft down. Hide it and departments stop seeing their own delays. The headline is shared; the detail behind it follows this table.

---

## 3. Department on the account

- An account has **one home department**. It decides the default home screen and fleet board view.
- Department is set **when the account is created, or changed later**, from the user's account page.
- Only a **Super Admin** (D-035) or a delegated admin can set or change it. **A user cannot pick or change their own department** (D-033): choosing a department grants visibility, and self-granting is not allowed.
- A user may **request** a change; a Super Admin approves it. Every change is logged with who, to whom, from, to, why (D-033).
- Extra department views (e.g. a Supply person who also covers Procurement) are granted **explicitly and logged**, never by default.
- Pilots sit in **Operations** with the Pilot role.

---

## 4. Risks

| Risk | What goes wrong | Mitigation |
|---|---|---|
| Hiding is only cosmetic | If the screen hides data but the database still sends it, anyone with basic skills can read it from the browser | **Enforce in the database** with row-level security (D-101). The screen only shows what the database already allowed |
| Self-assigned department | A user switches to Procurement to see cost | Only Super Admins assign; changes logged (D-033) |
| Operations misreads a status | A pilot sees "SVC · MEL" without the (O) procedure | Operations view always shows the (O) procedure and placard with any open MEL item |
| One person, two hats | Small units where one person does Supply and Procurement | Explicit extra view, logged; separation of duties (D-075) still enforced per action |

---

## 5. Questions for Promise

| # | Question | Recommendation |
|---|---|---|
| Q-D1 | Does the table in section 2 match what each department needs? | Review row by row. Operations and Supply are my best estimates |
| Q-D2 | Should Operations see hours, cycles and landings? | Yes: they feed flight planning and pilots log them |
| Q-D3 | Command and Quality see everything, read-only, plus their approvals? | Yes. Command sees cost; Quality sees everything except cost |
| Q-D4 | Can a user hold more than one department? | One home department plus explicitly granted extra views |

---

## 6. Proposed decisions

- **D-096 (draft):** Each department has its own fleet board view and home screen. Tail, status, who set it, and the "Blocked by" headline are visible to all; detail follows the department view table.
- **D-097 (draft):** Department visibility is enforced in the database (row-level security), not only on screen.
- **D-098 (draft; section 4 is full, so it sits here unless renumbered):** Every account has one home department, set by a Super Admin during or after account creation. Users cannot change their own department; changes are logged.
