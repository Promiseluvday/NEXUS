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

---

## 5. PROPOSAL P9 — flight request registration, Outstanding missions and the fleet roster (6 Oct 2026)

**Status: PROPOSAL, not a decision.** D-012, D-013 and D-017 still stand (scheduling is "Coming soon" in v1) until Promise accepts or changes this. Drawn on the design canvas as OP2, OP3, OP4 and SCH1, marked "Draft (P9)".

**Source:** Promise's description of how Operations works: flight scheduling covers aircraft and fleet rostering; each flight request is registered and logged in a record called **Outstanding mission**.

### 5.1 Flow

1. **Register flight request** (Operations). Fields: received from (requesting office), date and time received, principal or purpose, departure and return dates, departure time (local, UTC or TBN), route, foreign clearance reference, number of passengers, preferred aircraft type, special instructions, request letter or signal (PDF or image). Registered by is taken from sign-in.
2. On registration the request gets a number from a fleet-wide sequence (drawn as `FR-000031`, never reused) and is **logged in Outstanding missions** with state *Registered*.
3. **Fleet roster** (aircraft by day): Operations assigns an available tail to the mission. Only tails Engineering shows as SVC or SVC · MEL can be assigned; Operations never changes a tail status (D-046). The tail's MEL (O) procedures and open DDLS and NADD items are shown before assigning (section 3). Daily duty slots (drawn as Standby 1 and Standby 2) are operator-configurable.
4. States: Registered → Aircraft assigned → Crew assigned → Flight order issued → Completed. Crew assignment and the flight order (section 2) stay in Phases 5 and 6.
5. A mission leaves Outstanding missions only when Operations marks it **Completed** (flown) or **Cancelled** with a reason. It then moves to Mission history. Nothing is deleted; every change is a version (D-098).

### 5.2 Handling

Same as section 4 (O-14): need-to-know Scheduling permission, full audit of every view, print and download, classification marking on every page, invented principals and routes only in development and demos.

### 5.3 Open questions (also on the canvas)

- **Q-OP1:** Who may register a request, and does it need approval (e.g. Command) before it counts as outstanding? Drawn: Operations registers, no approval step.
- **Q-OP2:** When does a mission leave Outstanding missions: when flown, when the flight order is issued, or when Operations closes it? Drawn: Completed or Cancelled with a reason.
- **Q-OP3:** Are Standby 1 and Standby 2 the right duty slots, and are they per day or per shift? Drawn: per day, configurable.
- **Q-OP4:** Request number format. Drawn: `FR-000031`; use Operations' own format if one exists.
