# Changelog: System Documentation Semantic Alignment Plan

Deterministic audit trail for `system-doc-semantic-alignment-2026-03`.

---

## [Unreleased]

### Phase 01: Baseline And Scope Lock

- **Baseline locked:** Confirmed evergreen drift in architecture, RSVP, content governance, and the
  dashboard inventory while preserving historical audits as time-bound records. (Completed:
  2026-03-17 17:31)
- **Scope policy fixed:** Locked this run to active docs plus minimal historical context framing,
  with completed top-level plans remaining documented in place pending archive handoff. (Completed:
  2026-03-17 17:31)

### Phase 02: Evergreen Architecture And Domain Alignment

- **Core architecture realigned:** Rewrote `docs/core/architecture.md` to reflect the current route
  tree, active server-only hubs, live invitation access patterns, and RSVP architecture. (Completed:
  2026-03-17 17:31)
- **RSVP docs corrected:** Rebuilt `docs/domains/rsvp/architecture.md` and
  `docs/domains/rsvp/status.md` around the current `/api/invitacion/**`,
  `/{eventType}/{slug}/invitado`, and `/{eventType}/{slug}/i/{shortId}` contracts. (Completed:
  2026-03-17 17:31)
- **Theme governance aligned:** Updated `docs/domains/content/event-governance.md` so supported
  presets match `src/lib/theme/theme-contract.ts` while distinguishing baseline vs premium/event
  specific presets. (Completed: 2026-03-17 17:31)

### Phase 03: Dashboard And Governance Reconciliation

- **Dashboard reconciled:** Updated `docs/DOC_STATUS.md` so top-level plan statuses match manifest
  reality, including completed-but-not-archived plans. (Completed: 2026-03-17 17:31)
- **Review queue refreshed:** Removed stale tracking language for completed work and updated the
  next-review queue to the real outstanding archival follow-up. (Completed: 2026-03-17 17:31)

### Phase 04: Historical Context Safeguards

- **Historical framing added:** Added an explicit historical snapshot note to
  `docs/audit/doc-audit-report.md` so it cannot be misread as a current evergreen source of truth.
  (Completed: 2026-03-17 17:31)

### Phase 05: Verification And Closure

- **Validation passed:** `pnpm astro check` completed with 0 errors, 0 warnings, and 0 hints, and
  `pnpm lint` completed successfully. (Completed: 2026-03-17 17:31)
- **Reference verification passed:** Re-searched evergreen docs for the known invalid current-state
  references and confirmed only explicitly historical notes remain. (Completed: 2026-03-17 17:31)
- **Plan finalized:** Marked `system-doc-semantic-alignment-2026-03` as `COMPLETED` and synced all
  plan tracking artifacts. (Completed: 2026-03-17 17:31)

---

> Entries follow reverse-chronological order within each phase. Format:
> `**{Action}:** {Description} (Completed: YYYY-MM-DD HH:MM)`
