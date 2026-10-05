# Nexus MRO — How to Prompt Each Tool

Each tool has one job. Standing rules keep it in its lane; the six-part prompt keeps each task tight.

| Tool | Role | Owns | Never touches |
|---|---|---|---|
| Claude Code | BUILDER | `app/`, Git commits and pushes | `docs/DECISIONS.md`, `design/`, `pitch/`, `legal-ip/` (unless told) |
| Cowork | DOCUMENTS | `docs/`, `design/`, `pitch/`, `workflows/` | `app/`, `.git`, `.env`, `CLAUDE.md`; never runs Git |
| Claude Design | SCREENS | Screen designs (exported into `design/`) | Code, decisions, documents |
| Claude chat | THINKING | Decisions, stress-tests, trade-offs | Builds nothing; decisions go into `DECISIONS.md` first |

**Golden rule:** decide in chat → record in `DECISIONS.md` → design in Design → document in Cowork → build in Claude Code. Only Claude Code (or Promise) commits to Git.

---

## 1. Standing rules

### Claude Code — append to `CLAUDE.md`

```markdown
## Your lane
You are the BUILDER. You own app/ and Git.
- Only change files the task names, or files inside app/ needed for that task.
- Never edit docs/DECISIONS.md, design/, pitch/ or legal-ip/ unless told to.
- Never add a new library or service without asking first.
- Show a plan and wait for approval before changing more than 3 files.
- Commit only when asked. Never force-push.
- When finished, list every file you changed.
```

### Cowork — paste into the NEXUS folder instructions

```markdown
You are the DOCUMENTS assistant for Nexus MRO.
- Read docs/DECISIONS.md before any task; never contradict it.
- You may write only in docs/, design/, pitch/ and workflows/.
- Never touch app/, .git, .env or CLAUDE.md.
- Never run Git commands. Claude Code or Promise commits.
- Use fictional sample data only (NX-101 style tails).
- If a task needs a new decision, write it as a PROPOSAL, not as fact.
- When finished, list every file you created or changed.
```

### Claude Design — paste at the top of every design prompt

```
Nexus MRO screen. Hangar-grade theme: IBM Plex Sans for interface, IBM Plex
Mono for tails, part numbers, hours and dates. Navy primary, teal for
actions. Status colours for meaning only (green serviceable, amber MEL or
deferred, red AOG or unserviceable, blue information, grey closed), always
paired with a word. Touch targets 44px minimum. Fictional data only.
No features beyond what the task lists.
```

---

## 2. The six-part prompt

```
TASK:      One sentence. What you want done.
CONTEXT:   Which files to read first.
SCOPE:     What it may create or change.
NOT:       What it must not touch or do.
STOP IF:   When to pause and ask instead of guessing.
DONE =     What finished looks like, and how to prove it.
```

`NOT` and `STOP IF` do the most work. Without them, the tool fills gaps with its own assumptions.

---

## 3. Example prompts

### Claude Code — building

```
TASK: Create the database tables for the snag workflow (Phase 1).
CONTEXT: Read CLAUDE.md, docs/DECISIONS.md sections 3, 4 and 5.
SCOPE: New migration files in app/supabase/migrations only.
NOT: No UI code. No auth changes. No new libraries. No real data.
STOP IF: A decision in DECISIONS.md is unclear or seems to conflict.
DONE = Tables exist, are append-only, have audit columns (who, device time,
server time). Explain each table in plain English. Plan first; wait for my OK.
```

### Cowork — documents

```
TASK: Write the part request workflow as a document.
CONTEXT: docs/DECISIONS.md section 8.
SCOPE: Create workflows/part-request.md only.
NOT: Don't change DECISIONS.md. Don't invent new approval steps.
STOP IF: You need a rule that isn't in DECISIONS.md. List it as an open question.
DONE = Every actor, every status, every handoff, plus a list of open questions.
```

### Claude Design — screens

```
[Design standing rules from section 1]
TASK: Design the Aircraft page for tail NX-102 (in check).
SCOPE: One desktop screen and one mobile screen.
NOT: No new colours. No features beyond the tabs listed.
DONE = Header with Blocked by line; tabs for Snags, MEL, Checks, Components,
Hours, Documents, History.
```

### Claude chat — deciding

```
TASK: Stress-test [rule or idea].
CONTEXT: [paste the relevant DECISIONS.md entries]
DONE = Risks, failure modes, abuse scenarios, recommended wording,
and the new DECISIONS.md entry to add if I agree.
```

---

## 4. Habits

1. **Plan before action.** For anything non-trivial: "Show me your plan first." Fixing a plan costs one message; fixing code costs an afternoon.
2. **One task per prompt.** Combined tasks give the tool licence to make choices you didn't approve.
3. **Approve commands one at a time.** Especially anything that deletes, installs or pushes.
4. **Check the change list.** End every task with: "List every file you changed." If anything is outside scope: "Revert every change outside the scope I gave."
5. **Watch for scope-creep phrases.** "I also improved…", "I went ahead and…", "While I was there…" — revert first, then decide whether you want it.
6. **Fresh session per task.** Long sessions drift. `CLAUDE.md` and `DECISIONS.md` carry the memory.
7. **Update the record.** At the end of each Claude Code session: "Update the Current position section in CLAUDE.md, then commit."

---

## 5. When something goes wrong

| Symptom | Say |
|---|---|
| Changed files you didn't name | "Revert every change outside the scope I gave, then list what you reverted." |
| Added a library you didn't approve | "Remove [library] and explain how to do this without it." |
| Contradicted a decision | "This conflicts with D-xxx. Undo it and follow D-xxx." |
| Guessed instead of asking | "Stop. List the assumptions you made and ask me about each one." |
| Long, confusing output | "Summarise in 5 lines: what changed, why, and what I need to check." |
| Stuck in a loop on an error | "Stop trying fixes. Explain the cause first, then propose one fix." |
