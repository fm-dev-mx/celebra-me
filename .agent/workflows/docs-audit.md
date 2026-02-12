---
description: Documentation ecosystem synchronization and drift detection.
---

# 📚 Workflow: Documentation Audit & Sync

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
