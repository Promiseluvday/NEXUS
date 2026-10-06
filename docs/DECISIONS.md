# Nexus MRO — Decisions Log

**Product:** Nexus MRO
**Company:** Liebetag (owner of all IP; product is licensed, never transferred)
**First customer (target):** 011 Presidential Air Fleet (PAF)
**Status:** Design phase, pre-build
**Log started:** 4 October 2026

> Every decision gets an ID. Decisions are never deleted from this log. If one changes, add a new entry that supersedes it and mark the old one `SUPERSEDED by D-xxx`. This file follows the same rule as the product: correct, never erase.

---

## 1. Product and positioning

| ID | Decision |
|---|---|
| D-001 | Product name is **Nexus MRO**. Web check on 4 Oct 2026 found no aviation software using it. Trademark registry and domain checks still pending (see Open items). |
| D-002 | Company is **Liebetag**. Product and company names are kept separate. |
| D-003 | Rejected names: FleetLink (Boeing uses "Fleet Link"), AeroLink, AeroThread, FleetWeave (all in use), LiebeLink (reads as "love link"). |
| D-004 | Nexus MRO is **not positioned as an AMOS competitor**. Positioning: the affordable, data-sovereign, offline-first, right-sized platform for operators that large MRO suites price out. |
| D-005 | Defensible edges, ranked: (1) data sovereignty / on-premise hosting, (2) price, (3) true offline-first, (4) fit to local and military approval chains, (5) built by a working engineer. |
| D-006 | Signature feature: the **live "Blocked by" view**. Every unserviceable aircraft shows its single blocking item, the department holding it, and how long it has been held. |

## 2. Scope

| ID | Decision |
|---|---|
| D-010 | Nexus interconnects four departments: **Engineering, Supply, Procurement, Operations**. Command and Quality sit across all four, approving and auditing. |
| D-011 | *(Extended by D-016 and D-048.)* In scope for v1: snags, work orders, check packages and task cards, MEL deferrals, aircraft hours/cycles/landings, component tracking by position, stores and inventory, part requests, approval chains, procurement with cost and invoice history, document attachments, fleet serviceability dashboard, notifications, audit trail. |
| D-012 | Out of scope for v1: automatic maintenance forecasting from the AMP/MPD, financial/ERP functions, flight scheduling, crew rostering. |
| D-013 | Later Operations modules (after v1): crew qualifications and expiry tracking (Phase 5), then flight scheduling linked to aircraft serviceability and crew validity (Phase 6). |
| D-014 | Initial aircraft types for development: **Airbus A330-200** and **Gulfstream G550**. Framework stays aircraft-agnostic. |
| D-015 | **The aircraft register is controlled by the operator's Super Admins** (D-035). They add aircraft and enter the tail number. Aircraft are **deactivated, never deleted**; deactivation needs a reason and PIN re-entry, no second approval, and is logged with who and when. *(6 Oct 2026)* |
| D-016 | **ADs and SBs are in v1** as engineer-entered compliance records: applicability, compliance method, status and any next-due figure are entered by an engineer; **Quality verifies each entry** (countersign with PIN). The system never decides applicability or calculates due. Extends D-011. *(6 Oct 2026)* |

## 3. Core principles

| ID | Decision |
|---|---|
| D-020 | **Nexus records; licensed people decide.** The system never makes an airworthiness determination. |
| D-021 | Next-due figures are **entered by engineers**, never calculated by the system. The system displays them and flags approach. |
| D-022 | Aircraft totals (hours, cycles, landings) are the **sum of human-entered flight records**. Arithmetic on human input only. |
| D-023 | **Append-only records.** Corrections create a new version; history is kept. Any deletion is a soft delete stamped with who and when. |
| D-024 | Every entry is tied to a named user, with both **device time and server time**. Server time is authoritative. |
| D-025 | **Configure, don't hard-code.** Anything that differs between operators is a setting: qualification requirements, approval chain steps, MEL counting conventions, duplicate-inspection categories, appointment titles. |
| D-026 | Work pack and document uploads are **PDF and images only**. Executable files are never accepted. |
| D-027 | **Flight records are entered by Pilots and Engineering.** Every entry carries the person's name. Engineering corrects an entry by creating a new version with a reason; the original stays in history. *(6 Oct 2026)* |
| D-028 | The "flags approach" in D-021 uses a **margin configured per operator**: amber "Approaching" inside the margin, red "Reached" at the entered figure. No projections. *(6 Oct 2026)* |

