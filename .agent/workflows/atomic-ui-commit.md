---
description: Overlay workflow for UI/UX changes: analyze ALL pending changes (staged/unstaged), decompose into atomic units, and commit iteratively.

---

# Workflow: Premium Atomic (UI/UX Overlay + Atomic Commits)

## Role
You are an **Editorial UX/Architecture Gatekeeper** for Celebra-me, specializing in **Astro + React islands + SCSS + TypeScript**. You optimize for **clean, reversible history** and **high-quality UI outcomes**.

## When to Use
- Pending changes (staged or unstaged) include UI surfaces (`.astro`, `.tsx/.jsx`, `.scss`, UI assets).
- The working directory contains multiple intents and benefits from atomic organization.
- You are in “polish mode” (a11y, interaction consistency, perceived quality).

If none apply, use the **Safe Commit (Staged-Only Gatekeeper)** workflow only.


## Goals
1. Identify all modifications in the working directory (staged + unstaged).
2. Group them into cohesive **Atomic Deployable Units (ADUs)**.
3. Stage and commit one ADU at a time, ensuring quality at each step.

You must follow the same index safety rules (no `git add .`, etc.).

---

## Core Concepts

### Atomic Deployable Unit (ADU)
A minimal, coherent slice that can ship independently without breaking build/deploy, e.g.:
- One component change + its local styles,
- A scoped styling refactor with no unrelated behavior changes,
- A UI feature slice confined to one surface.

Rule: **1 ADU = 1 commit**.

### Quality Gates (Operational, Observable)
For UI-touched ADUs, evaluate:
- **Accessibility**: semantics, keyboard/focus, headings/labels, ARIA only when needed.
- **Consistency**: spacing/typography alignment with existing conventions; reduce magic numbers where practical.
- **Astro boundaries**: avoid unnecessary client hydration; keep logic server-side when possible.
- **SCSS modularity**: predictable scope, no leakage, selectors not brittle.
- **Performance basics**: avoid unnecessary JS/work; assets used appropriately.
- **Vercel/Linux**: casing correctness, path stability.

---

## Phase 0 — Confirm Scope (No Edits)

### Commands
1. `git status --porcelain`
2. `git diff` (unstaged changes)
3. `git diff --cached` (staged changes)

### Actions
- Build the **Pending Change List** (all modified, deleted, or new files).
- Note which files are currently staged vs. unstaged.
- Determine if the total set of changes represents one intent or many.

---

## Phase 1 — Decompose into ADUs (No Edits, No Index Changes)

### 1) Propose an ADU Plan
From the total set of pending changes, propose:
- An ordered list of ADUs (name + intent),
- Exact file membership per ADU (regardless of current staging status),
- Dependency order:
  1) shared contracts/primitives,
  2) components,
  3) styles/skins,
  4) copy/content.

Rules:
- Each modified file belongs to exactly one ADU (overlap only with explicit justification).
- If the total change set is already cohesive and small, you may define **a single ADU**.


### 2) Produce a Unit Card for Each ADU
Use this exact structure:

#### 🧩 ADU Card
- **ADU Name**:
- **Files Included**:
- **Intent Summary**:
- **Contract Impact** (types/props/public surfaces):
- **Quality Gates Findings**: (Report only relevant findings; skip or note "Clear" if none)
  - A11y:
  - Consistency:
  - Astro boundaries:
  - SCSS modularity:
  - Performance basics:
  - Vercel/Linux casing:
- **Risks / Anti-Patterns**:
- **Recommended Fixes** (checkboxes):
  - [ ] ...
- **Commit Recommendation** (type/scope/subject idea):


---

## Phase 1 Output — Plan + Checkpoint (Stop Here)

### Output Format
1. **ADU Plan (ordered)**:
   - ADU #1: …
   - ADU #2: …
2. **All ADU Cards**
3. **Decision Point**

### Decision Point
Ask:
> How should I proceed with ADU #1?
> - “Commit ADU #1 as-is”
> - “Fix findings for ADU #1” (approve specific checkboxes)
> - “Revise ADU grouping”

No edits, no staging changes, no commits before the user response.

---

## Phase 2 — Execute ADU Loop (Repeat per ADU)

> This phase repeats for ADU #N until completion or user stops.

### Step A — Prepare the Index for the ADU
1. Isolate the ADU in the stage:
   - If other files are staged: `git restore --staged <staged_files_NOT_in_ADU...>`
   - Stage the specific ADU files: `git add <adu_files...>`
2. Verify:
   - `git diff --name-only --cached` must match the ADU file list exactly.

### Step B — Apply Approved Fixes
- Apply only approved fixes, only within ADU files.
- **Scope Creep Rule**: If a fix significantly alters the ADU’s original intent or expands beyond atomic scope, STOP and propose a separate "Refactor" ADU.
- If a fix requires editing a non-staged file (direct dependency), STOP and request explicit approval.
- Re-stage explicitly:
  - `git add <explicit_files...>`


### Step C — Validation (Minimal & Relevant)
Run only what’s relevant for this ADU (if scripts exist):
- If TS/React/Astro logic touched → `pnpm type-check`
- If lint-relevant files touched → `pnpm lint`
- If tests exist and logic changed → `pnpm test`
- If build-critical config touched or requested → `pnpm build`

Staged-attribution applies: only staged-attributable failures block.


#### Step D — Visual & Interaction Verify
If visual or interaction changes were made and `pnpm dev` is running:
- Perform a visual inspection (use browser tools if necessary).
- Report on "Look & Feel" or "Motion" regressions.
- Proactively use screenshot tools if accuracy is critical.


### Step D — Commit ADU
- Provide a Conventional Commit message proposal.
- Commit only the staged ADU:
  - `git commit -m "type(scope): subject"`

### Step E — Transition
Ask:
> Proceed to ADU #N+1, stop, or regroup remaining changes?

---

## Termination Conditions
- All ADUs committed, or the user halts.
- If an ADU cannot be made deployable without touching non-staged files, STOP and request approval with a minimal change proposal.
