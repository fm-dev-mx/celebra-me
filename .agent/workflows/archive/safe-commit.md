---
description: ARCHIVED - Consolidated into gatekeeper-commit.md
archived: 2026-02-12
replacement: .agent/workflows/docs/gatekeeper-commit.md
---

# [ARCHIVED] Workflow: Staged Gatekeeper (Minimal)

> **⚠️ THIS WORKFLOW HAS BEEN ARCHIVED**
>
> **Date**: 2026-02-12  
> **Reason**: Consolidated with `atomic-ui-commit.md` into unified `gatekeeper-commit.md`  
> **Replacement**: Use `.agent/workflows/docs/gatekeeper-commit.md` with `--minimal` mode

---

## Original Content (Preserved for Reference)

1. **Authority**
    - `.agent/*` (Source of Truth).
    - Guards: `git diff --cached` ONLY. NO `git add .` or `git commit -a`.

2. **Phase 0: Scope Lock**
    - `git diff --name-status --cached`: If empty, STOP.
    - Classify: Docs vs Code/Config.

3. **Phase 1: Diagnose**
    - **Findings** (Blocker / Should / FYI):
        - Inline styles, utility CSS, forbidden patterns.
        - Logging: Only in `logs/`.
        - Docs: Missing TSDoc in English for complex logic.
        - SCSS: Anti-patterns.
    - Propose minimal staged-only fixes (describe only).

4. **Phase 2: Fix (Approved Only)**
    - Apply approved fixes -> `git add` -> Re-confirm scope.

5. **Phase 3: Ready to Commit**
    - Propose Conventional Commit message.
    - Summarize each file (what & why).

// turbo

> [!IMPORTANT] Propose ADUs before editing. NO commit execution until finalized.
