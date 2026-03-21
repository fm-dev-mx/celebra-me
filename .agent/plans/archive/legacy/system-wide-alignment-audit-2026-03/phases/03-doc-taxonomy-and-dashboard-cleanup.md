# Phase 03: Doc Taxonomy and Dashboard Cleanup

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Eliminate docs-root drift, move misplaced files into governed locations, and rebuild
the dashboard as the source of truth.

**Weight:** 20% of total plan

---

## Analysis / Findings

- `docs/CONTENT_COLLECTIONS.md`, `docs/implementation-log.md`, and `docs/STABILITY.md` were
  misplaced at the docs root.
- `docs/DOC_STATUS.md` omitted real active plans and several live docs.
- Directory-scoped READMEs existed outside `docs/` and needed explicit classification rather than
  forced migration.

---

## Execution Tasks [STATUS: COMPLETED]

### Taxonomy Cleanup

- [x] Moved `docs/CONTENT_COLLECTIONS.md` to `docs/domains/content/collections.md`. (Completed:
      2026-03-10 12:49)
- [x] Moved `docs/implementation-log.md` to `docs/audit/implementation-log.md` and marked it
      historical. (Completed: 2026-03-10 12:49)
- [x] Moved `docs/STABILITY.md` to `docs/audit/stability.md` and marked it historical. (Completed:
      2026-03-10 12:49)

### Dashboard

- [x] Rebuilt `docs/DOC_STATUS.md` around the current taxonomy. (Completed: 2026-03-10 12:49)
- [x] Registered both top-level plan directories under active plans, including the deferred archive
      item. (Completed: 2026-03-10 12:49)
- [x] Classified `scripts/README.md`, `tests/README.md`, `src/styles/events/README.md`, and
      `tracking/README.md` in the audit report. (Completed: 2026-03-10 12:49)

---

## Acceptance Criteria

- [x] `docs/` root contains only `DOC_STATUS.md`. (Completed: 2026-03-10 12:49)
- [x] Dashboard links match the current filesystem layout. (Completed: 2026-03-10 12:49)

---

## References

- [docs/DOC_STATUS.md](../../../../../docs/DOC_STATUS.md)
- [docs/audit/system-wide-alignment-audit-2026-03-10.md](../../../../../docs/audit/system-wide-alignment-audit-2026-03-10.md)
