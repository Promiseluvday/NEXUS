# Nexus MRO — application code

Proprietary to Liebetag. All rights reserved.

This folder holds the application. Right now it contains the backend only: the database, its rules, and automatic checks. There are no screens yet.

- **Phase 0, foundations:** people, departments, aircraft, stores, access, authorizations, audit
- **Phase 1A, snag workflow backend:** snags, work orders with approvals, MEL, DDLS, NADD, attachments, technical queries, repeat defects, fleet board

One database per operator (agreed 9 Oct 2026): each customer, e.g. PAF, gets its own database on its own server.

---

## What's here

```
app/
├── package.json            Project file: lists the tools and the run commands
├── package-lock.json       Exact tool versions (keeps everyone's set-up identical)
└── supabase/
    ├── config.toml         Settings for running Supabase on your own machine
    ├── migrations/         The database, built up step by step (run in order)
    │   ├── …0001_foundations.sql     No deletes ever; server time is in charge
    │   ├── …0002_audit.sql           Tamper-evident audit log of every change
    │   ├── …0003_settings.sql        Operator settings, versioned
    │   ├── …0004_people.sql          People, 3LC, sign-in accounts, signing PIN
    │   ├── …0005_organisation.sql    Departments, Engineering sections, appointments, deputies
    │   ├── …0006_aircraft_and_stores.sql  Aircraft register, Main and Forward stores
    │   ├── …0007_access.sql          Who may see and do what; no self-granting
    │   ├── …0008_authorizations.sql  Licences, type ratings, certifying authorizations
    │   ├── …0009_security.sql        Row-level locks: each user sees only what they may
    │   ├── …0010_accounts_and_preferences.sql  Username sign-in, account requests, saved screen choices
    │   ├── …0011_approvals_and_numbering.sql   Approval chains (Quality → CO); SNAG-000001 style numbers
    │   ├── …0012_tail_status.sql     SVC / SVC-MEL / U/S / AOG / In check, set by engineers only
    │   ├── …0013_snags.sql           Report, attend, close as no fault found
    │   ├── …0014_attachments.sql     PDF and image uploads, linked to records
    │   ├── …0015_work_orders.sql     Request → Quality → CO → work → scans → certify
    │   ├── …0016_mel.sql             MEL revisions, items, type-ahead search
    │   ├── …0017_ddls.sql            Deferred Defects Log Sheet, extensions, clearing
    │   ├── …0018_nadd.sql            NADDs and cabin items (never emergency equipment)
    │   ├── …0019_queries_and_repeat_defects.sql  Technical queries; repeat-defect alert
    │   ├── …0020_fleet_board.sql     One row per aircraft: status, snag chip, "Blocked by"
    │   └── …0021_api_access.sql      Locks internal helpers; opens only the user actions
    ├── seed.sql            Fictional sample data (NX tails, invented people, sample MEL)
    └── tests/
        ├── foundations.test.sql      37 checks of the Phase 0 rules
        └── phase1.test.sql           90 checks of the snag workflow rules
```

Each migration file starts with a plain-English explanation of what it does and which decisions (D-xxx) it implements.

**Migrations** are the database's building instructions. They run in order, oldest first, and are never edited once shared. A change means a new migration file, the same way Nexus itself corrects records.

---

## The rules the database enforces (not just the screens)

| Rule | Decision | Checked by test |
|---|---|---|
| Nothing is ever deleted, even by an administrator | D-023 | ✅ |
| The server's clock is recorded; a device can't backdate | D-024 | ✅ |
| Every change is written to an audit log that can't be edited; tampering is detected | D-038 | ✅ |
| Nobody grants rights to themselves | D-033 | ✅ |
| Only a Super Admin grants, within their reach (department CO / Commander) | D-035, D-123 | ✅ |
| Quality never gets "View cost"; Command sees cost | D-122, D-127 | ✅ |
| One home department; extra departments allowed | D-124 | ✅ |
| Users see only the aircraft and stores they're granted | D-121, D-152 | ✅ |
| Quality issues certifying authorizations; the CO / ECO approves; never the same person | D-032 | ✅ |
| "May certify" needs a valid authorization, licence and type rating | D-043 | ✅ |
| Aircraft are deactivated with a reason, never deleted | D-015 | ✅ |
| Signing PIN is stored only as a one-way hash | D-094 | ✅ |
| Anonymous visitors get nothing | D-125 | ✅ |