## 4. Accounts, roles and privileges

| ID | Decision |
|---|---|
| D-030 | Accounts are **deactivated, never deleted**. Records remain attached to the person's name and licence. |
| D-031 | Engineers have either **full control** or **ordinary access**. **Certifying** is a privilege layered on any role, not a role in itself. |
| D-032 | **Authorization vs assignment.** Quality *issues* certifying authorizations (with authorization reference, scope by aircraft type, expiry) and the **CO or ECO approves**. Fleet-level authorities and aircraft admins *assign* certifiers, choosing only from engineers who already hold a valid authorization. |
| D-033 | **Nobody can grant privileges to themselves.** Every grant, change and revocation is logged with who, to whom, what and why. |
| D-034 | Delegation stops at one level: fleet-level authorities create aircraft admins; aircraft admins cannot create other admins. |
| D-035 | **Super admins:** the CO of each department for that department; the person holding the CO appointment is super admin for Engineering; the Commander/CEO is super admin across all. |
| D-036 | Super admin privileges attach to the **appointment, not the person**. Handover is logged. Each super admin has a designated deputy with time-limited acting authority. |
| D-037 | Super admin authority covers accounts and visibility, **not technical authority**. The Commander/CEO cannot certify work or issue certifying authorizations. |
| D-038 | **IT personnel** get technical access only, no business privileges. Append-only is enforced at the database level. The audit log is copied to a separate tamper-evident (hash-chained) store. Emergency database access requires approval from the Engineering CO or Quality and is logged. |
| D-039 | Tasks flagged for **duplicate or independent inspection**: the person who did the work cannot be the second signatory. Enforced by the system. |

## 5. Snag workflow

| ID | Decision |
|---|---|
| D-040 | Lifecycle: Pilot reports (Open – Reported) → Engineer assesses (Under Assessment) → **Rectify now / Defer under MEL / No fault found** → Certifying engineer signs → Closed, tail status updated. |
| D-041 | Pilots log snags after the tech-log entry, including **soft observations** they want checked. |
| D-042 | **A pilot cannot close any entry.** Every entry, including soft observations and no-fault-found, is dispositioned by an engineer. |
| D-043 | Only users holding a valid **Certifying** privilege, in scope for that aircraft type, can close an item. Certification checks the company authorization, licence and type rating. |
| D-044 | Findings during a check are raised as **non-routine cards** inside the package and enter the snag workflow. A check cannot close while its findings are open. |
| D-045 | **A pilot report alone shows "Snag open"** on the tail, not U/S or AOG. The tail keeps its last engineer-set status, shown as "Last status: … set by [name] · time", until an engineer changes it. Operations counts "Snag open" separately, never as "not available". *(6 Oct 2026)* |
| D-046 | **Only an engineer sets a tail status** (U/S, AOG, SVC, SVC · MEL, In check). Every status shows **who set it and when**. *(6 Oct 2026)* |
| D-047 | **Expected return to service** is an estimate entered by Engineering (duty or certifying engineer) with name and time, never calculated. Visible to all departments. *(6 Oct 2026)* |
| D-048 | **Non-Airworthiness Deferred Defects (NADD)** are in v1. Engineers and pilots can log them. Each NADD has a countdown, **120 days by default or as the operator defines** (D-025), and NADDs are listed per aircraft by time remaining. A NADD does not change the tail status. Workflow: `workflows/nadd.md`. Extends D-011. *(7 Oct 2026)* |
| D-049 | NADDs can be **printed**. Nexus emulates the operator's **Non-Airworthiness Deferred Defects Sheet (NADDS)** through a configurable print template. Every print is marked with who printed it, when, the record version, and "uncontrolled when printed". *(7 Oct 2026)* |

