# Agent Discovery Index

This file is the human-readable map for repository guidance and discovery. For machine-readable
context resolution, use `.agent/routing-matrix.yaml` and `.agent/ownership.yaml`. Routing and role
skill lists are candidates: load only the capabilities needed for the task. Apply all rules from
routes matching the touched surfaces.

## Structured Schemas (SSOT)

- [`.agent/ownership.yaml`](./ownership.yaml) — System aspect ownership matrix (SSOT)
- [`.agent/routing-matrix.yaml`](./routing-matrix.yaml) — Context routing matrix per task domain
  (SSOT)
- `.agent/kinds/<tipo>.yaml` — Board task kinds that generate task prompts (T130, see
  [`.agent/rules/board.md`](./rules/board.md))

## Start Here

- [`AGENTS.md`](../AGENTS.md) — Canonical entry point, authority order, and non-negotiable
  boundaries
- [`.agent/rules/gatekeeper.md`](./rules/gatekeeper.md) — Review/remediation contract and validation
  tiers
- [`.agent/rules/git-safety.md`](./rules/git-safety.md) — Task-scoped Git authorization and worktree
  safety
- [`.agent/rules/board.md`](./rules/board.md) — Coordinator board v3: local store, `pnpm board`,
  requisitos, colors, agents and closing (`pnpm board:verify`)
- [`.agent/rules/agent-routing.md`](./rules/agent-routing.md) — Provider-neutral role routing and
  subagent boundaries
- [`.agent/load-skills.md`](./load-skills.md) — Runtime-neutral skill loading protocol

## Role Contracts (`.agent/agents/*.yaml`)

| Role Contract                                                      | Purpose                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| [`celebra-builder`](./agents/celebra-builder.yaml)                 | Code implementation (Astro, TypeScript, SCSS)         |
| [`celebra-copywriter`](./agents/celebra-copywriter.yaml)           | Spanish copy, UI text, and marketing text             |
| [`celebra-qa`](./agents/celebra-qa.yaml)                           | Mobile-first quality review, tests, visual evidence   |
| [`celebra-visual-director`](./agents/celebra-visual-director.yaml) | Visual direction, palettes, art briefs, image prompts |

## Canonical Documentation Overview

### System & Core Architecture

- [`docs/core/architecture.md`](../docs/core/architecture.md) — Core system architecture
- [`docs/core/project-conventions.md`](../docs/core/project-conventions.md) — Project conventions
  and toolchain
- [`docs/core/git-governance.md`](../docs/core/git-governance.md) — Human branch, commit, and
  release policy
- [`docs/core/worktrees/`](../docs/core/worktrees/) — Per-lane operational cards (facts only)
- [`docs/core/content-schema.md`](../docs/core/content-schema.md) — Content collections schema
- [`docs/core/release-process.md`](../docs/core/release-process.md) — Release checkpoints and
  CHANGELOG policy
- [`docs/core/validation-procedures.md`](../docs/core/validation-procedures.md) — Review and
  validation procedures (load on demand)
- [`docs/core/git-safety-session.md`](../docs/core/git-safety-session.md) — Mutable Git Safety
  session lifecycle (load on demand)
- [`docs/core/coordinator-board.md`](../docs/core/coordinator-board.md) — Coordinator board rules:
  action cards, timing, ready-to-paste prompts

### Environments & Database

- [`docs/env-workflow.md`](../docs/env-workflow.md) — Environment hierarchy and credentials
- [`docs/database-workflow.md`](../docs/database-workflow.md) — Human database operational runbook
- [`docs/domains/database/overview.md`](../docs/domains/database/overview.md) — Database schema
  overview
- [`docs/domains/database/cheatsheets/README.md`](../docs/domains/database/cheatsheets/README.md) —
  Concise ops cards + status taxonomy
- [`docs/core/content-parity-rsvp-isolation.md`](../docs/core/content-parity-rsvp-isolation.md) —
  Promote/mirror/parity vs RSVP isolation

### Intake & Client Invitations

- [`docs/core/invitation-creation-contract.md`](../docs/core/invitation-creation-contract.md) —
  Invitation contract: creation order, preparation & readiness, identity, styling, pre-push
- [`docs/domains/intake/production-flow.md`](../docs/domains/intake/production-flow.md) — Invitation
  production runbook
- [`docs/invitations/README.md`](../docs/invitations/README.md) — Per-client invitation Markdown
  state index
- [`docs/domains/invitations/public-response-cache-policy.md`](../docs/domains/invitations/public-response-cache-policy.md)
  — Public and private invitation cache-header contract
- [`docs/domains/invitations/performance-metrics.md`](../docs/domains/invitations/performance-metrics.md)
  — Canonical delivery metrics, budgets, and monitoring

### Theme, RSVP & Attribution

- [Visual design reference](../docs/domains/theme/visual-design-reference.md) — Aesthetic examples
  and invitation hero acceptance; load only for those design tasks.

- [`docs/domains/theme/architecture.md`](../docs/domains/theme/architecture.md) — Theme tokens and
  SCSS architecture
- [`docs/domains/theme/variant-system.md`](../docs/domains/theme/variant-system.md) — Canonical
  section variant inventory
- [`docs/domains/rsvp/architecture.md`](../docs/domains/rsvp/architecture.md) — RSVP and host
  dashboard architecture
- [`docs/domains/rsvp/engagement-analytics.md`](../docs/domains/rsvp/engagement-analytics.md) —
  Guest engagement taxonomy, metrics, and retention
- [`docs/domains/tracking/commercial-attribution.md`](../docs/domains/tracking/commercial-attribution.md)
  — First-party attribution and consent

## Planning & Governance

- Task Contract, Goal protocol, and Handoff Contract: [`.agent/plans/README.md`](./plans/README.md).
- Conversational planning is default. Tracked plans belong under `.agent/plans/active/` per that
  README.
- Point-in-time audits, reports, and completed plans are not tracked; Git history is the archive.
  While a report is in use it lives in `.agent/tmp/reports/` of the Integration checkout
  (`.agent/tmp/README.md`).
- Human-facing agent report layout (review / apply / commit / remediation):
  [`.agent/templates/agent-report-contract.md`](./templates/agent-report-contract.md) (presentation
  only).
