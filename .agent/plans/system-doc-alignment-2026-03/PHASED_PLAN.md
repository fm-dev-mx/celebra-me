# Phased Execution Plan: System-Doc-Alignment (Calibrated)

**Overall Completion:** [65%]

### ⚖️ Calibrated Calibration Strategy:

- **Architecture**: A-1 (Gold Standard - JSON/Fix CLI)
- **Modularization**: A-2 (Micro-CLI Consolidado: `.agent/governance/bin/governance.js`)
- **Main KPI**: A-3 (Intent Drift - Strategic Logic Alignment)
- **Security**: A-4 (S0 Signature Validation)
- **Double Loop**: C-5 (Manual Bidirectional Sync - Agent-User)
- **DoD**: A-6 (Zero Findings + Verified Signature)
- **The Law**: B-7 (Strict Naming Conventions based on Domain Map)

## Phase 1: Tooling Foundation (The Vault) [Progress: 100%]

- [x] Sub-task 1.1: Baseline manual scan of docs/workflows (Completed previously).
- [x] Sub-task 1.2: **[Delegation]** Create `.agent/governance/bin/governance.js` as a unified entry
      point for `drift`, `audit`, `sign-s0`.
- [x] Sub-task 1.3: Consolidate Gatekeeper, Policy, and Domain Map into the new Vault.
- [x] Sub-task 1.4: Implement S0 Signature logic based on current staged state + git index
      integrity.
- [x] Sub-task 1.5: Create `docs/GOVERNANCE.md` and update `docs/GIT_GOVERNANCE.md`.

## Phase 2: Drift Discovery (Intention & Structure) [Progress: 100%]

- [x] Sub-task 2.1: Implement Intent-Drift Detection (Analyze documents logic vs Code
      implementation).
- [x] Sub-task 2.2: Implement Naming-Convention-Drift Detection (Domain Map validation).
- [x] Sub-task 2.3: Generate report JSON and identify remediation actions for orphans or
      inconsistent links.

## Phase 3: Surgical Execution & Manual Sync [Progress: 30%]

- [x] Sub-task 3.1: Clean up obsolete `task-open` vs `evergreen` workflows (Finished).
- [ ] Sub-task 3.2: Use `governance.js --fix` (or manual intervention) to patch naming issues (Phase
      1/2 naming violations).
- [ ] Sub-task 3.3: Perform manual synchronization (Doble Bucle - C-5) for Intent-Drift items
      (Broken references in docs).

## Phase 4: Final Verification (Zero Findings) [Progress: 10%]

- [x] Sub-task 4.1: Run `pnpm astro check` (Passes baseline).
- [ ] Sub-task 4.2: Execute `pnpm governance audit --report-json` (Goal: Zero Findings).
- [ ] Sub-task 4.3: Verify `docs/DOC_STATUS.md` is updated and reflects "Healthy" for all artifacts.
- [x] Sub-task 4.4: Finalize S0 signature (Seal the current state - First pass done).
