# Flight and crew scheduling (provision only)

**Status:** Provisioned as "Coming soon" (D-017). Built in Phases 5 and 6 (D-013). This file records the pattern so the v1 data model leaves room for it.

**Source:** structure only, taken from an operator flight order and mission list shared on 8 Oct 2026. **No content from those documents is recorded here or anywhere in the project.** The documents themselves are not stored in Git (D-112).

---

## 1. Mission list (Operations)

A dated list of upcoming missions, each with: date, mission (principal or purpose), route, and time (local, UTC or "TBN"). Kept up to date by the Operations department.

## 2. Flight order (one per mission)

| Block | Fields |
|---|---|
| Header | Order number (operator sequence), date of order, departure date and time |
| Aircraft | Aircraft type, aircraft registration (from the aircraft register, D-015) |
| Routing | Destination(s), route, foreign clearance reference |
| Crew | Rank, name, duty (e.g. captain, pilot, engineer, cabin crew), remarks; one row per crew member |
| Task | Mission description |
| Return | Return point, date of return, mission class (operator-defined codes) |
| Instructions | Special instructions for the captain's compliance, number of passengers |
| Authorisation | Issuing officer: rank, name, unit, signature, date, unit stamp; "prepared by" |
| Marking | Security classification line (operator-configured) |

## 3. How it will connect to the rest of Nexus

- **Aircraft:** the order can pick only tails that Engineering shows as available. It reads the status, who set it and expected return to service (D-045 to D-047). It **never changes** a tail status (D-046).
- **Crew:** the crew list draws on the shared person record and qualifications (D-085). Crew validity checks come with Phase 5.
- **Deferred items:** the captain sees the tail's open DDLS and NADD items with their (O) procedures before departure.

## 4. Proposal: classification handling (open item O-14)

Flight orders and mission lists name principals and movements. They are classified.

| Proposal | Why |
|---|---|
| Scheduling data is hosted **on-premise only**, never on a cloud or Liebetag server | Data sovereignty (D-005, D-101) and the operator's secrecy obligations |
| **Need-to-know access**: a separate permission per user, not granted by department alone (D-121) | Most maintenance staff do not need movement data |
| **Full audit** of every view, print and download | Leak investigation |
| Development and demos use **invented** principals, routes and crews only | D-112 |
| Classification marking printed on every page | Matches the operator's documents |
