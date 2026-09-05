---
description: Technical error diagnosis and surgical remediation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-08-08
---

# Error-Diagnosis & Remediation

## Mission

Execute this workflow when a terminal error, test failure, or gatekeeper block requires remediation.
Enforces a strict 6-state machine with a hard cycle limit of **3** to prevent fix-fail loops.
Human-facing reports follow the shared report contract (not a seventh machine state).

**Cycle Limit:** Maximum of 3 cycles per error. If VERIFY fails 3 times, escalate to the user.

**Report contract:**
[`.agent/templates/agent-report-contract.md`](../templates/agent-report-contract.md) (sample:
[`agent-report-samples.md`](../templates/agent-report-samples.md)).

## Hard constraints

- Maximum 3 remediation cycles; then escalate (do not loop silently).
- Prefer the minimal atomic fix; do not expand into unrelated refactors.
- Inspect the git working tree first with `git status`. If unrelated edits are present, do **not**
  use destructive rollback. Work in the smallest safe scope, or pause and ask the repository owner
  when edits overlap.

## The 6-State Remediation Machine

### 1. CLASSIFY

Capture the failing command's output and extract structured diagnostic data:

- **Error message** (exact text)
- **File path** and **line number**
- **Error category**: syntax, type, runtime, import, config, test assertion
- **Complexity**: trivial (single-line fix), moderate (multi-file), or complex (architectural)

_Trivial Error Fast-Path Bypass:_ If the error is trivially classifiable (e.g., a missing import,
typo, or unused variable), skip the ROOT_CAUSE state. Proceed directly to EXTRACT_CONTEXT →
DESIGN_FIX → APPLY → VERIFY.

### 2. EXTRACT_CONTEXT

Read the file at the reported line number with ±15 lines of surrounding context. Identify:

- The function or block containing the error
- Related imports and type definitions
- Any recent changes in the area (check `git diff` or `git log -1 -- <file>`)

### 3. ROOT_CAUSE

Explicitly state your hypothesis. If this is cycle 2 or 3, you **must** explain why this new
hypothesis differs from the previous failed attempt.

_BFF/Hydration Guards:_ Check for common failure patterns:

- Missing `client:*` directives on interactive TSX/Astro hooks.
- Server-only variables (`import.meta.env`) escaping into client code.
- Non-serializable objects (Date, Map, Set) being passed from BFF to client without serialization.
- `window` or `document` used directly during SSR without `onMount`/`useEffect`.

### 4. DESIGN_FIX

Propose the minimal atomic fix. _Pre-apply Validation Checks:_

- **WCAG:** Ensure fix doesn't remove `aria-*` or break semantic structure.
- **Token architecture (SCSS only):** Do not overwrite or bypass the three-level token model
  (foundation / semantic / component). See
  [`theme-architecture`](../skills/theme-architecture/SKILL.md) when the failure involves tokens or
  presets.

### 5. APPLY

Modify the files with the proposed atomic fix.

### 6. VERIFY

Re-run the exact failing command (e.g., `pnpm type-check` or `pnpm test`) to confirm the fix.

- **If VERIFY passes:** run **REGRESSION_DECISION** (below), then proceed. Session close and
  validation depth remain owned by [`.agent/rules/gatekeeper.md`](../rules/gatekeeper.md) §5 (tiers
  A/B/C); run `pnpm agent:git-safety:finish` when closing a mutable session.

- **If VERIFY fails:** inspect the new output and decide whether a targeted follow-up edit is safe.
  If the worktree contains overlapping user changes or the rollback would be ambiguous, stop and
  escalate instead of forcing a reset.

Increment cycle counter when verification fails. Return to **CLASSIFY** to analyze the new output.

**Diagnostic card obligation:** Emit the user-facing diagnostic card on VERIFY FAIL, when cycle ≥ 2,
or on escalation. On a clear cycle-1 trivial fix, skip the full card until VERIFY (or use a one-line
CTA only). Do not spam progress cards on every APPLY.

### REGRESSION_DECISION (after VERIFY PASS — not a 7th machine state)

Decide whether this defect class needs a regression lock. Prefer the smallest lock that closes the
invariant. Lock type selection and Invitation Copy Assertions:
[`.agent/skills/testing/SKILL.md`](../skills/testing/SKILL.md).

1. **Classify defect:** `trivial` | `local-behavior` | `shared-contract` | `family-extension`.
2. **Choose lock:** `none` | `extend-existing-test` | `add-focused-test` | `domain-validate` |
   `escalate-test-gap`.
3. **Apply when cheap:** `trivial` → `Lock: none`. For behavior/contract/family defects, extend or
   add a focused lock, or run the relevant domain validate. Prefer one **family invariant** (schema,
   parity, synthetic matrix) over N per-invitation goldens. Locks must be **editor-resilient** (no
   brittle content-coupled asserts) per Invitation Copy Assertions.
4. **Re-VERIFY** the original command plus the related test path after applying a lock. Further
   VERIFY failures still count toward the 3-cycle limit.
5. **Escalate test-gap** when the right lock is large or cross-cutting: use the escalation card with
   test-gap options (below). Do not silently skip the decision.

## Report template

Follow the shared contract. Shape below.

### Diagnostic card (VERIFY FAIL, cycle ≥ 2, or escalate)

```md
# Remediation

**Estado:** CYCLE <n>/3 · VERIFY PASS|FAIL **Error:** <exact message, 1–2 lines> **Dónde:**
`<path>:<line>` · category: <…> · complexity: <trivial|moderate|complex> **Lock:**
<none|extend-existing-test|add-focused-test|domain-validate|escalate-test-gap> — <invariant or none>

## Hipótesis actual

…

## Por qué cambió vs ciclo anterior

… (required when cycle ≥ 2)

## Fix propuesto

… (minimal, atomic)

## Decisión

Re-run: `<exact command>`
```

On clear cycle-1/2 fixes with an obvious next verify step: use a single CTA (re-run command), not an
MCQ.

### Escalation card (cycle 3 VERIFY failure, unsafe / overlapping rollback, or test-gap)

```md
# Escalation — remediation exhausted

**Bloqueante:** <current error or test-gap> **Intentos:** 3 (or test-gap after VERIFY PASS)

**Qué se intentó:**

- C1: …
- C2: …
- C3: …

## Decisión

Se agotaron 3 ciclos sin VERIFY PASS. (Or: lock required but out of safe scope.)

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Pausar e indicar siguiente enfoque**
  - **Objetivo:** Detener ciclos automáticos y registrar el test-gap/bloqueo de forma segura.
  - **Pasos / Ej.:** Registrar invariante de familia o pedir revisión técnica.

- **b)** **Intento adicional acotado**
  - **Objetivo:** Ejecutar un intento final restringido a una superficie pequeña.
  - **Pasos / Ej.:** Mapear únicamente en el adapter o un solo call site.

- **c)** **Revertir cambios de esta remediación**
  - **Objetivo:** Deshacer las modificaciones realizadas durante la remediación si el worktree lo
    permite.
  - **Pasos / Ej.:** Restaurar archivos tocados por la sesión de remediación.
```

**Decision rules for this workflow:**

- No MCQ on clear cycle-1/2 fixes.
- On cycle-3 failure, unsafe rollback, or test-gap: a material decision prompt; **`a` = stop /
  escalate safely** (including ship fix + record gap). Never put destructive reset in `a`. See
  contract.