### Phase 1A: the snag workflow

| Rule | Decision | Checked by test |
|---|---|---|
| Only an engineer sets a tail's status; a pilot report alone shows blue "Snag open", amber once attended | D-046, D-200 | ✅ |
| Snags are numbered SNAG-000001 across the fleet; an offline re-send never creates a duplicate | D-213 | ✅ |
| Operations sees only the snags it reported | D-120 | ✅ |
| Signing actions need a certifying authorization for the type **and** the signing PIN | D-043, D-094 | ✅ |
| A work order is locked until Quality, then the CO, approve it | D-063 to D-066 | ✅ |
| Whoever raises a request can't approve it; nobody approves two steps; a reject needs a reason | D-075, D-146 | ✅ |
| A work order can't be certified until the sign-off card scan is uploaded (the list is a setting) | D-064, D-025 | ✅ |
| Uploads are PDF or images only, max 20 MB, and only on records you can see | D-026 | ✅ |
| One active MEL revision per type; items can't change after activation | D-050 to D-058 | ✅ |
| MEL deferrals log to the DDLS automatically; due time ends 23:59 local on the last day | D-163, D-164 | ✅ |
| Category A MEL items can't be extended; extensions need Quality approval | D-163 | ✅ |
| Emergency equipment is never a NADD; a NADD limit is never longer than 120 days | D-160, D-209 | ✅ |
| Technical queries never change the record; only the raiser closes one | D-207 | ✅ |
| Repeat defect (3 in 30 days, same ATA sub-chapter) is an alert only | D-208, D-020 | ✅ |
| Internal helper functions can't be called from outside | D-125 | ✅ |

Nothing here calculates airworthiness or next-due maintenance (D-020, D-021). Due times shown are the limits the engineer entered or the MEL states, counted as recorded.

---

## Running it on your PC (Windows)

You need, once:
1. **Node.js** (LTS version) from nodejs.org
2. **Docker Desktop** from docker.com (free). Start it and leave it running.

Then, in PowerShell:

```
cd C:\Users\USER\Downloads\NEXUS\app
npm install          # downloads the Supabase tool (first time only)
npm run db:start     # starts the database (first time downloads ~2 GB; later it's quick)
npm run db:test      # runs all 127 checks; should end with "Result: PASS"
```

If you already had the database running from Phase 0, run `npm run db:stop`, then `npm run db:start` (it now also starts file storage for uploads), then `npm run db:reset` to load the new migrations and sample data.

Other commands:

| Command | What it does |
|---|---|
| `npm run db:reset` | Wipes your **local** database and rebuilds it from the migrations and sample data |
| `npm run db:status` | Shows the local addresses and keys |
| `npm run db:stop` | Stops the database (your data is kept until the next reset) |

**Local sign-in for testing:** any sample email in `supabase/seed.sql` (e.g. `kdo@nexus.test`), password `nexus-dev-only`. These exist only on your machine.

**Keys:** `npm run db:status` prints local keys. They are the standard demo keys Supabase uses for every local install, not secrets. Real keys for a real server go in a `.env` file, which Git ignores. **Never commit them.**

---

## Not built yet

- Any screens (the React app): Phase 1B
- Offline store and sync queue on the device: Phase 1C
- Parts, stores transactions, procurement (later phases)
- Flight and crew scheduling (after Phase 1, D-205)
- Copy of the audit log to a separate machine; PIN lock-out after failed attempts (Phase 4 hardening)
- Aircraft admins created by fleet-level authorities, one level only (D-034)
