---
description:
    Governance and synchronization of technical documentation with the current system state.
lifecycle: evergreen
domain: governance
owner: system-agent
last_reviewed: 2026-02-15
---

# 🛠️ Workflow: System Documentation Alignment

This workflow ensures that technical documentation (ADRs, Architecture, Status) remains in sync with
the actual code implementation, preventing "documentation drift."

## Phase 1: Drift Audit (Code vs. Docs)

1.  **Validate File Structure**:
    - Compare the project's physical structure against definitions in `docs/ARCHITECTURE.md`.
    - Identify new or moved modules not reflected in documentation.
2.  **Verify Documentation Status**:
    - Review `docs/DOC_STATUS.md` to ensure all listed files exist and their paths are correct.
    - Identify orphaned or outdated documents.
3.  **Detect Logic Changes**:
    - Scan for discrepancies between implemented business logic and descriptions in ADRs
      (`docs/architecture/*.md`).

## Phase 2: Artifact Synchronization

1.  **Update `docs/DOC_STATUS.md`**:
    - Correct paths and documentation health statuses based on findings from Phase 1.
2.  **Maintain Implementation Log**:
    - Record significant architectural or governance changes in `docs/implementation-log.md`.
3.  **Update Specifications**:
    - Ensure specification documents exist for any newly added features (e.g., RSVP, Themes, or
      APIs).

## Phase 3: Data Integrity Validation

1.  **Validate Content Schemas**:
    - Ensure schemas in `src/content/config.ts` align with technical documentation and business
      requirements.
2.  **Verify Data Consistency**:
    - Check that content files (`src/content/**/*.json`, `*.md`) comply with validated schemas.

## Phase 4: Technical Verification & Closure

1.  **Run Astro Technical Check**:
    ```bash
    pnpm astro check
    ```
2.  **Integrity Testing**:
    - Execute relevant schema or integration tests to ensure alignment hasn't broken data contracts.
3.  **Update Workflow Metadata**:
    - Update the `last_reviewed` date in this file if process changes were made.

// turbo-all

> [!IMPORTANT] This workflow is iterative. If a major change altering the project's vision is
> detected, prioritize creating a new ADR before proceeding with mass synchronization.
