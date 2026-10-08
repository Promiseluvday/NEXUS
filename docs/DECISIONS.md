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
| D-011 | *(Extended by D-016, D-048 and D-144.)* In scope for v1: snags, work orders, check packages and task cards, MEL deferrals, aircraft hours/cycles/landings, component tracking by position, stores and inventory, part requests, approval chains, procurement with cost and invoice history, document attachments, fleet serviceability dashboard, notifications, audit trail. |
| D-012 | *(Refined by D-017; flight scheduling and crew rostering brought into v1 by D-205.)* Out of scope for v1: automatic maintenance forecasting from the AMP/MPD, financial/ERP functions, flight scheduling, crew rostering. |
| D-013 | *(Timing changed by D-205.)* Later Operations modules (after v1): crew qualifications and expiry tracking (Phase 5), then flight scheduling linked to aircraft serviceability and crew validity (Phase 6). |
| D-014 | Initial aircraft types for development: **Airbus A330-200** and **Gulfstream G550**. Framework stays aircraft-agnostic. |
| D-015 | **The aircraft register is controlled by the operator's Super Admins** (D-035). They add aircraft and enter the tail number. Aircraft are **deactivated, never deleted**; deactivation needs a reason and PIN re-entry, no second approval, and is logged with who and when. *(6 Oct 2026)* |
| D-016 | **ADs and SBs are in v1** as engineer-entered compliance records: applicability, compliance method, status and any next-due figure are entered by an engineer; **Quality verifies each entry** (countersign with PIN). The system never decides applicability or calculates due. Extends D-011. *(6 Oct 2026)* |
| D-017 | **Partly SUPERSEDED by D-205** (now built in v1). **Flight and crew scheduling are provisioned now, built later** (Phases 5 and 6, D-013). In v1: (a) menu entries "Flight scheduling" and "Crew scheduling" shown as **"Coming soon"**, each with an operator setting to hide them; (b) the data model keeps aircraft availability (status, who set it, expected return to service, D-045 to D-047) and the shared person record with qualifications (D-085) ready for those modules to read; (c) no scheduling logic in v1. When built, scheduling **reads** aircraft availability from Engineering and can never change a tail status (D-046). Refines D-012. *(7 Oct 2026)* |
| D-018 | **Engineering has three workshop sections** besides line and base maintenance: **Tire Bay**, **Battery Workshop** and **Aerospace Ground Equipment (AGE)**. Each is a work area inside Engineering; access is granted per user (D-121). Their records and workflows are open item O-15. *(8 Oct 2026)* |
| D-019 | **Workshops raise their own work orders** for internal jobs (e.g. battery capacity test, tire request, wheel request, tire and wheel build-up), with the same Quality pre-approval and CO final approval (D-063). **Fleet requests:** when an aircraft work order needing a tire assembly or battery is approved, the Tire Bay or Battery Workshop receives a request to issue one, by serial number, against that work order. Workflow: `workflows/workshops.md`. *(8 Oct 2026)* |

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
| D-040 | *(DDLS and NADD dispositions: D-160 to D-165.)* Lifecycle: Pilot reports (Open – Reported) → Engineer assesses (Under Assessment) → **Rectify now / Defer under MEL / No fault found** → Certifying engineer signs → Closed, tail status updated. |
| D-041 | Pilots log snags after the tech-log entry, including **soft observations** they want checked. |
| D-042 | **A pilot cannot close any entry.** Every entry, including soft observations and no-fault-found, is dispositioned by an engineer. |
| D-043 | Only users holding a valid **Certifying** privilege, in scope for that aircraft type, can close an item. Certification checks the company authorization, licence and type rating. |
| D-044 | Findings during a check are raised as **non-routine cards** inside the package and enter the snag workflow. A check cannot close while its findings are open. |
| D-045 | *(Display refined by D-200.)* **A pilot report alone shows "Snag open"** on the tail, not U/S or AOG. The tail keeps its last engineer-set status, shown as "Last status: … set by [name] · time", until an engineer changes it. Operations counts "Snag open" separately, never as "not available". *(6 Oct 2026)* |
| D-046 | **Only an engineer sets a tail status** (U/S, AOG, SVC, SVC · MEL, In check). Every status shows **who set it and when**. *(6 Oct 2026)* |
| D-047 | **Expected return to service** is an estimate entered by Engineering (duty or certifying engineer) with name and time, never calculated. Visible to all departments. *(6 Oct 2026)* |
| D-048 | **Non-Airworthiness Deferred Defects (NADD)** are in v1. Engineers and pilots can log them. Each NADD has a countdown, **120 days by default or as the operator defines** (D-025), and NADDs are listed per aircraft by time remaining. A NADD does not change the tail status. Workflow: `workflows/nadd.md`. Extends D-011. *(7 Oct 2026)* |
| D-049 | NADDs can be **printed**. Nexus emulates the operator's **Non-Airworthiness Deferred Defects Sheet (NADDS)** through a configurable print template. Every print is marked with who printed it, when, the record version, and "uncontrolled when printed". *(7 Oct 2026)* |
| D-160 | **NADD rules** (answers to O-10): a pilot logs a NADD as **"proposed"**; a certifying engineer confirms it (online, PIN, declaring it is not covered by the MEL and does not affect airworthiness). The countdown starts on the **report date**. Extensions are approved by the approver set in the chain (Quality by default). The **electronic record is the master**; printed sheets are copies. No cap on NADDs per tail by default (configurable). One default limit for all NADDs. (Section 5 continues at D-160.) *(8 Oct 2026)* |
| D-161 | **NADDS print** follows the operator's sheet: header Aircraft Reg and Sheet No.; columns S/N, Date, Log Ref No or WO Ref, Name (3LC), Defect / Discrepancy, Action Taken, Date, Name (3LC), Log Ref No; a fixed number of rows per sheet (8 for PAF); configurable remarks lines. The layout is a template (D-049); the operator's crest is uploaded by the operator, never shipped by Liebetag. *(8 Oct 2026)* |
| D-162 | Every person record carries a **3LC (three-letter code)**, unique per operator, used on printed sheets alongside the full name. *(8 Oct 2026)* |
| D-163 | **Deferred Defects Log Sheet (DDLS)** replaces the name Hold Item List (HIL). **Every MEL deferral is logged on the DDLS automatically.** An engineer can also place other deferred defects on the DDLS when they judge it a DDLS item and not a NADD. Extensions are allowed only for categories set by the operator (PAF: B, C and D; never A). Workflow: `workflows/ddls.md`. *(8 Oct 2026)* |
| D-164 | **Technical log references** (TLB book, page and item number) are recorded on every snag, deferral and clearance, because the paper technical log continues alongside Nexus. Opening a DDLS entry needs: TLB book / page / item, MEL category and reference (if MEL), days allowed, pilot report or maintenance entry, (M) and (O) procedure flags, defer date, rectification due date, name and signature. Clearing needs: rectification actions, rectification date, TLB book / page, name and signature. *(8 Oct 2026)* |
| D-165 | *(Answered by D-166.)* **NADDs and the A-check:** when an A-check package is opened, every open NADD on that tail is listed in it and flagged "rectify before A-check". Whether open NADDs block the A-check from closing is open item O-13. *(8 Oct 2026)* |
| D-166 | **Open NADDs never block an A-check from closing.** They are flagged in the A-check package and in the pending / overdue list. **Calendar months count as 30 days** (4 months = 120 days), as a configurable counting convention (D-055 pattern). Answers O-13. *(8 Oct 2026)* |

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
| D-058 | **Applying an MEL item uses the loaded MEL** (D-050). As the engineer types, Nexus suggests matching items from the aircraft's loaded MEL revision, or the exact item if typed in full. Choosing one fills in the remarks or exceptions, category and interval, and the revision. The engineer then completes the D-053 confirmations and applies it. *(7 Oct 2026)* |