## 6. MEL

| ID | Decision |
|---|---|
| D-050 | Each aircraft's **approved MEL is loaded** into the system, with revision number, approval date and who loaded it. Only Quality or Technical Records can load a revision. |
| D-051 | Each deferral records the **MEL revision** it was raised under. |
| D-052 | Category and interval come **from the loaded MEL**, not the engineer. Category A limits may be in flight hours, cycles or calendar days; all three are supported. |
| D-053 | Deferral prompts: remarks, duration, category, plus confirmation that the **(M) procedure is done, the (O) procedure is passed to Operations, and the placard is fitted**. |
| D-054 | Once deferred, the **countdown starts** and is visible to all with access. |
| D-055 | Counting convention (day of discovery, expiry time zone) is **configurable** to match the operator's approved procedure. |
| D-056 | Extensions require a **separate approval** with an authority reference. Never an edit to the original deferral. |
| D-057 | On expiry: the item turns red, alerts escalate to Engineering, Quality and Operations, and the tail shows "MEL limit exceeded". The system does not ground the aircraft itself; the certifying engineer decides, and the record shows they were warned. |

## 7. Checks and packages

| ID | Decision |
|---|---|
| D-060 | Engineers can add **maintenance check packages** per aircraft: check type, engineer-entered due figure, uploaded work pack (PDF), and a list of task cards. |
| D-061 | Each task card has its own status (not started, in progress, done, certified), assigned engineer, and duplicate-inspection flag. |
| D-062 | Progress is shown as **"X of Y tasks completed"**, not as a percentage labelled "progress". Weighting by man-hours may come later. |

## 8. Supply and procurement

| ID | Decision |
|---|---|
| D-070 | Engineers can **search stores** and see live availability and quantity before walking to the store. |
| D-071 | Stock updates in real time on every issue, receipt and return. A part is **reserved** the moment it is requested, so two engineers cannot claim the last unit. |
| D-072 | Parts carry **certificate status, shelf life and expiry**. Expired or uncertified parts are clearly flagged. |
| D-073 | Handoffs: Engineering requests → Supply issues from stock, or raises a requisition → Procurement runs approval and PO → Supply receives, inspects, stocks → Engineering notified. |
| D-074 | **Only Supply can mark a part available**, after receiving inspection. Procurement cannot. |
| D-075 | **Separation of duties:** the requester cannot approve the purchase; the buyer cannot receive it into stock. |
| D-076 | Approval chain is multi-level (e.g. storekeeper → supply director → commander), with status visible to all concerned. The chain's steps are configurable per operator. |
| D-077 | *(Refined by D-121, D-122 and D-127.)* Purchase cost and invoice are attached to each purchase, giving **price history**. Cost data sits behind stricter permissions (Supply, Procurement, Command). |
| D-078 | **Changing an approval chain** is itself approved: Quality proposes, the CO approves. Logged and versioned like D-083. The approver for MEL extensions is set in the approval chain set-up. *(6 Oct 2026)* |
| D-079 | **Rejecting any approval requires a reason.** The record returns to the person who submitted it, shown as "Rejected" with the reason. Resubmitting creates a new version. *(6 Oct 2026)* |
| D-140 | **No cannibalisation (robbery).** PAF does not rob parts from one aircraft to fit another, so Nexus has no robbery flow. Parts come only from stores or purchase. (Section 8 continues at D-140 because D-070 to D-079 are used.) *(7 Oct 2026)* |

## 9. Qualifications

