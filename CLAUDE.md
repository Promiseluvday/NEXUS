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

## Current position (update as work progresses)
- Design phase. Fleet board designed (desktop + mobile).
- Part request workflow (O-8) drafted in `workflows/part-request.md`; awaiting answers to Q-1 to Q-10.
- Next: answer O-8 questions and log decisions, then design the Aircraft page (O-9).
- Six-month target: Phase 0 (foundations) + Phase 1 (snag workflow end to end).
