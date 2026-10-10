# Nexus MRO — application code

Proprietary to Liebetag. All rights reserved.

This folder holds the application: the database with its rules and checks, and the screens (a React app that works on phone, tablet and desktop).

- **Phase 0, foundations:** people, departments, aircraft, stores, access, authorizations, audit
- **Phase 1A, snag workflow backend:** snags, work orders with approvals, MEL, DDLS, NADD, attachments, technical queries, repeat defects, fleet board
- **Phase 1B slice 1, first screens:** sign in with username, set PIN, home rail (departments and aircraft dropdown), fleet board, aircraft summary, report snag
- **Phase 1B slice 2, snag workflow screens:** snag list, snag page (report, history, linked records, repeat-defect alert, similar defects), attend, the five dispositions with PIN signing (work order request, MEL with type-ahead, DDLS, NADD, no fault found), set tail status
- **Phase 1B slice 3, approvals and work orders:** approvals inbox with "Approvals (n)" counter, work order list and page (approval trail, work entries, scan upload and viewing, required scans, work complete, certify), PIN on tail status and approvals, Serviceable · MEL option at deferral, DD Mmm YYYY date picker
- **Phase 1B slice 4, deferrals and queries:** DDLS sheet per tail (clear, extension with approval, Cat A never extendable), NADD list (confirm, reject with reason, reclassify, rectify, extend), cabin item report on a cabin map (emergency zones go to snag), technical queries on snags and work orders plus "Technical queries" list, printable DDLS and NADDS (A4 landscape)
- **Phase 1C, offline:** offline copies of the board, snags, DDLS, NADDs, MEL and cabin zones; a send queue (reports, attends, work entries, photos and scans); provisional offline signing on enrolled line tablets (D-217); "This tablet", "Send queue" and Quality's "Offline signatures" screens; installable app that opens with no signal
- **UX pass:** grouped rail dropdowns, ＋ New and user menus, tail search, online/offline pill, slimmer fleet board. Layout rules in `docs/ui-rules.md`

One database per operator (agreed 9 Oct 2026): each customer, e.g. PAF, gets its own database on its own server.

---

## What's here

