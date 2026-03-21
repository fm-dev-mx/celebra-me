# Phase 3: Agent Workflow Prompt Hardening

## Context
The project uses strict markdown-based workflows in `.agent/workflows/`. For agents to execute the Gatekeeper commit loop efficiently, the instructions inside `.agent/workflows/gatekeeper-commit.md` must be updated to codify the post-mortem findings.

## Proposed Overhauls

1. **Gatekeeper Checklist Addition**:
   - Add a step *before* Inspect: `[ ] Run Pre-Flight Git Hygiene (Clean, Stash, Status).`
   - Add explicit warnings: `> **CRITICAL**: If terminal hangs during scaffold/commit, DO NOT retry blindly. Cancel the execution and use 'git commit -F' with the exact message from the plan.`

2. **Mismatch Handling Shortcut**:
   - Provide the specific bash commands in the workflow file so the agent uses them instantly:
   `git status --porcelain; git diff --staged --name-only`

3. **Fallback Implementation**:
   - Inform the agent of the exact `--yes` requirement whenever it encounters `npx` in the pipeline.

This phase concludes the formal optimization rollout by baking the resilience into the system's "memory."
