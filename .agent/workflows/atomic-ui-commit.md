---
description: Strict architecture gatekeeper (Astro, React, SCSS, TS).
---

# Workflow: Atomic Gatekeeper (Strict)

1. **Guards (Blockers)**
    - Repo must stay **deployable**.
    - **No inline styles** or utility CSS (Tailwind).
    - Respect Astro server/client boundaries.
    - Casing: Correct Linux/Vercel paths.
    - Logs: Must be in `logs/`.

2. **Quality (Majors)**
    - **JSDoc/TSDoc**: English for complex logic.
    - **Commits**: Conventional + English "why".
    - **Anti-Noise**: No trivial comments.

3. **Phase 0: Scope**
    - Scan staged/unstaged for blockers.
    - Detect mixed intents (split if needed).

4. **Phase 1: Decompose**
    - Group into **Atomic Deployable Units (ADUs)**.
    - **1 ADU = 1 commit**.

5. **Phase 2: Execute**
    - Isolate ADU -> Apply Auto-fixes -> Validate -> Commit.

// turbo

> [!IMPORTANT] Propose ADUs before editing. Fix blockers/majors on approval.
