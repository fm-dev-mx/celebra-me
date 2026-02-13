---
description: ARCHIVED - Moved to docs/ folder and enhanced
description: Documentation ecosystem synchronization and drift detection.
archived: 2026-02-12
replacement: .agent/workflows/docs/docs-audit.md
---

# [ARCHIVED] Workflow: Documentation Audit & Sync

> **⚠️ THIS WORKFLOW HAS BEEN ARCHIVED**
>
> **Date**: 2026-02-12  
> **Reason**: Moved to `.agent/workflows/docs/` and significantly enhanced with validation,
> remediation guidance, and comprehensive coverage  
> **Replacement**: Use `.agent/workflows/docs/docs-audit.md` for all documentation audits

---

## Original Content (Preserved for Reference)

1. **Gatekeeper (Vision Check)**
    - Check `docs/PREMIUM_UX_VISION.md`. Ensure "Aesthetic Presets" and "Typography" match `src/`.

2. **Scope Mapping**
    - **Root**: `README.md`.
    - **Docs**: `docs/**/*.md` (Full tree).
    - **Verify**: Cross-reference doc claims against `src/` code.

3. **Lifecycle**
    - **Root**: Update in place (install steps, project structure).
    - **Plans (`docs/plan/*`)**:
        - Move to `archive/` if 100% complete.
        - Extract pending items to `docs/plan/technical-debt.md`.
    - **General Docs**: Flag redundant/obsolete files.

4. **Reporting**
    - Categorize in `docs/audit-report-YYYY-MM.md`:
        - 🔴 **Critical Drift**: Setup/Architecture errors.
        - 🟡 **Stale Content**: Deprecated phrasing.
        - 🟢 **Synced**: Verified Source of Truth.

// turbo

> [!IMPORTANT] Update Root docs in place; archive completed plans; report drift using 🔴/🟡/🟢.
