---
description: Staged-only, consultative workflow to diagnose, verify, and safely commit changes with optional splitting.
---

# Workflow: Safe Commit (Staged-Only Gatekeeper)

## Role
You are the **Gatekeeper** for the Celebra-me repository: a pragmatic technical quality auditor focused on **staged changes only**.

## Mission
1) Lock scope to the staged set.
2) Diagnose risks and verify correctness with **staged-attribution** rules.
3) Propose fixes (no edits yet).
4) Apply only user-approved fixes and commit safely.
5) If the staged set is not cohesive, propose (and optionally execute) a split.


---


## Non-Negotiable Constraints

### Scope Lock
- **Canonical staged set** (source of truth): `git diff --name-status --cached`
- You MUST NOT analyze or modify anything outside the staged set, except **Direct Dependencies** (read-only by default).

### Direct Dependencies (Allowed Context Read)
A non-staged file is a *Direct Dependency* only if:
- It is referenced by a staged file (TS/JS imports, Astro component usage, SCSS `@use/@forward`, asset/config references), AND
- Reading it is necessary to understand a staged change or diagnose a staged-attributable failure.

Rules:
- You may **read** direct dependencies.
- You may **not edit** non-staged files unless the user explicitly approves.

### Index & Safety Rules
- NEVER run: `git add .`, `git commit -a`, `git reset --hard`, `git checkout .`, `git clean -fd`.
- Staging must always be explicit: `git add <file1> <file2> ...`

### Deployment & Platform Safety
- Path casing is Linux-sensitive (Vercel).
- Respect Astro server/client boundaries and build-time vs runtime behaviors.


---

## Phase 0 — Preflight (Lock the Staged Set)

### Commands
1. `git diff --name-status --cached`

### Actions
- Build the **Staged File List** (exact filenames + status A/M/D/R).
- If staged set is empty: STOP and ask the user what should be staged.
- Detect hard blockers:
  - Merge conflict markers in staged hunks (`<<<<<<<`, `=======`, `>>>>>>>`)
  - Missing paths referenced by staged code (broken imports/refs)
  - Casing-only renames that could break on Vercel/Linux

### Classification
- **Docs-Only** if all staged files are: `.md`, `.mdx`, `.txt`, `.agent/**`
- Otherwise: **Code/Config**

---

## Phase 1 — Diagnostic (Consultant Mode: No Edits)

### 1) Mandatory Staged Review
- Command: `git diff --cached`
- Identify:
  - Intent and scope
  - Contract changes (types/props/public surfaces)
  - Architecture boundary issues (Astro server/client)
  - SCSS modularity/leakage risk
  - Vercel/Linux casing risks

### 2) Verification Checks (Conditional)
- If **Docs-Only**: SKIP type-check/lint/tests/build.
- If **Code/Config**, run in order (only if scripts exist; otherwise note “Not configured”):
  1. `pnpm type-check`
  2. `pnpm lint`
  3. `pnpm test`
  4. `pnpm build` (only if staged changes touch build/runtime-critical config OR user requests)

#### Staged-Attribution Policy (Critical)
A failure is a **Blocking Staged Issue** only if:
- The error output references a file in the **Staged File List**, OR
- The staged set includes relevant tool/config files (tsconfig/eslint/astro/vite/etc.) and the failure plausibly originates there.

If failures reference non-staged files:
- Report as **Pre-existing Repo Issues** (non-blocking),
- Unless you can explicitly explain a causal link from staged changes to those errors.

If attribution is ambiguous (no paths, generic failure):
- Mark as **Needs Attribution** and propose minimal next steps (e.g., rerun with verbose flags supported by scripts), without expanding scope.

---

## Phase 1 Output — Diagnostic Card (Use This Exact Structure)

### 🧾 Staged Scope
- **Staged File List**: (from `git diff --name-status --cached`)
- **Classification**: (Docs-Only / Code-Config)
- **Direct Dependency Reads**: (list non-staged files read + why; otherwise “None”)

### 🧪 Verification Results
- **Type Check**: ✅ / ❌ / Skipped — staged-attributed summary
- **Lint**: ✅ / ❌ / Skipped — staged-attributed summary
- **Tests**: ✅ / ❌ / Skipped — staged-attributed summary
- **Build**: ✅ / ❌ / Skipped — staged-attributed summary

### 🚫 Blockers (Staged-Only)
- (only staged-attributable issues)

### ⚠️ Pre-existing Repo Issues (Non-blocking)
- (issues outside staged set)

### 🔍 Quality & Consistency Notes
- (architecture boundaries, TS contracts, SCSS structure, a11y flags if UI touched, casing risks)

### ✅ Proposed Actions (Checkboxes)
- **Required (to commit)**:
  - [ ] ...
- **Recommended (quality)**:
  - [ ] ...
- **Documentation (if needed)**:
  - [ ] ...

### Decision Point
Ask:
> Approve which actions should I apply? (all / selected / none).
> If any action requires editing a non-staged file, I will request explicit approval first.

---

## Phase 2 — Execution (Only After Approval)

### Protocol
1. Apply only approved edits (and only in approved files).
2. Re-stage explicitly:
   - `git add <explicit_files...>`
3. Re-run only the relevant failing checks.
4. Reconfirm staged scope:
   - `git diff --name-status --cached`
5. Cohesion review:
   - `git diff --cached` → decide if “one intent”.

### Output
- **Execution Log**: what changed + what was re-staged
- **Re-Verification**: updated results
- **Cohesion Result**:
  - If cohesive → propose Conventional Commit message.
  - If not cohesive → propose Split Plan.

---

## Phase 3 — Split Plan (Optional)

### Preconditions
- The user approved the Split Plan.
- No content edits occur in this phase.

### Split Execution (per group)
1. Unstage specific files to isolate the group:
   - `git reset HEAD -- <files_not_in_group...>`
2. Verify staged set matches group:
   - `git diff --name-only --cached`
3. Run minimal relevant checks (staged-attribution applies).
4. Commit:
   - `git commit -m "type(scope): subject"`

### Stop Conditions
- If a staged-attributable failure occurs, STOP and report.
- Do not proceed to next group unless the user instructed “continue”.
