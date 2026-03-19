# Documentation Status Dashboard

**Last Updated:** 2026-03-19 **Next Review:** 2026-04-18 **Maintainer:** Workflow Governance System

---

## Health Snapshot

- Links: `pnpm ops check-links` passing as of 2026-03-10.
- Staleness: `pnpm ops find-stale 180` passing as of 2026-03-10.
- Schema parity: `pnpm ops validate-schema` passing with zero warnings as of 2026-03-10.
- Verification: `pnpm astro check` passed with 0 errors, 0 warnings, and 0 hints; `pnpm lint` passed
  with 0 warnings and 0 errors.
- Active plan inventory: top-level plans are tracked below exactly as they exist under
  `.agent/plans/`, excluding `archive/`.

---

## Core Docs

| Document                                                | Status                 | Last Reviewed |
| :------------------------------------------------------ | :--------------------- | :------------ |
| [architecture.md](./core/architecture.md)               | Active source of truth | 2026-02-15    |
| [content-schema.md](./core/content-schema.md)           | Active source of truth | 2026-03-17    |
| [git-governance.md](./core/git-governance.md)           | Active source of truth | 2026-03-15    |
| [project-conventions.md](./core/project-conventions.md) | Active source of truth | 2026-03-03    |
| [premium-ux-vision.md](./core/premium-ux-vision.md)     | Active reference       | 2026-03-06    |
| [testing-strategy.md](./core/testing-strategy.md)       | Active source of truth | 2026-03-03    |

---

## Domain Docs

| Domain   | Document                                           | Status |
| :------- | :------------------------------------------------- | :----- |
| Assets   | [management.md](./domains/assets/management.md)    | Active |
| Content  | [collections.md](./domains/content/collections.md) | Active |
| Content  | [event-governance.md](./domains/content/event-governance.md) | Active |
| RSVP     | [architecture.md](./domains/rsvp/architecture.md)  | Active |
| RSVP     | [database.md](./domains/rsvp/database.md)          | Active |
| RSVP     | [status.md](./domains/rsvp/status.md)              | Active |
| Security | [roadmap.md](./domains/security/roadmap.md)        | Active |
| Theme    | [architecture.md](./domains/theme/architecture.md) | Active |
| Theme    | [typography.md](./domains/theme/typography.md)     | Active |

---

## Architecture and Audit Docs

### Architecture Proposals

- [refactor-proposal.md](./architecture/refactor-proposal.md)
- [skills-evolution-plan.md](./architecture/skills-evolution-plan.md)

### Audit and Historical Reports

- [doc-audit-report.md](./audit/doc-audit-report.md)
- [full-system-audit-2026-02-15.md](./audit/full-system-audit-2026-02-15.md)
- [gatekeeper-commit-hardening.md](./audit/gatekeeper-commit-hardening.md)
- [implementation-log.md](./audit/implementation-log.md) - Historical log
- [ops-health-report.md](./audit/ops-health-report.md)
- [stability.md](./audit/stability.md) - Historical report
- [system-wide-alignment-audit-2026-03-10.md](./audit/system-wide-alignment-audit-2026-03-10.md)

---

## Workflows

### Evergreen

- [auto-fix.md](../.agent/workflows/auto-fix.md)
- [error-remediation.md](../.agent/workflows/error-remediation.md)
- [gatekeeper-commit.md](../.agent/workflows/gatekeeper-commit.md)
- [system-doc-alignment.md](../.agent/workflows/system-doc-alignment.md)
- [theme-architecture-governance.md](../.agent/workflows/theme-architecture-governance.md)

### Active Plans

- [audit-SR-2026-03](../.agent/plans/audit-SR-2026-03/README.md) - `IN-PROGRESS`, strategic audit plan with one remaining naming/alignment phase.
- [fix-demo-cumple-colors](../.agent/plans/fix-demo-cumple-colors/README.md) - `IN-PROGRESS`, visual validation handoff after the invitation assembly simplification.
- [project-simplification](../.agent/plans/project-simplification/README.md) - `IN-PROGRESS`, active simplification and de-engineering implementation record.

### Archived Plans

- [comprehensive-audit-Q1-2026](../.agent/plans/archive/comprehensive-audit-Q1-2026/README.md)
- [error-remediation-evolution](../.agent/plans/archive/error-remediation-evolution/README.md) -
  `ARCHIVED`, systematic hardening of diagnostic automation and zero-loop remediation.
- [event-transformation-gerardo](../.agent/plans/archive/event-transformation-gerardo/README.md)
- [gatekeeper-commit-message-hardening](../.agent/plans/archive/gatekeeper-commit-message-hardening/README.md)
- [gatekeeper-optimization](../.agent/plans/archive/gatekeeper-optimization/README.md)
- [gatekeeper-workflow-commit-fixes](../.agent/plans/archive/gatekeeper-workflow-commit-fixes/README.md)
- [invitation-evolution-march-2026](../.agent/plans/archive/invitation-evolution-march-2026/README.md)
- [master-finalization-2026](../.agent/plans/archive/master-finalization-2026/README.md)
- [post-alignment-remediation-2026-03](../.agent/plans/archive/post-alignment-remediation-2026-03/README.md)
- [pre-phase-audit-2026](../.agent/plans/archive/pre-phase-audit-2026/README.md)
- [real-xv-invitation](../.agent/plans/archive/real-xv-invitation/README.md) - `ARCHIVED`, Ximena
  Meza Trasviña XV Editorial Finalization.
- [quinceanera-demo-creation](../.agent/plans/archive/quinceanera-demo-creation/README.md)
- [retheme-ximena-rose-gold](../.agent/plans/archive/retheme-ximena-rose-gold/README.md)
- [system-doc-alignment-hardening](../.agent/plans/archive/system-doc-alignment-hardening/README.md)
- [system-health-audit](../.agent/plans/archive/system-health-audit/README.md)
- [system-wide-alignment-audit-2026-03](../.agent/plans/archive/system-wide-alignment-audit-2026-03/README.md)
- [wedding-demo-scaffold](../.agent/plans/archive/wedding-demo-scaffold/README.md)
- [wedding-finalization](../.agent/plans/archive/wedding-finalization/README.md)
- [ximena-overhaul](../.agent/plans/archive/ximena-overhaul/README.md)
- [xv-demo-premium-audit-2026-03](../.agent/plans/archive/xv-demo-premium-audit-2026-03/README.md)

---

## Governance Notes

1. Markdown sources of truth must live in one of these locations: `docs/core/`, `docs/domains/`,
   `docs/architecture/`, `docs/audit/`, or `.agent/`.
2. `docs/DOC_STATUS.md` is the only allowed root-level dashboard exception under `docs/`.
3. Local README files under `scripts/`, `tests/`, and `src/styles/events/` are allowed as
   directory-scoped operational docs and are not mirrored here unless they become project-wide
   sources of truth.
4. Use `kebab-case.md` for all documentation files except standard repository files such as
   `README.md`, `CHANGELOG.md`, and `CONTRIBUTING.md`.
5. Gatekeeper and documentation mappings are configured from `.agent/governance/config/policy.json`.

---

## Next Review Queue

1. Keep `docs/DOC_STATUS.md` synchronized whenever plans move between active and archive.
2. Re-verify plan inventory whenever new top-level plan directories are created under
   `.agent/plans/`.
3. Run `pnpm ops check-links` and `pnpm ops validate-schema` for every documentation or theme
   governance PR.
