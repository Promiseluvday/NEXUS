# Deferred Defects Log Sheet (DDLS) workflow

**Status:** Agreed by Promise on 8 Oct 2026 and logged as **D-163 and D-164**.
**Replaces the name:** Hold Item List (HIL).
**Builds on:** D-040, D-050 to D-058, D-063 to D-066, D-160 to D-165

---

## 1. Summary

Every aircraft has a **DDLS**: the list of deferred defects that **do** concern airworthiness and are being carried under control.

| What goes on it | How |
|---|---|
| **Every MEL deferral** | **Automatically**, the moment the MEL item is applied (D-058) |
| **Other deferred defects** an engineer judges to be DDLS items and **not** NADDs (e.g. damage within manual limits, awaiting parts) | Engineer places them on the DDLS, with the days allowed and the manual reference |

**NADDs** (convenience items, non-airworthiness) go on the separate **NADDS** (`workflows/nadd.md`), never on the DDLS.

**Three ways a deferred defect is held:**

```
Snag assessed by engineer
   ├── Defer under MEL ───────────► DDLS (automatic)
   ├── Defer, not MEL, airworthiness-related ► DDLS (engineer places it)
   ├── Defer as NADD (convenience) ► NADDS
   ├── Rectify now ───────────────► Work order (D-063)
   └── No fault found
```

---

## 2. Fields (from the operator's sheet pattern)

**Header:** Aircraft type, Registration, DDLS page number.

**Opening an entry** (all required, D-164):

| Field | Notes |
|---|---|
| TLB Book No, TLB Page No, TLB Item No | Paper technical log reference |
| MEL category (A, B, C, D) and MEL Ref | Filled in from the loaded MEL for MEL items (D-058); blank for non-MEL DDLS items |
| Days allowed | From the MEL category for MEL items; entered by the engineer with a manual reference for non-MEL items |
| Pilot report or maintenance entry | Text of the defect |
| (M) and (O) procedures | Flags; the not-required one is shown as "N/A" |
| Name and signature | Engineer deferring (PIN = signature, D-094) |
| Defer date | |
| Rectification due date | Defer date + days allowed (arithmetic on human-set figures, D-054). Hours or cycles limits for Cat A are shown in their own units |

**Extension** (separate approval, D-056): reference, extension due date, name, signature. **Only for the categories the operator allows** (PAF: B, C and D; never A). For Cat A, the extension button does not exist.

**Clearing an entry:** rectification actions, rectification date, TLB book / page of the rectification, name and signature.

**Rule carried over from the sheet:** opening a deferral needs a CRS on the TLB page. In Nexus, that is the certifying engineer's signature with PIN on the deferral (D-043, D-104), and the TLB page reference is recorded.

---

## 3. States

| # | State | Holder |
|---|---|---|
| DD-1 | Open – countdown running | Engineering |
| DD-2 | Extension requested | Approver (D-078) |
| DD-3 | Approaching (inside the operator margin, D-028) | Engineering |
| DD-4 | Expired (D-057 pattern: alerts, tail shows "Limit exceeded"; the system does not ground the aircraft) | Engineering |
| DD-5 | Cleared | — |

**Page closure:** when every entry on a DDLS page is cleared, the page shows "Page closed". The operator's instruction to return completed pages to the CAMO department becomes a notification to the configured CAMO role.

---

## 4. Print

- The DDLS prints per tail, page by page, in the operator's layout (configurable template, D-049 pattern).
- Every print carries "Printed from Nexus MRO · date · by [name] · version · uncontrolled when printed".
- The operator uploads its own crest and form number. Liebetag ships no operator branding (D-113).

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| A defect that belongs on the DDLS is logged as a NADD to get a longer limit | Certifying engineer's "not covered by MEL, no airworthiness effect" declaration (D-160); Quality review report of NADDs |
| Non-MEL DDLS items given an arbitrary number of days | Days allowed must carry a manual reference (AMM, SRM, etc.) |
| Paper DDLS and Nexus disagree | Electronic record is the master; TLB references link the two |