```
app/
├── package.json            Project file: lists the tools and the run commands
├── package-lock.json       Exact tool versions (keeps everyone's set-up identical)
├── index.html, vite.config.ts, tsconfig.json   Start-up page and build settings
├── .env.example            Template for .env.local (database address and key; never committed)
├── public/icon.svg         App icon
├── src/                    The screens
│   ├── main.tsx, App.tsx   Start-up; which screen shows for which address
│   ├── theme.css           Colours (D-212), status colours (D-091), fonts, 44 px touch targets
│   ├── lib/                Connection, sign-in, date formats (D-204), perform.ts (online or offline)
│   │   └── offline/        Tablet storage (Dexie), queue, offline signing, clock, cached reads
│   ├── components/         Rail, menus, tail search, status chips, PIN field, MEL search, tail status, date picker, attachments
│   └── screens/            Sign in, PIN, home, fleet board, snags, dispositions, approvals, work orders, DDLS, NADDs, cabin item, queries, prints
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
    │   ├── …0021_api_access.sql      Locks internal helpers; opens only the user actions
    │   ├── …0022_signing_and_inbox.sql  PIN on tail status and approvals; SVC · MEL at deferral; approvals inbox
    │   └── …0023_offline_signing.sql    Tablets, offline keys, checking offline signatures (D-217)
    │   └── …0024_work_order_rule.sql    No work without an approved work order (D-218)
    │   └── …0025_admin_accounts.sql     Users and roles: Super Admin account screens (D-219)
    ├── seed.sql            Fictional sample data (NX tails, invented people, sample MEL)
    └── tests/
        ├── foundations.test.sql      37 checks of the Phase 0 rules
        ├── phase1.test.sql           100 checks of the snag workflow rules
        └── offline.test.sql          23 checks of offline signing
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
| Setting a tail status and approving or rejecting need the PIN | D-215, D-094 | ✅ |
| Deferral can set Serviceable · MEL only when the engineer ticks it, in the same signed step | D-216 | ✅ |
| "Waiting for me" shows only steps the user holds, not their own requests | D-146 | ✅ |

Nothing here calculates airworthiness or next-due maintenance (D-020, D-021). Due times shown are the limits the engineer entered or the MEL states, counted as recorded.

---

## Running it on your PC (Windows)

You need, once:
1. **Node.js** (LTS version) from nodejs.org
2. **Docker Desktop** from docker.com (free). Start it and leave it running.

Then, in PowerShell:

```
cd C:\Users\USER\Downloads\NEXUS\app
npm install          # downloads the tools (first time, and after a pull that adds tools)
npm run db:start     # starts the database (first time downloads ~2 GB; later it's quick)
npm run db:test      # runs all 194 database checks; should end with "Result: PASS"
```

### Trying offline (Phase 1C)

`npm run dev` is for building screens; the offline app shell only works in a **built** copy:
```
npm run build
npm run preview      # opens on http://localhost:4173
```
1. Sign in as `tmb`. Account menu ▸ **This tablet** ▸ register it. Change your PIN to 6 digits there.
2. Sign in as `abe` (another browser window) ▸ This tablet ▸ **Enrol** it.
3. Back as `tmb`: **Switch on offline signing** with the 6-digit PIN.
4. Open the board and a snag (so they are saved), then turn off Wi-Fi (or Chrome DevTools ▸ Network ▸ Offline).
5. Attend, defer under the MEL, set a tail status: each shows **provisional**; the top bar shows "Offline · 3 waiting".
6. Reconnect: the queue sends itself. Quality (`qar`) sees them under **Quality ▸ Offline signatures**.

**On real tablets** offline signing needs the secure **https** address of the Nexus server (browsers only allow the signing maths on https or localhost).

### Opening the screens

Once, create your settings file (with the database running):
```
npm run env:local
```
It writes `.env.local` with the local database address and key. (By hand instead: copy `.env.example` to `.env.local` and paste the anon key from `npm run db:status`.)

Then each time:
```
npm run db:start     # if the database isn't already running
npm run dev          # starts the screens
```
Open **http://localhost:5173** in your browser. Stop with Ctrl+C.

Sign in with a sample **username**: `kdo` (duty engineer, G550s), `pla` (pilot), `qar` (Quality, all aircraft, view only), `tmb` (certifying engineer), `abe` (Engineering CO), `zem` (Commander), `sbk` (storekeeper), `fao` (procurement). Password for all: `nexus-dev-only`. On first sign-in you set a PIN (4 to 8 digits).

To try it on a phone on the same Wi-Fi, use the "Network" address `npm run dev` prints, and put your PC's address instead of `127.0.0.1` in `.env.local`.

Screen checks: `npm run test` (date formats, username rules). `npm run typecheck` checks the code for mistakes. `npm run types` refreshes `src/lib/database.types.ts` after a database change.

If you already had the database running from Phase 0, run `npm run db:stop`, then `npm run db:start` (it now also starts file storage for uploads), then `npm run db:reset` to load the new migrations and sample data.

Other commands:

| Command | What it does |
|---|---|
| `npm run db:reset` | Wipes your **local** database and rebuilds it from the migrations and sample data |
| `npm run db:status` | Shows the local addresses and keys |
| `npm run db:stop` | Stops the database (your data is kept until the next reset) |

**Local sign-in for testing:** the usernames above, or the full sample address (e.g. `kdo@users.nexus.local`). These exist only on your machine.

**Keys:** `npm run db:status` prints local keys. They are the standard demo keys Supabase uses for every local install, not secrets. Real keys for a real server go in a `.env` file, which Git ignores. **Never commit them.**

---

## Not built yet

- Operator crest on prints, print templates per operator, daily serviceability print (D-203)
- Account request and forgotten-password screens (D-206)
- Offline store and sync queue on the device: Phase 1C
- Parts, stores transactions, procurement (later phases)
- Flight and crew scheduling (after Phase 1, D-205)
- Copy of the audit log to a separate machine; PIN lock-out after failed attempts (Phase 4 hardening)
- Aircraft admins created by fleet-level authorities, one level only (D-034)
