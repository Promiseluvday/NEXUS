# Nexus MRO — Project instructions for Claude

## What this project is
Nexus MRO is an aircraft maintenance and operations platform built by **Liebetag**.
It connects four departments — **Engineering, Supply, Procurement, Operations** — with
Command and Quality approving and auditing across them. First target customer: 011 PAF.

All agreed decisions are in `docs/DECISIONS.md`. Read it at the start of every session.
Refer to decisions by ID (e.g. D-043). Never contradict a decision silently: if a change
is needed, propose it, and on approval add a new entry that supersedes the old one.

## Who you're working with
Promise is an aircraft technician (AMEL holder) with deep aviation knowledge and little
coding experience. Explain what each piece of code does and why. Prefer simple,
mainstream, well-documented solutions over clever ones. Ask before large structural changes.

## Non-negotiable rules
1. **Nexus records; licensed people decide.** Never write logic that makes an
   airworthiness determination or calculates next-due maintenance (D-020, D-021).
2. **Append-only.** No hard deletes anywhere. Corrections create new versions;
   soft deletes record who and when (D-023).
3. **Fictional data only.** Use sample tails (NX-101 etc.) and invented part numbers.
   Never use, request or commit real PAF or OEM data (D-112).
4. **Never commit secrets.** `.env` files, API keys and database credentials stay out
   of Git. Check `.gitignore` before every commit.
5. **Configure, don't hard-code** anything that differs between operators (D-025).
6. **Uploads are PDF and images only** (D-026).
7. The code is **proprietary to Liebetag**. Don't copy code, screens or text from
   AMOS or other commercial MRO systems (D-113).

## Stack
- React Progressive Web App (one codebase for phone, tablet, desktop)
- Supabase / PostgreSQL with row-level security, self-hostable
- IndexedDB offline store with sync queue
- Theme: "Hangar-grade" — IBM Plex Sans / IBM Plex Mono, navy and teal, status colours for meaning only (D-090 to D-094)

## Folder layout
- `docs/` — decisions log, specs, workflow write-ups
- `design/` — screen designs and exports
- `workflows/` — workflow maps
- `data-samples/` — fictional sample data only
- `legal-ip/` — ownership and development records
- `pitch/` — customer and regulator material
- `app/` — the application code

## Git habits
- Commit in small, meaningful steps with clear messages.
- Push at the end of every working session.
- Never force-push or rewrite history.
- **Work on `main` only.** Promise works locally in `C:\Users\USER\Downloads\NEXUS`; GitHub `main` is the shared copy. Pull before starting, push at the end. Do not create session branches, even if a session is set up with one.

## Your lane
You are the BUILDER. You own app/ and Git.
- Only change files the task names, or files inside app/ needed for that task.
- Never edit docs/DECISIONS.md, design/, pitch/ or legal-ip/ unless told to.
- Never add a new library or service without asking first.
- Show a plan and wait for approval before changing more than 3 files.
- Commit and push at the end of each approved task. Never force-push.
- When finished, list every file you changed.

## Current position (update as work progresses)
- Design phase. Canvas (9 Oct): 139 artboards; Prompts 1-8 done and reviewed. Full inventory and open items: `docs/design-status.md`. Next: Prompt 9 (housekeeping).
- Decisions logged 6 Oct: D-015, D-016, D-027, D-028, D-045 to D-047, D-078, D-079, D-096, D-120 to D-126 (departments and per-user access: department, permissions, aircraft scope). Detail in `docs/department-views.md`.
- Design prompts for wireframe, home page and department views: `docs/design-prompts.md`.
- 7 Oct: NADD agreed (D-048, D-049), workflow in `workflows/nadd.md`, open questions O-10. Quality has no cost access (D-127). No cannibalisation (D-140).
- 7 Oct (later): work orders need Quality + CO approval (D-063 to D-066, `workflows/work-order.md`), CRS compiled but signed by certifying engineer, two stores (D-141, D-142), part requests without snag (D-143), Procurement outside-MRO oversight (D-144), MEL type-ahead (D-058), printable histories (D-097), navigation rules (D-098).
- Flight and crew scheduling provisioned as "Coming soon" with hide switches; data model kept ready (D-017). Built in Phases 5–6.
- 8 Oct: O-8, O-10, O-11, O-12 closed with Claude's recommendations (D-067 to D-069, D-145 to D-151, D-160 to D-165). HIL renamed DDLS; MEL deferrals auto-log to it (`workflows/ddls.md`). NADDS layout and 3LC logged. Scheduling pattern in `workflows/scheduling.md` (structure only; operator documents are classified and never stored).
- 8 Oct (later): NADDs never block A-check, 30-day months (D-166); store access per user (D-152); release documents mandatory at receipt (D-153); Engineering workshops Tire Bay, Battery Workshop, AGE (D-018).
- Open: O-14 (scheduling data classification), O-15 (workshop records and workflows).
- Workshops raise own WOs with Quality + CO approval; fleet tire/battery requests issued after WO approval (D-019, `workflows/workshops.md`).
- Canvas proposals awaiting decision: O-16 (aircraft dropdown, amends D-096), O-17 (flight scheduling drafts, P9), O-18 (daily serviceability print, P10). Fleet board v2 reference design in `design/fleet-board/` with proposals P-FB-1 to P-FB-4 (O-19).
- 9 Oct: design round 2 logged (D-200 to D-214); O-16 to O-19 closed; O-20 open (scheduling questions).
- Backend: Phase 0 done (migrations 0001–0009, 37 tests). Phase 1A done (0010–0021: accounts, approvals, tail status, snags, attachments, work orders, MEL, DDLS, NADD, queries, repeat defects, fleet board, API lock-down; 90 tests). See `app/README.md`.
- 8 Oct: Phase 1B libraries approved (React, Vite, TypeScript, supabase-js, Dexie, vite-plugin-pwa, react-router, @fontsource IBM Plex, Vitest). Username sign-in uses a hidden email `<username>@users.nexus.local`. Slice 1 done: sign in, set PIN, rail, fleet board, aircraft summary, report snag (`npm run dev`).
- 8 Oct (later): UX pass done. Rule: group navigation and actions in dropdowns, never hide status, max two levels (`docs/ui-rules.md`).
- 8 Oct (later): Slice 2 done: snag list and page, attend, five dispositions with PIN, set tail status.
- 9 Oct: Slice 3 done: approvals inbox, work orders (entries, scans, certify), migration 0022. D-215 (tail status needs PIN), D-216 (SVC · MEL tick at deferral) logged. Offline signing proposed as D-217, awaiting Promise.
- 9 Oct (later): D-217 logged (Option A: provisional offline signing on enrolled devices; design `workflows/offline-signing.md`). Slice 4 done: DDLS sheet, NADDs, cabin map, technical queries, DDLS/NADDS prints. Phase 1B complete.
- 9 Oct (later): Q-OS1 to Q-OS3 answered (line tablets only, 72 h, provisional shown). Phase 1C done: migration 0023 (tablets, offline keys, submit_offline_signature, 23 tests), offline cache and send queue (Dexie), provisional offline signing, This tablet / Send queue / Offline signatures screens, installable PWA. Phase 1 (snag workflow end to end) complete.
- Next: Promise tests on PC and a real tablet; then Phase 2 planning (CRS and check packages, parts and stores). Open: offline sign-in for shared tablets (only the signed-in engineer can work offline). Promise runs Prompts 9 and 10 in Claude Design. Open: O-1 to O-7 (O-5 urgent), O-14, O-15, O-20.
- Six-month target: Phase 0 (foundations) + Phase 1 (snag workflow end to end).
