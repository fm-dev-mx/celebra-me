---
description: Audits and synchronizes agent skills with the project's current state.
---

# 💎 Workflow: Skills Sync & Alignment

1. **Scan**
    - List skills in `.agent/skills/`.
    - Reference: `ARCHITECTURE.md`, `PREMIUM_UX_VISION.md`.

2. **Structural Audit**
    - Verify YAML frontmatter (`name`, `description`).
    - Fix absolute/relative links.

3. **Technical Sync**
    - **Color**: Enforce 3-Layer Architecture.
    - **Motion**: Enforce Jewelry Box (`premiumFadeUp`).
    - **SCSS**: Prioritize tokens over hex.

4. **Remediation**
    - Fix YAML, update tech references, remove redundant instructions.

5. **Verification**
    - Run build/lint check if scripts/schemas changed.
    - Report with **Architect's Rationale**.

// turbo
