---
description: ARCHIVED - Generic workflow, superseded by quality gates in other workflows
archived: 2026-02-12
replacement: Use verification steps within each workflow or gatekeeper-commit.md
---

# [ARCHIVED] Workflow: Invitation Verification

> **⚠️ THIS WORKFLOW HAS BEEN ARCHIVED**
>
> **Date**: 2026-02-12  
> **Reason**: Verification steps now integrated into individual workflows and gatekeeper  
> **Replacement**: Use `gatekeeper-commit.md` with verification phases or include verification in
> task workflows

---

## Original Content (Preserved for Reference)

Use this workflow immediately after an ADU has been implemented to ensure zero-defect delivery.

## 🛠️ Verification Steps

1. **Schema & Build Integrity**:
    - Run `pnpm build` (or equivalent) to ensure no breaking changes in Content Collections.
    - Validate that the JSON data matches the TypeScript interfaces.

2. **Aesthetic Scan**:
    - **Colors**: Are the hex codes using the active plan's palette (e.g., `#4B3621`, `#D4AF37`)?
    - **Typography**: Are headings using the robust Serif font specified in the plan?
    - **Spacing**: Verify one-section-per-viewport behavior.

3. **Thematic Verification**:
    - Is the specific theme (Cowboy, XV Años, etc.) presented as "Premium" (e.g., subtle textures,
      elegant icons) vs "Generic"? (Skill: `animation-motion`)
    - Is the core theme element (e.g., Dress Code, Iconography) clearly visible?

4. **Accessibility Check**: (Skill: `accessibility`)
    - Verify `ReducedMotion` support if animations were added/modified.
    - Check contrast ratios for background/text.

5. **Final Log Entry**:
    - If passed, update the Implementation Log in the Master Plan to `Verified` and add the date.
    - If failed, revert or fix before marking as complete.

// turbo

## Agent Instruction

Execute a full verification of the latest ADU. Check schema, build, aesthetics, and accessibility.
Update the log to `Verified` if all checks pass. Capture a screenshot if visual changes were made.
