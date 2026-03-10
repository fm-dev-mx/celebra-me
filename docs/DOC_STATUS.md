# Documentation Status Dashboard

**Last Updated:** 2026-03-10 **Next Review:** 2026-04-10 **Maintainer:** Workflow Governance System

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
| [git-governance.md](./core/git-governance.md)           | Active source of truth | 2026-03-03    |
| [project-conventions.md](./core/project-conventions.md) | Active source of truth | 2026-03-03    |
| [premium-ux-vision.md](./core/premium-ux-vision.md)     | Active reference       | 2026-03-06    |
| [testing-strategy.md](./core/testing-strategy.md)       | Active source of truth | 2026-03-03    |

---

## Domain Docs

| Domain   | Document                                           | Status |
| :------- | :------------------------------------------------- | :----- |
| Assets   | [management.md](./domains/assets/management.md)    | Active |
| Content  | [collections.md](./domains/content/collections.md) | Active |
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
- [prompt-to-workflow.md](../.agent/workflows/prompt-to-workflow.md)
- [system-doc-alignment.md](../.agent/workflows/system-doc-alignment.md)
- [theme-architecture-governance.md](../.agent/workflows/theme-architecture-governance.md)

### Active Plans

- [post-alignment-remediation-2026-03](../.agent/plans/post-alignment-remediation-2026-03/README.md) -
  `COMPLETED`, pending archive approval after executing archive cleanup plus `lint` and
  `astro check` remediation.

### Archived Plans

- [invitation-evolution-march-2026](../.agent/plans/archive/invitation-evolution-march-2026/README.md)
- [system-doc-alignment-hardening](../.agent/plans/archive/system-doc-alignment-hardening/README.md)
- [system-health-audit](../.agent/plans/archive/system-health-audit/README.md)
- [system-wide-alignment-audit-2026-03](../.agent/plans/archive/system-wide-alignment-audit-2026-03/README.md)

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

1. Archive `post-alignment-remediation-2026-03` after owner approval.
2. Keep `docs/DOC_STATUS.md` synchronized whenever plans move between active and archive.
3. Run `pnpm ops check-links` and `pnpm ops validate-schema` for every documentation or theme
   governance PR.
