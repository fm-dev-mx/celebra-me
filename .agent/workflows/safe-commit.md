---
description: Minimal staged-only gatekeeper to detect blockers and drift.
---

# Workflow: Staged Gatekeeper (Minimal)

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
