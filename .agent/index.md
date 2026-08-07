# Agent Discovery Index

This file is the human-readable map for repository guidance and discovery. For machine-readable
context resolution, use `.agent/routing-matrix.yaml` and `.agent/ownership.yaml`.

## Structured Schemas (SSOT)

- [`.agent/ownership.yaml`](./ownership.yaml) — System aspect ownership matrix (SSOT)
- [`.agent/routing-matrix.yaml`](./routing-matrix.yaml) — Context routing matrix per task domain
  (SSOT)

## Start Here

- [`AGENTS.md`](../AGENTS.md) — Canonical entry point, authority order, and non-negotiable
  boundaries
- [`.agent/rules/gatekeeper.md`](./rules/gatekeeper.md) — Review/remediation contract and validation
  tiers
- [`.agent/rules/git-safety.md`](./rules/git-safety.md) — Task-scoped Git authorization and worktree
  safety
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
- [`docs/core/content-schema.md`](../docs/core/content-schema.md) — Content collections schema
- [`docs/core/release-process.md`](../docs/core/release-process.md) — Release checkpoints and
  CHANGELOG policy

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
  Creation requirements contract
- [`docs/core/invitation-preparation-contract.md`](../docs/core/invitation-preparation-contract.md)
  — Preparation contract & readiness
- [`docs/domains/intake/production-flow.md`](../docs/domains/intake/production-flow.md) — Invitation
  production runbook
- [`docs/invitations/README.md`](../docs/invitations/README.md) — Per-client invitation Markdown
  state index

## Planning & Governance

- Conversational planning is default. Tracked plans belong under `.agent/plans/active/` per
  [`.agent/plans/README.md`](./plans/README.md).
- Historical audits and reports live under `docs/archive/reports/` and `.agent/plans/archived/`.
- Human-facing agent report layout (review / apply / commit / remediation):
  [`.agent/templates/agent-report-contract.md`](./templates/agent-report-contract.md)
