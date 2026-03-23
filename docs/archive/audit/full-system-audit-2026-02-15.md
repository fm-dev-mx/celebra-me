# System-Documentation Alignment Audit (Feb 2026)

> **Historical Summary:** This file is retained as the compact historical summary after raw audit
> logs and stale audit drafts were removed during the 2026-03-22 documentation cleanup. Keep it for
> historical context only, not as the live source of truth for current paths or plan inventory.

## 1. Critical Findings Summary

### A. Governance "Ghost Desynchronization"

- **Problem**: `docs/DOC_STATUS.md` and `docs/implementation-log.md` report a massive reorganization
  of folders in `.agent/workflows/` (e.g., `governance/`, `sync/`, `audits/`) that DOES NOT exist in
  the filesystem.
- **Impact**: High confusion when searching for operational guides; canonical paths are broken.
- **Actual State**: Workflows are located in `.agent/workflows/evergreen/` and
  `.agent/workflows/task-open/`.

### B. Architectural Gap in Itinerary

- **Problem**: Although themed styles exist for `Itinerary`, the section is not formally integrated
  into the `sectionStyles` system.
- **Inconsistencies**:
    - `src/content/config.ts` DOES NOT include `itinerary` in `sectionStyles`.
    - `src/pages/[eventType]/[slug].astro` passes the global `preset` as a `variant` to the Itinerary
      instead of a specific section configuration.
    - `src/content/events/demo-xv.json` has `variant` directly within the `itinerary` object,
      while `config.ts` prefers (for other sections) that it be in `sectionStyles`.

### C. Orphaned RSVP Evolution (WhatsApp)

- **Problem**: The `RSVP.tsx` component has been recently updated with support for split templates
  (`confirmedTemplate`, `declinedTemplate`) and `omitTitle`, but this capability HAS NOT been
  reflected in:
    - `src/content/config.ts` (Schema validation will fail if these fields are used).
    - `docs/domains/theme/architecture.md` (Incomplete technical documentation).
    - `docs/domains/rsvp/status.md` (Implementation status not updated).

### D. Hardcoding in Routes

- **Problem**: `src/pages/[eventType]/[slug].astro` contains logic conditioned on
  `eventType === 'cumple'` to inject RSVP labels.
- **Impact**: Breaks the "Data-driven architecture" principle. It should be resolved via
  `sectionStyles.rsvp.labels` or similar.

---

## 2. Inventory of Outdated/Redundant Documentation

| File                   | Status            | Finding                                                                              |
| :--------------------- | :---------------- | :----------------------------------------------------------------------------------- |
| `docs/DOC_STATUS.md`   | ❌ Critical       | Reports 55 workflows; only ~5 active ones exist. Broken paths.                       |
| `docs/domains/theme/architecture.md` | ⚠️ Outdated       | Example `sectionStyles` schema does not match `config.ts`. Omits `itinerary`.        |
| `docs/domains/rsvp/status.md`  | ⚠️ Incomplete     | Does not mention new WhatsApp template capabilities (Tier 3).                        |
| `docs/core/architecture.md` | 🟢 Healthy        | Remains a solid foundation but RSVP label isolation should be reinforced.             |

---

## 3. Audit Plan (Final Verification)

1. **[ ] Schema Audit**: Validate that all new WhatsApp fields in `RSVP.tsx` are added to `config.ts`
   to avoid Astro compilation errors.
2. **[ ] Variant Propagation Audit**: Verify in the browser that `Itinerary` is correctly receiving
   the `variant` and applying styles from `_itinerary-theme.scss`.
3. **[ ] Workflow Audit**: Identify which "ghost" workflows in `DOC_STATUS.md` need to be recovered
   and which should be removed from documentation.

---

## 4. Resolution Plan (Blueprint)

### Phase 1: Governance Synchronization (Docs-First)

- **Goal**: Documentation must reflect the truth about the repository state.
- **Steps**:
    1. Correct all paths in `DOC_STATUS.md` and `implementation-log.md` to reflect the actual
       structure (`evergreen/`, `task-open/`).
    2. Remove mentions of non-existent workflows in `DOC_STATUS.md`.

### Phase 2: Itinerary and Gallery Alignment

- **Goal**: Standardize the use of `sectionStyles`.
- **Steps**:
    1. Update `src/content/config.ts` to include `itinerary` and `gallery` within `sectionStyles`.
    2. Migrate data in `demo-xv.json` and `gerardo-sesenta.json` so that the `variants` for these
       sections are under `sectionStyles`.
    3. Update `[slug].astro` to pass `data.sectionStyles.itinerary.variant`.

### Phase 3: RSVP and WhatsApp Hardening

- **Goal**: Officially support new templates sent by the user.
- **Steps**:
    1. Add `confirmedTemplate`, `declinedTemplate`, and `omitTitle` to the `whatsappConfig` schema in
       `config.ts`.
    2. Move custom labels for "Gerardo 60" from the route code (`[slug].astro`) to the corresponding
       JSON files via `data.sectionStyles.rsvp`.

### Phase 4: Documentation Closure

- **Goal**: Update theme manuals and status reports.
- **Steps**:
    1. Update `THEME_SYSTEM.md` with new RSVP and Itinerary section capabilities.
    2. Update `RSVP_STATUS.md` marking Tier 3 (Advanced Templates) as completed.

---

## 5. Conserved Historical Summary

- The repository had repeated drift between `docs/`, `.agent/`, and the live filesystem during
  February and March 2026.
- The recurring failure mode was duplicated governance context: old workflow trees, stale plan
  inventory, and architecture notes that lagged behind route and domain refactors.
- The durable lesson is to keep one source of truth per topic:
  - `docs/` for canonical documentation
  - `.agent/plans/README.md` for plan governance
  - active domain docs for implementation reality
- Raw execution logs, operational prompts, and superseded audit drafts were intentionally removed in
  favor of this compact historical summary.
