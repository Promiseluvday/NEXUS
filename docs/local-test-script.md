# Local test script (your PC, no cost)

**Purpose:** test the whole of Phase 1 on your own PC before Phase 2. Nothing goes on the internet; everything is fictional sample data (D-112).
**Time:** about 60–90 minutes for everything. Tick each box; note anything odd in the "Found" column.

---

## 0. Start-up (each time)

1. Open **Docker Desktop**; wait for "Engine running".
2. PowerShell:
   ```
   cd C:\Users\USER\Downloads\NEXUS
   git pull
   cd app
   npm install
   npm run db:start
   npm run db:reset
   npm run db:test
   ```
   `db:test` must end with **Result: PASS** (160 checks).
3. First time only (and after any `db:stop`/`db:start` that shows a new key): `npm run env:local`. It writes `app\.env.local` with the database address and key for you.
4. Start the screens: `npm run dev`, then open **http://localhost:5173** in Chrome.

**Sample users** (password for all: `nexus-dev-only`). At first sign-in each asks for a PIN; use **246813** for everyone (6 digits, needed for offline signing).

| User | Who | Use for |
|---|---|---|
| `kdo` | Duty engineer, G550s, **not** certifying | Reports, attends, work orders, being refused |
| `tmb` | Certifying engineer, G550s | Signing: MEL, DDLS, NADD, certify |
| `pla` | Pilot (Operations) | Reports, cabin items, read-only |
| `qar` | Quality Manager | First approval, queries, offline review |
| `abe` | Engineering CO | Second approval, enrolling tablets |
| `zem` | Commander | Overview, read-only |

**Tip:** to be two people at once, use a normal Chrome window and an **Incognito** window (Ctrl+Shift+N), each signed in as someone different.

---

## 1. Sign-in and home

| ✓ | Step | Expected | Found |
|---|---|---|---|
| ☐ | Sign in as `KDO` (capitals) | Accepted; asks for a PIN | |
| ☐ | Wrong password | "Username or password not recognised." | |
| ☐ | Look at the board | 4 G550s; NX-203 blue **Snag open**; NX-204 **Serviceable · MEL** with a DDLS due time | |
| ☐ | Tap the filter chips; shrink the window to phone width | Filter becomes one "Show:" dropdown; cards instead of a table | |
| ☐ | Type `204` in "Go to a tail" | NX-204 with its status chip | |
| ☐ | Sign in as `qar` | 6 aircraft; "Other departments" in the rail, marked View | |

## 2. Snag to work order to certification

| ✓ | Step | Expected | Found |
|---|---|---|---|
| ☐ | `kdo`: Snags ▸ open SNAG-000001 ▸ **Attend** | Board chip for NX-203 turns amber "Snag attended" | |
| ☐ | Disposition ▸ Rectify now ▸ request work order | WO-000001, "locked until Quality, then the CO" | |
| ☐ | `abe`: top bar | **No** Approvals button yet (Quality first) | |
| ☐ | `qar`: **Approvals (1)** ▸ approve with wrong PIN, then right PIN | Wrong PIN refused; then "moves to the next approver" | |
| ☐ | `abe`: Approvals ▸ approve | "approved: work can start" | |
| ☐ | `kdo`: Work orders ▸ WO-000001 ▸ add an entry ▸ attach any PDF as **Sign-off card** ▸ Mark work complete | "All attached"; Awaiting certification | |
| ☐ | Try attaching a `.txt` or `.docx` | Refused: PDF and images only | |
| ☐ | `kdo`: Certify | Refused: not certifying for the G550 | |
| ☐ | `tmb`: Certify with PIN | Certified; snag closed; offers "Set tail status" | |
| ☐ | Open the sign-off card from the file list | The PDF opens in a new tab | |

## 3. Deferrals

