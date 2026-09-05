# Gatekeeper Rules — Celebra-me

Universal review safeguards and Definition of Done. The authority and exception model in AGENTS.md
is unchanged. The hard guards below remain non-overridable.

## 1) Scope of Operation

The current Task Contract controls edits: audit/plan/validate are read-only; implementation is
bounded by authorized scope and remediation by confirmed findings. Preserve user-owned work. No
review grants Git, database, deployment, or provider authority.

Read [review scope and limits](../../docs/core/validation-procedures.md) sections 1–4.5 for review,
remediation, large-diff limits, repository hygiene, or release checkpoints. Existing large-change
thresholds and restricted actions remain unchanged.

## 2) Hard Guards (Block or Fix Mandatory)

These rules are **non-negotiable**.

### 2.1 Artifacts and Accidental Files

Build outputs or scratch files must never be staged or committed.

Forbidden examples (non-exhaustive):

- `.astro/`
- `logs/`
- `dist/`
- `.vercel/`
- `coverage/`
- `*.log`
- `*.tmp`
- `diff.txt`
- `staged.diff` (outside `.git/`)

**Action:**

- If forbidden artifacts are staged or present, report them and ask for explicit authorization
  before unstaging, deleting, cleaning, or otherwise removing them.
- Do not run `git restore --staged`, `git clean`, `git reset`, or file-discard commands as automatic
  hygiene.
- Update `.gitignore` only when explicitly authorized and the artifact is repeatedly generated.
- Always report any authorized hygiene actions.

---

### 2.2 Staged Diff Handling

- Writing a diff file is allowed **only** at `.git/staged.diff`.
- Any `staged.diff` located in the repository root or tracked paths is considered an artifact and
  must be reported before removal.

---

### 2.3 Case-Sensitivity (Vercel / Linux Safety)

Casing inconsistencies are treated as bugs.

Rules:

- Block path changes that differ only by casing.
- Enforce consistent lowercase naming for folders unless a different convention is clearly
  established.

---

### 2.4 Server / Client Boundary (Astro)

Server-only code must not leak into client bundles.

Server-only indicators include:

- secrets or environment variables,
- Node.js APIs,
- external services (email, DB, queues, rate limiting).

Rules:

- Server-only code must not be imported by UI components or client islands (`client:*`).
- If violated, refactor so the UI calls a server entry point (e.g., API route).

No new features may be introduced while fixing boundary violations.

---

### 2.5 Public Assets Usage

Files under `public/**` must not be imported as modules.

**Rule:**

- Use URL paths or the project’s asset pipeline instead.

---

### 2.6 Styling System (SCSS Only)

- Tailwind must not be introduced.
- If Tailwind usage is found in the reviewed scope:
  - Remove it.
  - Replace it with an equivalent SCSS implementation.

**Constraints:**

- Preserve existing DOM structure and semantics.
- Markup may only change if required for accessibility or correctness.
- Scope SCSS changes to the affected component or feature.

---

### 2.7 Language Rules

- **Visible UI text:** Spanish only.
- **Code, types, variables, comments:** English only.

Mixed or English UI text introduced by the reviewed scope must be corrected.

---

### 2.8 Type Safety (No New `any`)

Type safety is enforced to prevent silent runtime risk and type drift.

Rules:

- Do not introduce new `any` (including `as any`).
- Prefer `unknown` + narrowing when types are not known at compile time.
- For untrusted object inputs (e.g., parsed JSON), prefer:
  - `unknown`, or
  - `Record<string, unknown>` with explicit narrowing.

`@ts-ignore` policy:

- Avoid `@ts-ignore`.
- If it is truly unavoidable, it must include a brief reason comment on the line above:
  - `// @ts-ignore -- <why this is safe/necessary>`

Legacy `any` handling:

- Existing `any` is allowed to remain unless touched.
- If the reviewed scope touches code where `any` is used, the agent should replace it **only when
  trivial** (e.g., `any` → `unknown` + safe narrowing), and must avoid large typing refactors.

Large Change Mode note:

- In Large Change Mode, the agent must **still block new `any`**, but should avoid non-trivial
  typing refactors.

---

### 2.9 Database Safety (Agent Command Blocking)

The persistent local database (`celebra-me-rsvp`) is protected state. Agents must never execute any
of the following commands, whether through pnpm wrappers or directly in the shell:

**Blocked commands (all targets):**