## 7. Checks, packages and work orders

| ID | Decision |
|---|---|
| D-060 | Engineers can add **maintenance check packages** per aircraft: check type, engineer-entered due figure, uploaded work pack (PDF), and a list of task cards. |
| D-061 | Each task card has its own status (not started, in progress, done, certified), assigned engineer, and duplicate-inspection flag. |
| D-062 | Progress is shown as **"X of Y tasks completed"**, not as a percentage labelled "progress". Weighting by man-hours may come later. |
| D-063 | **Work orders need two approvals before any work is recorded.** After a snag is assessed, the engineer raises a work order request. **Quality pre-approves**, then the **CO gives final approval** (acting deputy per D-036). No updates, task entries or sign-offs can be added until both approvals are given. Workflow: `workflows/work-order.md`. *(7 Oct 2026)* |
| D-064 | **Work order numbers are generated automatically by the server** and run **sequentially across the whole fleet**. Numbers are never reused; rejected or cancelled work orders keep theirs. Format is a setting (D-025). *(7 Oct 2026)* |
| D-065 | **Completion evidence:** before a work order is certified closed, scanned copies of the signed sign-off card and/or technical log page, and the aircraft or engine logbook entry, are attached (PDF or images, D-026). Which scans are mandatory is a setting. *(7 Oct 2026)* |
| D-066 | **CRS:** when every task in a work package is certified and its findings are closed (D-044), Nexus **compiles** the Certificate of Release to Service with a sequential reference number, printable and downloadable. It is a draft until an authorized certifying engineer signs it (online, PIN, D-043, D-104). Nexus never releases an aircraft on its own (D-020). The layout is a configurable template. *(7 Oct 2026)* |
| D-067 | **Work order scope** (answers to O-11): only "Rectify now" and check packages need a work order; MEL, NADD and no-fault-found use their own controls. A check package has **one** work order; each non-routine finding gets its own. When the CO is unavailable, only the acting deputy (D-036) approves; there is no verbal approval path. *(8 Oct 2026)* |
| D-068 | Parts can be **reserved before** a work order is approved, so an AOG part isn't lost; they are **issued only after** approval. *(8 Oct 2026)* |
| D-069 | Which completion scans are mandatory is set per operator (D-065). CRS references run in **one fleet-wide sequence**, never reused. *(8 Oct 2026)* |

