# UI rules: grouping without hiding

**Status:** working rules for the builder and for Claude Design prompts. They apply D-094 and D-098, which stay in force. If one of these rules should become a decision, log it in `docs/DECISIONS.md`.
**Agreed:** 8 Oct 2026 (UX pass after Phase 1B slice 1).

---

## The one-line rule

**Group navigation and actions in dropdowns. Never hide status.**

## 1. What goes in a dropdown

| Kind of thing | Where it goes | Example |
|---|---|---|
| Screens of a department | Rail: department ▾ | Engineering ▾ |
| Related screens inside a department | One group level | Workshops ▸ Tire Bay, Battery Workshop, AGE |
| Actions that create something | The **＋ New ▾** menu in the top bar, filtered to what the user may do | Report snag, Cabin item, Request part, Raise technical query |
| Account items | The **user menu ▾** (3LC) | Change PIN, My account, Sign out (D-206) |
| Departments a Command or Quality user only reads | **Other departments ▾**, collapsed, each marked "View" (D-122) | |
| List filters on a phone | One "Show: … ▾" dropdown | Show: U/S or AOG (1) |
| Choosing a tail | Searchable tail box: type part of the tail; each match shows its status chip | "203" finds NX-203 |

## 2. What never goes in a dropdown

- **Tail status and who set it** (D-046, D-094 "status always visible")
- **"Blocked by"**, with the holding department and time held (D-006, D-094)
- **Overdue or expiring items** (DDLS, NADD, MEL limits)
- **Online / offline state** (D-094)
- **The signing step**: PIN entry is always on the screen being signed, never tucked away (D-094)

## 3. Depth

- **At most two levels:** department ▸ group ▸ screen. A third level breaks "three taps to anything routine" (D-094).
- Only **one department open at a time** in the rail, so it never floods.
- The "Other departments" heading is a collapsible heading, not a level.

## 4. Behaviour

- Actions live in **＋ New**, not repeated as buttons on every screen. Opened while on a tail, the tail is filled in (D-098).
- Screens not built yet appear greyed with a **"Soon"** tag, so the map of the app is visible but nothing pretends to work.
- Whole rows, cards and tiles are clickable (D-098). A **▸ arrow** on a row opens detail in place; clicking the row opens the full record.
- Empty values are left blank or say "No open items", not columns of zeros.
- Menus close on choosing an item, tapping outside or pressing Escape. Touch targets are at least 44 px (D-093).
- Every status colour comes with a word (D-091).

## 5. Phone layout

- The rail sits behind **☰**.
- The fleet board shows aircraft cards straight away. The filter is a single dropdown, not a wall of tiles.
- The top bar keeps: ☰, mark, offline pill (shown only when offline), ＋ New, user menu.
