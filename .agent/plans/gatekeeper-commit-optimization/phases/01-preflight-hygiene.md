# Phase 1: Pre-Flight Hygiene & Diagnostic Automation

## Context
During the `theme-governance` atomic commit sequence, the agent experienced severe friction and token waste due to consecutive `unit_mismatch` errors. The root cause was an unclean Git working tree (e.g., archived plans, modified stashes, hidden rename ambiguities).

## 1. Pre-Flight Command Protocol
To optimize execution time, the agent must *never* run `inspect` blindly. Before starting the Gatekeeper sequence, the agent must run a single, low-token command bundle:

```bash
git stash list; git clean -dn; git status --porcelain
```

This guarantees:
1. Awareness of potential index corruption from stashes.
2. Visibility of untracked files (`git clean -dn`).
3. Exact byte-for-byte state of the staged vs. modified files.

## 2. Fast-Path `unit_mismatch` Diagnostics
If `inspect` fails with a `unit_mismatch`, the agent MUST NOT run recursive fuzzy searches or dump massive JSON outputs. Instead, it must immediately compare the staged files against the unit expectation:

```bash
# Minimal diff to see exactly what is drifting:
git diff --staged --name-only > staged_files.txt
# (The agent reads staged_files.txt to compare with commit-map.json mapping)
```

## Implementation Target
These operational protocols will be formally injected into `.agent/workflows/gatekeeper-commit.md` so that future agents execute the optimized loop naturally.