| ✓ | Step | Expected | Found |
|---|---|---|---|
| ☐ | `tmb`: ＋ New ▸ Report snag on NX-202 ▸ attend ▸ Defer under the MEL ▸ type `21-31` | MEL items appear with category and limit | |
| ☐ | Sign without ticking (M) | Refused | |
| ☐ | Tick all, "Also set to Serviceable · MEL" ticked, sign | DDLS page/entry given; NX-202 now **Serviceable · MEL** | |
| ☐ | Snags & deferrals ▸ DDLS ▸ NX-204 ▸ ▸ ▸ Request extension | "Extension requested" chip | |
| ☐ | `qar`: approve the extension | New due time on the DDLS | |
| ☐ | `tmb`: clear the entry with PIN; **Print DDLS** | Entry cleared; print shows deferral, extension and clearing | |

## 4. Cabin items, NADDs, queries

| ✓ | Step | Expected | Found |
|---|---|---|---|
| ☐ | `pla`: ＋ New ▸ Cabin item ▸ NX-203 ▸ tap **Emergency lighting** | "Never a NADD", Report a snag instead | |
| ☐ | Tap Forward cabin, describe, send | NADD-00000x proposed | |
| ☐ | `tmb`: NADDs ▸ NX-203 ▸ confirm (PIN) ▸ then rectify (PIN) ▸ **Print NADDS** | Sheet with 8 rows and the remarks | |
| ☐ | Reject another cabin item without a reason | Refused: needs a reason | |
| ☐ | On any snag: Raise a query to Quality, urgent | TQ-00000x | |
| ☐ | `qar`: Technical queries ▸ add a note | No "Close" button for Quality | |
| ☐ | Raiser closes it | Closed | |

## 5. Offline (needs the built copy)

Stop `npm run dev` (Ctrl+C), then:
```
npm run build
npm run preview
```
Open **http://localhost:4173**.

| ✓ | Step | Expected | Found |
|---|---|---|---|
| ☐ | `tmb`: Account menu (TMB ▾) ▸ This tablet ▸ register "Test tablet" | "Waiting for a Super Admin" | |
| ☐ | `abe` (Incognito): This tablet ▸ **Enrol** | Enrolled | |
| ☐ | `tmb`: reload ▸ Switch on offline signing with 246813 | **Ready** | |
| ☐ | Open the board and one open snag, then go offline: Chrome F12 ▸ Network ▸ **Offline** (or turn off Wi-Fi) | | |
| ☐ | Reload the page | App still opens; "Offline · showing data as at …" | |
| ☐ | Attend the snag ▸ Defer under MEL ▸ wrong PIN | "PIN not accepted" | |
| ☐ | Right PIN | "Signed offline, provisional"; top bar "Offline · 2 waiting" | |
| ☐ | Set a tail status offline | Board shows "→ U/S (provisional)" | |
| ☐ | Go back online | Queue sends itself; Send queue shows **Accepted** | |
| ☐ | `qar`: Quality ▸ Offline signatures | Your offline signatures, accepted | |

## 6. What to send back

- Any row where "Found" differs from "Expected" (a screenshot helps).
- Anything confusing to an engineer on the line: wording, too many taps, hard to read.
- Phone/tablet feel (Chrome F12 ▸ device toolbar, choose a tablet size).

---

## If something goes wrong

| Problem | Fix |
|---|---|
| "The app is not connected to a database" | `npm run env:local`, then stop (Ctrl+C) and restart `npm run dev` |
| "Cannot reach the Nexus server" | Docker Desktop running? Then `npm run db:start` |
| `db:start` says a port is in use | `npm run db:stop`, then `npm run db:start` |
| Sign-in fails for every user | `npm run db:reset` (rebuilds the sample data) |
| Forgot the PIN | `npm run db:reset` (everyone sets a PIN again) |
| Old screens after a `git pull` (preview) | `npm run build` again, then Ctrl+Shift+R; if still old, F12 ▸ Application ▸ Service workers ▸ Unregister |
| Blank page | F12 ▸ Console: copy the red text to Claude |
| Want to start completely fresh | `npm run db:reset`, and in Chrome F12 ▸ Application ▸ Storage ▸ **Clear site data** |
