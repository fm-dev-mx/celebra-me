---
name: publish-preview
description:
  Publish an identified code release to Preview through develop and verify its deployment.
domain: workflow
version: 1.0.0
when_to_use:
  - User explicitly invokes publish-preview to execute a code release
preconditions:
  - AGENTS.md
  - .agent/rules/git-safety.md
  - .agent/rules/gatekeeper.md
  - docs/core/release-execution.md
related_skills:
  - branch-lane
  - commit-planner
related_docs:
  - docs/core/release-process.md
  - docs/core/git-governance.md
---

# Publish Preview

Execute [the shared release procedure](../../../docs/core/release-execution.md) with target
`preview`, integration branch `develop`. This is one end-to-end invocation, including verification.

## Invocation authority

Explicit invocation authorizes, for the identified release scope in the assigned checkout: fetching
origin; staging named in-scope files; ordinary commits with normal hooks; creating a task branch
when needed; switching branches when permitted by the assigned lane; non-destructive branch
integration into `develop`; pushing that exact `develop` ref; and its automatic Vercel Preview
deployment. It also includes read-only provider inspection, required checks, and read-only Preview
smoke. Reuse this authority through supporting skills; never prompt again for these actions.

Inspect and state the commit/file boundary first. Ambiguous scope or unrelated staged work blocks
execution, not a reason to commit everything. A task-branch push is not a substitute for integration
CI on `develop`. Do not operate in another checkout or silently change an assigned lane.

## Exclusions and completion

No Production promotion, tags, migration or persistent DB mutation, invitation content/assets
publication, fixture provisioning, visual-reference acceptance, destructive cleanup, history
rewrites, hook bypasses, or remote settings changes. Candidate generation is permitted only as
diagnostic review preparation; it cannot approve itself.

Finish only after the exact integrated SHA has required CI, a ready Preview deployment in the
correct project, and passing applicable read-only smoke. Report the SHA, deployment ID/URL,
environment, checks and residual risks. Follow shared stop/recovery rules when blocked.