- `supabase db reset --local --yes` — destroys persistent local DB
- `supabase db reset --linked` — destroys linked remote/production DB
- `supabase db push --local` — overwrites local schema (use disposable)
- `supabase db push --linked` — mutates production schema (use
  `pnpm db:migrate -- --target production`)
- `docker volume rm supabase_db_celebra-me-rsvp` — deletes persistent Docker volume
- `docker compose down -v` with the persistent Supabase project — deletes volumes

**Blocked commands (production only):**

- `supabase db push --db-url <prod_url>` — mutates production
- `supabase migration up --db-url <prod_url>` — mutates production
- Any `psql` or SQL mutation against a production host (`*.supabase.co`, `*.supabase.com`)

**Allowed commands (disposable-test only):**

- `supabase db reset --workdir <disposable_dir>` — resets disposable test env
- `docker stop` / `docker rm` `celebra-me-test-db` — manages disposable container

**Enforcement limitation:** This repository has no shell-level or process-level interceptor that can
block raw commands outside the `pnpm` wrapper system. The Supabase CLI, Docker CLI, and psql are on
PATH and can be invoked directly by a developer or agent bypassing all guards. The blocks above are
enforced through:

1. **Executable guard**: `pnpm db:*` commands run through `scripts/db/db-guard.ts`
2. **Agent policy**: this document — agents must self-enforce these blocks
3. **Code protection**: `pnpm db:local:reset` is blocked, `pnpm db:local:refresh-from-prod` and
   `pnpm db:local:refresh-from-prod-preserve-local` are blocked, and all
   `supabase db reset --local --yes` calls have been removed from project scripts

If an agent is asked to run any blocked command, it must refuse and explain the safe alternative.
Unknown or ambiguous database targets must cause an immediate abort.

---

### 2.10 Operational Security & Alert Remediation Policy

When handling security scanner findings (CodeQL, SAST, dependency alerts):

1. **Data-Flow Analysis Required**: Perform full data-flow analysis (source, controls, sanitizers,
   sink) before changing code.
2. **Scanner Evasion Prohibited**: Semantically neutral changes designed solely to defeat pattern
   matching (such as hiding hash algorithm strings behind variables, wrapping functions to interrupt
   data flow, copying process.env, or repeatedly shifting comments) are strictly prohibited.
3. **Strict Suppression Rules**: Inline or workflow suppressions are permitted only when an alert is
   demonstrably non-exploitable or an intentionally accepted risk. Every suppression must specify
   the exact query ID, target location, classification, accepted risk justification, and regression
   evidence.
4. **CI Workflow Boundary**: A passing CI workflow does not prove zero remaining security alerts.
   All new security findings must be inspected directly even when CI succeeds.
5. **No Reactive Commit Chains**: Speculative trial-and-error commit chains are not allowed.
   Validate security fixes locally before committing, and consolidate history cleanly.
6. **Behavioral Testing Required**: Any security remediation affecting executable code must include
   behavioral unit or integration tests proving correctness and preventing regressions.

---

## 5) Verification Protocol

Load the applicable section of [validation procedures](../../docs/core/validation-procedures.md)
before selecting checks. Tier A: localized style/copy/assets/docs; Tier B: shared components,
TS/Astro contracts, schemas, adapters, routing, or content resolution; Tier C: the full pipeline.
Use package.json scripts, including validate:changed, type-check, and pnpm run ci as required by the
selected tier. Preserve explicit domain/release and human-acceptance gates.

Do not claim completion unless applicable checks pass and the requested outcome is supported by
current evidence. Report failures, skips, remaining risks, and git-safety:finish results.

### 5.3 Visual evidence (screenshots and browser proof)

Material layout/reveal/hero/composition requires scoped visual evidence. Docs/backend/copy-only work
does not require screenshots. Load the full visual matrix and privacy/batch safeguards in validation
procedures §5.3–5.4 before browser/screenshot work. Required brief and domain viewport coverage
remains unchanged.

### 5.4 Context-efficiency rules

Load task-relevant context and reuse valid evidence. Reopen sources when relevant changes or new
questions require it; stop when acceptance is demonstrated. Detailed screenshot safeguards and
proportional validation requirements remain in the linked procedure.

## 6) Output Contract

Report outcome, findings or changes, evidence, checks passed/failed/not run, residual risks, and Git
session state. Use the user's requested format. Named workflows use the shared report contract. Do
not invent a commit message unless commit preparation is requested.