## 8. Supply and procurement

| ID | Decision |
|---|---|
| D-070 | Engineers can **search stores** and see live availability and quantity before walking to the store. |
| D-071 | Stock updates in real time on every issue, receipt and return. A part is **reserved** the moment it is requested, so two engineers cannot claim the last unit. |
| D-072 | *(Refined by D-148.)* Parts carry **certificate status, shelf life and expiry**. Expired or uncertified parts are clearly flagged. |
| D-073 | Handoffs: Engineering requests → Supply issues from stock, or raises a requisition → Procurement runs approval and PO → Supply receives, inspects, stocks → Engineering notified. |
| D-074 | **Only Supply can mark a part available**, after receiving inspection. Procurement cannot. |
| D-075 | **Separation of duties:** the requester cannot approve the purchase; the buyer cannot receive it into stock. |
| D-076 | Approval chain is multi-level (e.g. storekeeper → supply director → commander), with status visible to all concerned. The chain's steps are configurable per operator. |
| D-077 | *(Refined by D-121, D-122 and D-127.)* Purchase cost and invoice are attached to each purchase, giving **price history**. Cost data sits behind stricter permissions (Supply, Procurement, Command). |
| D-078 | **Changing an approval chain** is itself approved: Quality proposes, the CO approves. Logged and versioned like D-083. The approver for MEL extensions is set in the approval chain set-up. *(6 Oct 2026)* |
| D-079 | **Rejecting any approval requires a reason.** The record returns to the person who submitted it, shown as "Rejected" with the reason. Resubmitting creates a new version. *(6 Oct 2026)* |
| D-140 | **No cannibalisation (robbery).** PAF does not rob parts from one aircraft to fit another, so Nexus has no robbery flow. Parts come only from stores or purchase. (Section 8 continues at D-140 because D-070 to D-079 are used.) *(7 Oct 2026)* |
| D-141 | **Stock is held per store.** PAF has a **Main Store** and a **Forward Store**; a part can be in either or both, and searches show quantity per store. The list of stores is a setting (D-025). *(7 Oct 2026)* |
| D-142 | **Main Store is the store of record.** Parts move Main → Forward by transfer (issued, in transit, received). If the Forward Store receives a part directly, it reports the receipt to the Main Store, which acknowledges it before it counts as stock. *(7 Oct 2026)* |
| D-143 | **A part request does not need a snag.** Aircraft parts need a tail and a work order or task card. Consumables can be requested without a snag, against a work order or a stated purpose. *(7 Oct 2026)* |
| D-144 | **Procurement also runs commercial maintenance oversight** of work sent to outside MROs: negotiating maintenance cost, recording the agreed cost, and logging parts used by the MRO with their cost. Technical acceptance of MRO work stays with Engineering and Quality (D-020). Extends D-011. *(7 Oct 2026)* |
| D-145 | **Part request and requisition / PO are separate linked records** (Engineering owns the request; Supply and Procurement own the requisition and PO). In v1 one request line = one requisition line. Stock is reserved only at **server time**; an offline request shows "Queued, not reserved". (Answers to O-8.) *(8 Oct 2026)* |
| D-146 | **Approval separation:** whoever raises a requisition cannot approve any step of it, and no one approves two steps of the same requisition. Approval chains can vary by **value and priority**; thresholds are configured per operator. Refines D-075, D-076. *(8 Oct 2026)* |
| D-147 | **AOG priority:** any engineer may request it; it is confirmed only when the linked job makes the tail U/S or a certifying engineer confirms it. A priority-use report per person is visible to Quality and Command. *(8 Oct 2026)* |
| D-148 | **Expired shelf-life or uncertified stock cannot be issued**; Supply moves it to quarantine. Refines D-072. Quality owns, as configuration, the **approved supplier list** and the **accepted release certificate types**; receiving inspection records which certificate was accepted. *(8 Oct 2026)* |
| D-149 | Requisitions have an **"In clearing"** (customs) state. Document names (request, requisition, issue voucher, etc.) are **configurable labels** in the operator's own terms. Engineers do not see cost by default (D-121). *(8 Oct 2026)* |
| D-150 | **Forward Store receipts:** the Forward storekeeper does the receiving inspection; the Main Store acknowledges the receipt (D-142). (Answers to O-12.) *(8 Oct 2026)* |
| D-151 | **Returns from Forward to Main** use the same transfer record in reverse. *(8 Oct 2026)* |
| D-152 | **Store access is granted per user.** Like aircraft scope (D-121), each user is given access to the Main Store, the Forward Store, or both, by a Super Admin. A user sees stock, transfers and records only for stores they hold. *(8 Oct 2026)* |
| D-153 | **Release documents are mandatory when a part is registered or received.** The applicable certificate (e.g. EASA Form 1, FAA Form 8130-3, manufacturer CofC) and the serviceable tag must be uploaded (PDF or image, D-026) before the part can be accepted into stock. Which documents are required for each part class (e.g. components vs consumables) is configured by Quality (D-148). *(8 Oct 2026)* |

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
| D-090 | **Colours SUPERSEDED by D-212.** Theme: **"Hangar-grade"**. Deep navy primary, teal accent for actions, light and dark modes (dark default on mobile). |
| D-091 | Status colours are reserved for meaning only: green serviceable, amber limited/deferred, red unserviceable/AOG, blue information, grey closed. Every status pairs colour with a word. |
| D-092 | Typography: IBM Plex Sans for interface, IBM Plex Mono for tails, part numbers, serials, hours and dates. |
| D-093 | Touch targets minimum 44–48 px for gloved and one-handed use. |
| D-094 | Principles: tail first; three taps to anything routine; status always visible; "what's blocking this?" on every relevant screen; role-based home screens; offline state always visible; signing requires PIN re-entry; history one tap away. |
| D-095 | First screens designed: Fleet board (desktop and mobile). Next: Aircraft page. **Partly SUPERSEDED by D-096.** |
| D-096 | *(Rail amended by D-201 and D-202.)* **Home is aircraft-first.** The left rail lists "All aircraft" and each tail. "All aircraft" shows the fleet board; choosing a tail shows that aircraft's dashboard (record, totals, open items with "Blocked by" first, due items as entered, recent activity, 4-week calendar). The Aircraft page (O-9) is this dashboard. Layout is Liebetag's own; no copying of commercial MRO screens (D-113). *(6 Oct 2026)* |
| D-097 | *(Extended by D-203, D-211.)* **Every history and register can be printed and downloaded** (PDF and spreadsheet), filtered by date range: parts removal and installation, work order history, completed task history, parts received by month, parts purchased by month or year, and total cost of parts. Cost reports follow cost permissions (D-121, D-127). Prints are marked with who, when and "uncontrolled when printed". *(7 Oct 2026)* |
| D-098 | **Navigation principles** (add to D-094): every summary tile or box is clickable as a whole, not just its number; every screen has Back and a breadcrumb; a screen never asks for what it already knows (under a tail, the tail is filled in; from a part, the part number is filled in); "History" on a record opens **that record's version history**, not the aircraft history. *(7 Oct 2026)* |

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

