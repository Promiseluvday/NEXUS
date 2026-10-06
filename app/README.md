# Nexus MRO — application code

Proprietary to Liebetag. All rights reserved.

This folder holds the application. Right now it contains **Phase 0: the backend foundations**: the database, its rules, and automatic checks. There are no screens yet.

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
    │   └── …0009_security.sql        Row-level locks: each user sees only what they may
    ├── seed.sql            Fictional sample data (NX tails, invented people)
    └── tests/
        └── foundations.test.sql      37 automatic checks of the rules
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
npm run db:test      # runs the 37 checks; should end with "Result: PASS"
```

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

- Snags, MEL, DDLS / NADD, work orders, parts, stores transactions (Phase 1 onwards)
- Any screens (the React app)
- Copy of the audit log to a separate machine; PIN lock-out after failed attempts (Phase 4 hardening)
- Aircraft admins created by fleet-level authorities, one level only (D-034)
