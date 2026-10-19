---
name: publish-production
description:
  Publish an identified code release from develop through a protected main PR and verify Production.
domain: workflow
version: 1.1.0
when_to_use:
  - User explicitly invokes publish-production to execute a code release
preconditions:
  - AGENTS.md
  - .agent/rules/git-safety.md
  - .agent/rules/gatekeeper.md
  - docs/core/release-execution.md
related_skills:
  - publish-preview
  - branch-lane
  - production-pr
related_docs:
  - docs/core/release-process.md
  - docs/core/git-governance.md
---

# Publish Production

Execute [the shared release procedure](../../../docs/core/release-execution.md) with target
`production`. Reuse already completed Preview integration; do not republish an unchanged release.

## Invocation authority

Explicit invocation includes the scoped staging, ordinary commits, task-branch creation, permitted
branch switches, non-destructive integration, fetch and push to `develop`, and automatic Preview
deployment documented by `publish-preview` when needed. It additionally authorizes creation or
update of the exact `develop` → `main` release PR, its merge after all protected-branch requirements
pass, the resulting automatic Production deployment, and read-only deployment/smoke verification.
Preserve meaningful commits and use the allowed merge method. Never push or commit directly to main.
Supporting skills inherit this request; do not stop after opening the PR or ask again to merge it.
If the release needs an owner decision outside this authority (for example an unclear range or a
gated migration), gather every such decision and ask them in one round before the first write, per
the [report contract](../../templates/agent-report-contract.md); ask again only when new evidence
appears. Each gate in this skill keeps its explicit approval.

Create or update that PR only through [production-pr](../production-pr/SKILL.md), the canonical PR
procedure; this skill adds the merge and deployment verification. Identify all included
commits/files before acting. A release PR includes the entire branch range; unreviewed or
out-of-scope changes block it. General review completion does not replace exact artifact-specific
visual approval or required GitHub reviews.

## Exclusions and completion

No tags/version cuts unless separately requested; no migration, persistent DB mutation, invitation
content/assets publication, fixture provisioning, visual-reference acceptance, protection/settings
changes, bypasses, force pushes, history rewrites, or destructive cleanup. Missing required schema
compatibility is a blocker, not permission to migrate.

Finish only after verifying the actual merged `main` SHA, correct Production Worker/environment,
uploaded and activated Worker version, serving alias, and correlated smoke. The merged SHA may
differ from the reviewed develop SHA; report both. Follow shared stop/recovery rules if incomplete.
