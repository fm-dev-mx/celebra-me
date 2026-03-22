# Phase 05: Governance Tooling Hardening

## Objective

Reduce complexity in governance and support scripts so repository tooling complies with the same
lint baseline as product code.

## Target Areas

- `.agent/governance/bin/commit-message-analysis.mjs`
- `.agent/governance/bin/validate-commit-plan.mjs`
- `.agent/scripts/error-classifier.mjs`

## Planned Actions

- Split monolithic validators into smaller rule-level functions.
- Normalize parsing and validation stages.
- Keep CLI behavior stable while simplifying control flow.

## Exit Criteria

- Governance tooling no longer fails the complexity rule.
