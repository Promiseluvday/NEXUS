# Fleet Board: Data Contract (v2)

**Status:** DRAFT for Promise's review. Items marked **PROPOSAL** are not decisions until logged in `docs/DECISIONS.md`.
**Screens:** `design/fleet-board/fleet-board-v2.html` (desktop + mobile)
**Sample payload:** `design/fleet-board/sample-fleet-board.json` (fictional, D-112)
**Builds on:** D-006, D-020 to D-025, D-054, D-062, D-071, D-077, D-091 to D-094, D-102 to D-105

---

## 1. What this file is for

The fleet board is a **read-only screen**. It only displays what people have recorded. This file defines exactly what the backend sends so the screen can be built without guessing, and so the screen can never show something the system "decided" (D-020).

Plain-English rule for the builder: **every word and number on the board must trace back to a record made by a named person, or to simple arithmetic on such records.**

---

## 2. Where the data comes from

| Board element | Source record (append-only, D-023) | Who creates it | System does |
|---|---|---|---|
| Tail status (AOG, U/S, In check, SVC · MEL, SVC) | `tail_status_event` (latest row per tail) | Certifying engineer, or engineer for "In check" | Displays latest event. **Never derives status** |
| "Status set by … · time" | Same row: `set_by`, `set_at` (server time) | — | Displays |
| "Blocked by" | Open items with `blocks_release = true` (snag, part request, check finding) | Engineer marks the item as blocking (**PROPOSAL P-FB-3**) | Shows the longest-held one, plus "+N more" |
| Holder department and role | The blocking item's current state holder (e.g. part-request state RQ-2 → approver role at that step) | Workflow state | Displays |
| "Holding for 2d 4h" | Blocking item's `held_since` (server time of entering current state) | — | `server_time − held_since`, calculated in the browser, never stored |
| Unassessed report flag | Snag in state "Open – Reported" not yet dispositioned (D-040, D-042) | Pilot | Displays a flag. **Does not change tail status** (**PROPOSAL P-FB-2**) |
| Hours / cycles / landings | Sum of `flight_record` rows (D-022) | Engineers / crew | Sum only. Hours stored as **integer minutes** |
| Open snags, open MEL | Count of open rows | — | Count only |
| MEL next expiry | `mel_deferral.expires_at` (from the loaded MEL interval, D-052, D-055) | Engineer raises; interval from MEL | Shows time remaining (D-054) |
| Check progress | `task_card` statuses in the package | Engineers | "X of Y tasks completed" (D-062). Never a percentage label |
| Needs attention | Rules over the above (expiries, items held past target) | — | Lists. Owner = department that holds the item |
| Cost | — | — | **Never in this payload** (D-077) |

---

## 3. Payload shape

One call returns the whole board. Suggested implementation: a Postgres view or RPC (`fleet_board()`), protected by row-level security, plus realtime subscriptions on the source tables to refresh it.

```
FleetBoard {
  server_time        ISO-8601, authoritative clock (D-024)
  operator_settings {
    hours_format         "hh:mm" | "decimal"                     (D-025)
    pilot_report_effect  "flag_only" | "hold_pending_assessment" (PROPOSAL P-FB-2)
    status_labels        { CODE: { long, short, tone } }         (D-025, O-7)
  }
  summary {                         all counts are AIRCRAFT unless the name says otherwise
    tails_total, tails_serviceable, tails_down, tails_in_check,
    tails_with_mel, mel_deferrals_open, tails_with_unassessed_report
  }
  tails[] {
    tail_id, registration, type_code, type_name
    status    { code, set_by { name, role }, set_at, status_event_id }
    blockers[] { kind, ref, summary, holder_dept, holder_role?, held_since }   sorted oldest first
    flags[]    { kind, ref, summary, holder_dept, held_since }
    totals     { airframe_minutes, cycles, landings, as_of_flight_record }
    open_snags, open_mel
    mel_next   { ref, category, expires_at, mel_revision } | null
    check      { package_ref, name, tasks_done, tasks_total } | null
  }
  attention[] { tone, tag, scope, text, owner, ref }
  viewer      { name, dept, privileges[] }
}
```

**Status codes** are fixed in code; **labels and tones** come from `operator_settings` so each operator can use its own words (open item O-7). Desktop shows `long`, mobile shows `short`.

| Code | Default long / short | Tone (D-091) |
|---|---|---|
| `AOG` | AOG / AOG | red |
| `US` | Unserviceable / U/S | red |
| `CHECK` | In check / In check | blue (**PROPOSAL P-FB-4**) |
| `SVC_MEL` | Serviceable · MEL / SVC · MEL | amber |
| `SVC` | Serviceable / SVC | green |

---

## 4. Rules the backend must keep

1. **Summary must equal the tails.** Each summary count must match a count over `tails[]`. The sample screen checks this and logs an error if they differ. Build a test for it.
2. **Status is never written by a trigger or a job.** Only a user action, with PIN re-entry, creates a `tail_status_event` (D-094, D-104).
3. **Times are server times.** `held_since`, `set_at` and `expires_at` are all server time. The browser only subtracts.
4. **Hours stored as integer minutes.** Display format is a setting. No floating-point hours in the database.
5. **No cost fields** in this payload, ever. Cost lives behind separate permissions (D-077).
6. **No deletes.** A cleared blocker is a state change on its own record. The board simply stops listing it.

---

## 5. Offline behaviour (D-102, D-103)

| Item | Behaviour |
|---|---|
| Cache | Last full payload saved in IndexedDB with its `server_time` as the **snapshot time** |
| Banner | "Offline · N items queued, not sent · showing data as at HH:MM" |
| Held times | Calculated against the **snapshot time**, shown as "2d 2h at 08:42". They do not tick on as if live |
| Counts | Shown from the snapshot. Never adjusted locally from queued actions |
| Queued items | Snags reported offline appear only in the queue, labelled "queued, not sent", until the server accepts them (same idea as R-7 in the part-request workflow) |

---

## 6. Realtime refresh

Subscribe to changes on: `tail_status_event`, `snag`, `part_request`, `requisition`, `mel_deferral`, `task_card`, `flight_record`. On any change, re-fetch `fleet_board()` (simple and correct at fleet sizes of 6–50 aircraft). Optimise later only if needed.

---

## 7. Proposals raised by this contract

| ID | Proposal | Why |
|---|---|---|
| **P-FB-1** | Every tail status is a `tail_status_event` with set-by, server time and optional linked item. The board shows "Status set by [name] · [time]" on every card | D-020: the badge must read as a person's recorded call, not the system's opinion. Supports D-024 and the AC 120-78A benchmark (D-114) |
| **P-FB-2** | A pilot report that has not been assessed **flags** the tail ("Unassessed report · check before dispatch") and does not change its status. Operators whose procedure grounds on a tech-log entry can set `pilot_report_effect = hold_pending_assessment`, which records a status event attributed to the pilot's entry and the procedure reference | v1 showed NX-203 as Unserviceable before any engineer assessed it, which would be a system airworthiness call (D-020). A soft observation (D-041) must not ground an aircraft by itself |
| **P-FB-3** | The engineer marks which open items block release (`blocks_release`). The board shows the longest-held blocker plus "+N more" | D-006 needs a single blocking item, but choosing what blocks airworthiness is a licensed person's call, not the system's |
| **P-FB-4** | "In check" uses blue | D-091 lists no colour for scheduled checks |

Once approved, these need DECISIONS.md IDs. Section 10 (UI) has room after D-095.