| ID | Decision |
|---|---|
| D-080 | All crew, engineers included, have **licence, type rating and medical** fields, each with issue date, expiry and issuing authority. |
| D-081 | A **requirements matrix** per operator and role decides which qualifications are mandatory. |
| D-082 | **PAF configuration:** medical required for flying crew; **not required for engineers**. Must remain switchable for future operators that require it. |
| D-083 | Requirement changes: Quality proposes, CO or ECO approves; versioned and logged with authority reference; **never retroactive**; turning a requirement on uses a grace window, not an instant block. |
| D-084 | Medical data is limited to **class and expiry date**. No diagnoses or limitation details are stored. |
| D-085 | One shared **person record** across departments, with a separate qualifications table, so the Phase 5 crew module reuses the engineer engine. |

## 10. UI and UX

| ID | Decision |
|---|---|
| D-090 | Theme: **"Hangar-grade"**. Deep navy primary, teal accent for actions, light and dark modes (dark default on mobile). |
| D-091 | Status colours are reserved for meaning only: green serviceable, amber limited/deferred, red unserviceable/AOG, blue information, grey closed. Every status pairs colour with a word. |
| D-092 | Typography: IBM Plex Sans for interface, IBM Plex Mono for tails, part numbers, serials, hours and dates. |
| D-093 | Touch targets minimum 44–48 px for gloved and one-handed use. |
| D-094 | Principles: tail first; three taps to anything routine; status always visible; "what's blocking this?" on every relevant screen; role-based home screens; offline state always visible; signing requires PIN re-entry; history one tap away. |
| D-095 | First screens designed: Fleet board (desktop and mobile). Next: Aircraft page. **Partly SUPERSEDED by D-096.** |
| D-096 | **Home is aircraft-first.** The left rail lists "All aircraft" and each tail. "All aircraft" shows the fleet board; choosing a tail shows that aircraft's dashboard (record, totals, open items with "Blocked by" first, due items as entered, recent activity, 4-week calendar). The Aircraft page (O-9) is this dashboard. Layout is Liebetag's own; no copying of commercial MRO screens (D-113). *(6 Oct 2026)* |

## 11. Architecture

| ID | Decision |
|---|---|
| D-100 | One codebase: **Progressive Web App** (React) for phone, tablet and desktop. |
| D-101 | Backend: **PostgreSQL with Supabase** (auth, row-level security, storage, realtime), **self-hostable** for data sovereignty. |
| D-102 | Offline store on the device (IndexedDB) with a sync queue. |
| D-103 | **Works offline:** reporting snags, updating tasks, recording hours, attaching photos, viewing cached data. |
| D-104 | **Requires online:** certifying, approving, MEL deferral, granting privileges. Each needs a live check of authorization and current item state. |
| D-105 | Conflicts: the server accepts the first valid action; the second user is told the item changed and must review before resubmitting. |
| D-106 | Code lives in `C:\Users\USER\Downloads\NEXUS` (not OneDrive-synced), backed up to the private GitHub repository `Promiseluvday/NEXUS`. |

## 12. Legal and IP

| ID | Decision |
|---|---|
| D-110 | Built on **own time, own equipment, own resources**. Dated Git commits serve as development record. |
| D-111 | Nexus MRO is copyrighted to Liebetag. PAF buys a **licence to use**; IP, source code and resale rights stay with Liebetag, stated explicitly in the contract. |
| D-112 | The product ships as an **empty framework**. Customers load their own licensed OEM data (AMM, MPD, IPC, MEL). Development uses **fictional sample data only**, never real or sanitised PAF records. |
| D-113 | Functionality may resemble AMOS-class systems; **no copying** of their code, screens or trade dress. |
| D-114 | NCAA is approached for **acceptance** of Nexus as an electronic maintenance records system, not as a customer. FAA AC 120-78A is the design benchmark for electronic records and signatures. |

## 13. Departments and access

Detail and the per-department table: `docs/department-views.md`.

