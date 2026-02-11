---
description: Deep analysis and surgical remediation of technical errors (System tool).
---

# 🔎 Error-Diagnosis & Remediation Workflow

Use this workflow to analyze, diagnose, and resolve reported errors with precision, ensuring
architectural integrity and minimal side effects.

## 🧭 Strategic Context

- **Role**: Senior Error-Diagnosis and Remediation Specialist.
- **Goal**: Resolve regressions, build failures, or runtime exceptions using the **Scientific
  Method**.
- **Values**: Precision > Speed, Architectural Alignment, Minimal Footprint.

---

## 🛠️ Execution Phases

### PHASE 1 — Error Identification

1. **Extract & List**: Identify ALL errors and warnings from logs, stack traces, or screenshots.
2. **Normalization**: For each error, provide:
    - **Message**: Exact text.
    - **Files**: Impacted paths.
    - **Environment**: Tooling (pnpm, Astro, Vite, Jest, etc.).
    - **Severity**: Blocking vs. Non-blocking.
3. **Inventory**: Create a clean list of findings. Do NOT infer causes yet.

### PHASE 2 — Root Cause Analysis (RCA)

1. **Hypothesis**: For each error, identify the most likely root cause.
2. **Contextual Variables**:
    - **OS Differences**: Windows paths vs. POSIX, case sensitivity.
    - **Runtimes**: Server-rendering (Astro) vs. Client-side (React/Vanilla JS).
    - **Build Systems**: Bundler constraints or dependency conflicts.
3. **Weighting**: If multiple causes are possible, rank them by likelihood.
4. **Assumptions**: Explicitly list what you are assuming.

### PHASE 3 — Solution Design

1. **Minimal Viable Fix**: Propose the solution with the smallest possible diff.
2. **Rationale**: Explain WHY the fix resolves the RCA.
3. **Impact Audit**:
    - Potential side effects or regressions?
    - Does it break established design tokens or 3-layer color architecture?
4. **Affected Files**: List exact paths and describe the change (no code yet).

### PHASE 4 — Validation Checklist

Define the "Done" criteria:

- **Command**: Exact shell command to verify (e.g., `pnpm run build`, `pnpm test [file]`).
- **Success Event**: Specific output expected.
- **Negative Test**: What error message should specifically NOT appear.

### PHASE 5 — Prevention (Optional)

- Suggest structural config changes (e.g., `.editorconfig`, `tsconfig.json`) IF they prevent the
  same class of error from recurring.
- Avoid unnecessary refactors unless the logic is inherently fragile.

---

## 🏁 Post-Execution

- Output: "Ready to apply fixes" or "Additional information required".
- **ADU Strategy**: Once approved, execute fixes as Atomic Deployable Units (ADUs).

// turbo
