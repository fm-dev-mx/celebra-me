# Scripts & Governance Tools

This directory contains the core automation and governance tools for the `celebra-me` project.

## Core Tools

| Script                    | Purpose                                                                                      |
| :------------------------ | :------------------------------------------------------------------------------------------- |
| `gatekeeper.js`           | **The Orchestrator.** Runs all governance checks and emits a machine-readable JSON report.   |
| `gatekeeper-workflow.mjs` | Runs the full one-command Gatekeeper workflow (report + auto-fix loop + deterministic exit). |
| `validate-schema.mjs`     | Synchronizes Zod schemas with CSS theme variants.                                            |
| `validate-commits.mjs`    | Validates that commit history follows ADU (Atomic, Descriptive, Useful) standards.           |
| `optimize-assets.mjs`     | Handles image optimization and asset registry sync.                                          |

## The Gatekeeper Contract

The `gatekeeper.js` script is designed to be consumed by agents. When run with `--report-json`, it
outputs a single deterministic contract that dictates the "Next Step":

- **`route: "architectural_intervention"`**: The agent must manually fix blockings (e.g., forbidden
  imports).
- **`route: "auto_fix"`**: The agent should run the `fixCommand` provided in the findings.
- **`route: "proceed_adu"`**: Everything is clean; proceed to commit using `suggestedSplits`.

The JSON report now includes:

- `schemaVersion`
- `checks` (`governance`, `lint`, `typecheck`, `security`)
- `routeReasons`
- `blockingFindings`
- `s0Drift`

## Automatic Branching on Protected Branches

Gatekeeper automatically protects `main` and `develop`. If staged changes exist while on a protected
branch, Gatekeeper deterministically creates or switches to a branch named in English using:

- inferred change type (`feat`, `docs`, `chore`, etc.)
- dominant domain from `scripts/config/domain-map.json`
- stable slug from changed file paths

## Adding Rules

New rules should be added as modules within `gatekeeper.js` or as standalone scripts that
`gatekeeper.js` can invoke as a host.