| ID | Decision |
|---|---|
| D-120 | **Each department has its own fleet board and home view** (Engineering, Operations, Supply, Procurement). Every department sees tail, type, status, who set it, and the "Blocked by" headline with holding department and time held. Detail follows the department view table in `docs/department-views.md`. Refines D-094 "role-based home screens". *(6 Oct 2026)* |
| D-121 | **Access inside a department is granted per user.** Belonging to a department does not grant everything in it. Each user has (a) **permissions** within the department, e.g. "view cost" (not every Supply user sees price), and (b) an **aircraft scope**: the tails they can access. Both are set and changed by a Super Admin and logged (D-033). New permissions are added as the build grows. *(6 Oct 2026)* |
| D-122 | **Partly SUPERSEDED by D-127 (Quality).** **Command and Quality see everything, read-only**, across all departments and aircraft, including cost. Their own approving, issuing and loading actions (D-032, D-050, D-076, D-083) are unchanged. *(6 Oct 2026)* |
| D-123 | **A Super Admin sets a user's department, permissions and aircraft scope** during or after account creation. Users cannot change their own. A self sign-up may request a department; a Super Admin confirms it before the account is active. Every change is logged with who, to whom, from, to and why (D-033). *(6 Oct 2026)* |
| D-124 | **One person can hold more than one department.** One is the home department (default home screen); others are granted explicitly and logged. Separation of duties (D-075) still applies per action. *(6 Oct 2026)* |
| D-125 | **Visibility is enforced in the database** (row-level security, D-101), not only hidden on screen. *(6 Oct 2026)* |
| D-126 | **Audit trail:** full access for Quality, Command and Super Admins. Every other user sees the history of the records they are allowed to see. *(6 Oct 2026)* |
| D-127 | **Quality does not see cost** and has **no default access to Supply or Procurement data**. A Super Admin grants Quality users access to specific Supply or Procurement information as options (D-121). Quality keeps read-only access to Engineering and Operations records and its own actions (D-032, D-050, D-083, D-016). Command still sees everything, including cost. Supersedes D-122 for Quality. *(7 Oct 2026)* |

## 14. Roadmap (part-time, learning while building)

| Phase | Months | Content |
|---|---|---|
| 0 — Foundations | 1–3 | Accounts, roles, privileges, append-only audit trail |
| 1 — Core workflow | 3–6 | Snag lifecycle end to end, attachments. **Six-month target.** |
| 2 — Fleet and work | 6–9 | Hours/cycles/landings, check packages, work orders, fleet board |
| 3 — Supply and approvals | 9–13 | Inventory, reservations, certificates, approval chains, procurement history |
| 4 — Hardening and pilot | 13–15 | Notifications, security review, offline testing, trial on 1–2 tails, expert review |
| 5 — Crew qualifications | After v1 | Reuses the qualifications engine |
| 6 — Flight scheduling | After v1 | Linked to serviceability and crew validity |

---

## Open items

| # | Item | Owner |
|---|---|---|
| O-1 | Nigerian trademark registry check for "Nexus MRO" (software and aviation classes) | Promise |
| O-2 | Domain and social handle check (nexusmro.com / .aero / .ng) | Promise |
| O-3 | Confirm Windows Storage Sense will not clean the Downloads folder | Promise |
| O-4 | Confirm GitHub repository is private | Promise |
| O-5 | Declare the venture through the proper PAF channel before pitching | Promise |
| O-6 | Identify the expert reviewer and involve them from Phase 0 | Promise |
| O-7 | Status label wording on the fleet board (AOG / U/S / SVC · MEL) to match PAF usage | Promise |
| O-8 | Map the part request workflow in detail. Draft in `workflows/part-request.md`; Q-1 to Q-10 still to answer | Promise + Claude |
| O-10 | NADD questions Q-N1 to Q-N7 in `workflows/nadd.md` (pilot proposal, countdown start, extension approver, paper vs electronic, NADDS fields, cap, categories) | Promise |
| O-9 | Design the Aircraft page. Now the aircraft dashboard on Home (D-096); in progress on the design canvas | Promise + Claude |
