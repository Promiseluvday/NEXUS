# Fleet Board: Design Review (v1 → v2)

**Reviewed:** `Nexus MRO.html` (v1, Claude Design export, project root), 5 October 2026
**Output:** `fleet-board-v2.html`, `data-contract.md`, `sample-fleet-board.json`, PNG renders, all in `design/fleet-board/`
**Status:** v2 is a reference design for the builder. v1 is left untouched.

## Findings and fixes

| # | v1 issue | Risk | v2 fix | Basis |
|---|---|---|---|---|
| 1 | NX-203 shown **Unserviceable** while its snag was still "awaiting engineer assessment" | System makes an airworthiness call; soft pilot observations ground aircraft | Status stays at the last engineer-set value; amber "Unassessed report · check before dispatch" flag; tail sorted near the top | D-020, D-041, **P-FB-2** |
| 2 | No record of **who set a status, or when** | Badge reads as the system's judgment; weak audit position | "Status set by [name] · [time]" on every card, desktop and mobile | D-020, D-024, **P-FB-1** |
| 3 | NX-101 blocker holder shown as **Procurement**, but Needs-attention said **Command (CO)** | Wrong department chased; "Blocked by" loses credibility | Holder follows the item's actual state: "Command · CO, step 3 of 3" | D-006, part-request RQ-2 |
| 4 | Mobile listed **4 of 6** tails | Offline engineer sees an incomplete fleet | All tails listed, worst first | D-094 |
| 5 | Offline held times looked **live** | Stale reservations and ages trusted | "as at 08:42" stamp; times frozen at snapshot; "queued, not sent" wording | D-102, D-103, R-7 |
| 6 | **Tile vs chip mismatch** (4 deferrals vs 3 aircraft) | Looks like a data error | Tiles say "Aircraft …"; MEL tile adds "4 deferrals in total"; chip renamed "Aircraft with MEL" | — |
| 7 | **Labels differ** between desktop and mobile with no common source | Inconsistent vocabulary; hard-coded words | One configurable label set with long and short forms | D-025, O-7 |
| 8 | **"In check"** colour not covered by D-091 | Colour meaning drifts screen to screen | Blue (information), proposed for logging | **P-FB-4** |
| 9 | Some **tap targets under 44 px** | Gloved or one-handed misses | Chips, nav, tiles, buttons, tabs all ≥ 44 px (checked by script) | D-093 |
| 10 | Hours as **whole numbers** | Loses minutes; format varies by operator | Stored as integer minutes, shown hh:mm, format is a setting | D-022, D-025 |
| 11 | No rule for **which** item is "the" blocker | System would implicitly choose what blocks release | Engineer marks blocking items; board shows the longest-held plus "+N more" | D-006, D-020, **P-FB-3** |

## Still open (Promise)

- **O-7:** actual PAF status wording. The v2 labels are defaults only.
- **P-FB-1 to P-FB-4:** approve, change or reject; then log in DECISIONS.md.
- **Root file:** `Nexus MRO.html` should be moved into `design/fleet-board/` as `fleet-board-v1.html` (git mv, by Promise or Claude Code) so v1 and v2 sit together.
- **Claude Design:** if v2 is approved, ask Claude Design to restyle from `fleet-board-v2.html` and the data contract, keeping the same data fields.