## 15. Design round 2 (8 Oct 2026)

Earlier sections are full, so the decisions agreed on 8 Oct 2026 are numbered from D-200. Each says which earlier decision it refines or replaces.

| ID | Decision |
|---|---|
| D-200 | **Snag display on the tail** (answers O-19): a pilot report shows a **blue "Snag open"**. Once an engineer starts the assessment it shows **amber "Snag attended"**. Neither is a serviceability status: the engineer sets the tail status at disposition (D-046), and the last engineer-set status stays visible (D-045). *(8 Oct 2026)* |
| D-201 | **Aircraft list as a dropdown** beside "All aircraft" in the rail, instead of one rail row per tail (answers O-16, P8). Amends D-096. *(8 Oct 2026)* |
| D-202 | **Cleaner home rail: departments with dropdowns.** The rail lists the departments the user may use; each has a dropdown arrow that opens its subsections (e.g. Engineering → Work orders, Tire Bay, Battery Workshop, AGE; Supply → Main Store, Forward Store, Receiving). Amends D-096. *(8 Oct 2026)* |
| D-203 | **Daily serviceability state print** (answers O-18, P10): Engineering and Operations copies, from the statuses Engineering set, as at a chosen date and time. Defaults as drawn: printed on demand; Engineering copy signed "Prepared by / Checked by", Operations copy "Prepared by / Received by Operations"; header and classification marking set per operator. Extends D-097. *(8 Oct 2026)* |
| D-204 | **Dates and times** (P11): dates are picked from a calendar and shown as **DD Mmm YYYY** (07 Oct 2026) on every device; times are 24-hour **HH:MM**. Format is a setting (D-025). *(8 Oct 2026)* |
| D-205 | **Flight and crew scheduling are built in v1** (P12): flight requests, Outstanding missions, fleet roster, crew assignment and the flight order. Built **after** the Phase 1 snag workflow. Reads aircraft availability from Engineering and never changes a tail status (D-046). Classification handling (O-14) must be settled before it is built. Supersedes the timing in D-012, D-013 and D-017. *(8 Oct 2026)* |
| D-206 | **Sign-in and accounts** (P13, P20): sign in with a **username or email**; no service number needed. A person can **request an account** (with a requested department); it stays pending until a Super Admin approves (D-123). The PIN is set on first sign-in. Sign out from every top bar and from mobile More; forgotten-password flow. *(8 Oct 2026)* |
| D-207 | **Technical queries** (P14): a question thread attached to a record, assigned to a person or a department queue, with due date, notes, photos and PDFs. Notes are added, never edited. The raiser closes it. A query **never changes the record**. *(8 Oct 2026)* |
| D-208 | **Repeat-defect alert** (P15): from any snag or work order, similar defects can be found by tail, type, ATA and words. A **repeat** is flagged at **3 reports in 30 days on one tail and ATA sub-chapter** (both numbers are settings). It **alerts only**; it never grounds or decides (D-020). *(8 Oct 2026)* |
| D-209 | **Cabin items on a cabin map** (P16): crew report by tapping a zone (layout per aircraft type, set by the operator). Engineering accepts as a NADD, rejects with a reason the reporter sees, or raises it as a snag. **Emergency equipment, exits, oxygen and emergency lighting always go to the snag workflow, never NADD.** *(8 Oct 2026)* |
| D-210 | **Column chooser** (P17) on every list, saved per user; it never reveals data the user may not see. *(8 Oct 2026)* |
| D-211 | **Guided report builder** (P18) on approved data views, not raw tables; every run, print and download is logged; each viewer sees only their own access. Extends D-097. *(8 Oct 2026)* |
| D-212 | **Colours** (P19): light blue, yellow, black and white replace navy and teal. Black header and text, white cards on a light-blue ground, light-blue buttons with black text, yellow for the Liebetag mark and highlights. Light blue is never used for text on white; links use a deeper blue. Status colours stay as D-091. Supersedes the colours in D-090. *(8 Oct 2026)* |
| D-213 | **Snag numbers** run in one fleet-wide sequence (`SNAG-000001`), assigned by the server, never reused. Format is a setting. *(8 Oct 2026)* |
| D-214 | **Phase 1 includes the core of work orders** (request, Quality and CO approval, completion scans, certify; D-063 to D-069), because "Rectify now" cannot finish without them. CRS and check packages stay in Phase 2. *(8 Oct 2026)* |
| D-215 | **Setting a tail status is signed with the PIN.** An engineer's status (SVC, SVC · MEL, U/S, AOG, In check) is a signed statement, so it needs PIN re-entry like any signature (D-094). Refines D-046. *(9 Oct 2026)* |
| D-216 | **Deferral can set "Serviceable · MEL" in the same signed step.** The MEL and DDLS deferral forms offer "Also set the tail to Serviceable · MEL". It is pre-ticked only when the tail is currently Serviceable; if it is U/S, AOG or In check the box starts unticked with a warning. It is the engineer's tick under the same PIN; deferral and status are recorded together or not at all. Nexus never sets a status on its own (D-020, D-046). *(9 Oct 2026)* |

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
| O-8 | ✅ Closed 8 Oct (D-145 to D-149). Map the part request workflow in detail. Draft in `workflows/part-request.md`; Q-1 to Q-10 still to answer | Promise + Claude |
| O-10 | ✅ Closed 8 Oct (D-160, D-161). NADD questions Q-N1 to Q-N7 in `workflows/nadd.md` (pilot proposal, countdown start, extension approver, paper vs electronic, NADDS fields, cap, categories) | Promise |
| O-11 | ✅ Closed 8 Oct (D-067 to D-069). Work order questions Q-W1 to Q-W6 in `workflows/work-order.md` (AOG path, which dispositions need a WO, reserving before approval, packages, mandatory scans, CRS numbering) | Promise |
| O-12 | ✅ Closed 8 Oct (D-150, D-151). Stores questions Q-S1, Q-S2 in `workflows/part-request.md` (receiving inspection at Forward Store, returns to Main) | Promise |
| O-13 | ✅ Closed 8 Oct (D-166). NADD limits: (a) PAF's NADDS sheet says "not later than 4 months after entry"; Promise said 120 days. Which governs, calendar months or days? (b) Do open NADDs **block** an A-check from closing, or only appear flagged in it? | Promise |
| O-14 | **Scheduling data classification** (Phase 6): flight orders and mission lists are classified. Proposal in `workflows/scheduling.md`: on-premise only, need-to-know access, full audit, no cloud copies | Promise |
| O-15 | **Engineering workshops** (D-018, D-019): Q-WS1 to Q-WS5 in `workflows/workshops.md` (workshop stock locations, periodic work orders for routine jobs, who signs off, removed units, AGE details). Earlier note: what each records. Tire Bay (wheel and tyre assemblies, serials, build-up, condition, landings per tyre, retreads?), Battery Workshop (battery serials, capacity checks, charging records), AGE (equipment register, serviceability, calibration and servicing dates entered by staff, defects). Who works in each, and do they need their own work orders? | Promise |
| O-16 | ✅ Closed 8 Oct (D-201). **Proposal P8 (canvas):** aircraft list as a dropdown beside "All aircraft" instead of one rail row per tail. Accepting it amends D-096 | Promise |
| O-17 | ✅ Closed 8 Oct (D-205); Q-OP1 to Q-OP4 remain as O-20. **Proposal P9 (canvas):** flight requests, Outstanding missions and a fleet roster (tails by day, Standby 1 / 2) drawn as drafts. Decide timing: design now and build in Phase 6 (recommended), or bring forward. Plus Q-OP1 to Q-OP4 on the canvas (who registers requests, when a mission leaves the list, standby slots, request numbering) | Promise |
| O-18 | ✅ Closed 8 Oct (D-203). **Proposal P10 (canvas):** daily serviceability state print, Engineering and Operations copies, as at a chosen time. Extends D-097. Plus Q-PR1 to Q-PR3 (signatures, fixed daily time, header and classification marking) | Promise |
| O-19 | ✅ Closed 8 Oct (D-200: blue "Snag open", amber "Snag attended"). **Fleet board v2** (`design/fleet-board/review.md`, `data-contract.md`): proposals P-FB-1 (status shows who set it: already D-046), P-FB-2 (unassessed pilot report shown as an amber flag while the status stays at the last engineer value: overlaps D-045, which shows a "Snag open" chip; pick one), P-FB-3 (an engineer marks which items block release; the board shows the longest-held plus "+N more"), P-FB-4 ("In check" in blue, extending D-091). Also: hours stored as minutes, shown hh:mm, format a setting | Promise |
| O-9 | Design the Aircraft page. Now the aircraft dashboard on Home (D-096); in progress on the design canvas | Promise + Claude |
| O-20 | Scheduling details Q-OP1 to Q-OP4 (who registers requests and whether Command approves; when a mission leaves Outstanding missions; standby slots per day or shift; request number format). Drawn defaults apply until answered | Promise |
