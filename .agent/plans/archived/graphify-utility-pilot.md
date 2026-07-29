---
title: Graphify utility pilot
status: final
created: 2026-07-28
updated: 2026-07-28
related_skills: []
related_docs:
  - AGENTS.md
  - docs/archive/reports/graphify-pilot-01-intake-coupling-2026-07-28.md
  - docs/archive/reports/graphify-pilot-02-blast-radius-2026-07-28.md
  - docs/archive/reports/graphify-pilot-03-orphan-candidates-2026-07-28.md
  - docs/archive/reports/graphify-utility-pilot-verdict-2026-07-28.md
supersedes: []
---

# Graphify utility pilot

Read-only usefulness experiment: three Graphify audits (intake coupling, draft-preview blast radius,
RSVP orphans) plus a rollup verdict. No product code changes.

## Status checklist

- [x] Baseline refresh (`pnpm ops graphify-refresh`) and freshness check
- [x] Audit 01 — intake ↔ publishing coupling
- [x] Audit 02 — blast radius of `draft-preview-helper.ts`
- [x] Audit 03 — RSVP orphan candidates
- [x] Rollup verdict + archive this tracker

## Verdict (summary)

Keep Graphify as an occasional local ops tool. Operational risk hubs were partially useful; NL
query/path was not. See
[`docs/archive/reports/graphify-utility-pilot-verdict-2026-07-28.md`](../../../docs/archive/reports/graphify-utility-pilot-verdict-2026-07-28.md).

## Explicit non-goals

- No remediation, predicate updates, CI wiring, or authority promotion of Graphify
