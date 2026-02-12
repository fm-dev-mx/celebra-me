---
description: Technical error diagnosis and surgical remediation.
---

# 🔎 Error-Diagnosis & Remediation

1. **Identification**
    - List ALL errors/warnings.
    - Log text, impacted paths, tool (pnpm, Astro, Jest), severity.

2. **Root Cause Analysis (RCA)**
    - Hypothesis: Most likely cause.
    - Context: OS (Windows paths), Runtime (Server vs Client), Bundler conflicts.

3. **Solution Design**
    - Minimal Viable Fix: Smallest diff possible.
    - Side effects check (A11y, 3-Layer Color).

4. **Verification**
    - Done Criteria: Exact command for success (e.g., `pnpm test`).
    - Negative Test: Targeted error must NOT appear.

5. **Post-Execution**
    - Execute as **Atomic Deployable Units (ADUs)** once approved.

// turbo
