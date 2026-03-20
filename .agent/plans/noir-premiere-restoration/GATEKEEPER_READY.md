# Gatekeeper Ready

This plan is prepared for `.agent/workflows/gatekeeper-commit.md` without additional analysis.

## Locked Inputs

- Plan id: `noir-premiere-restoration`
- Baseline commit: `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`
- Validation already passed:
  - `pnpm type-check`
  - `pnpm build`
- Architectural compatibility note:
  - the only scope expansion beyond Noir-local content and SCSS is the footer refactor from
    slug-specific branching to `sectionStyles.footer.variant`

## Required Execution Rules

- Use `.agent/plans/noir-premiere-restoration/commit-map.json` as the only source of truth.
- Do not recompute commit groupings from heuristics.
- Do not re-open visual diagnosis unless `inspect` reports a contract mismatch.
- Do not treat the currently restored footer as a Noir-only exception.

## Commit Order

1. `noir-plan-and-verification-docs`
2. `invitation-footer-variant-architecture`
3. `noir-baseline-restoration`

## Exact Commands

```bash
pnpm gatekeeper:workflow:cleanup
pnpm gatekeeper:workflow:inspect -- --plan noir-premiere-restoration
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan noir-premiere-restoration --unit noir-plan-and-verification-docs
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit noir-plan-and-verification-docs
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit noir-plan-and-verification-docs

pnpm gatekeeper:workflow:inspect -- --plan noir-premiere-restoration
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan noir-premiere-restoration --unit invitation-footer-variant-architecture
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit invitation-footer-variant-architecture
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit invitation-footer-variant-architecture

pnpm gatekeeper:workflow:inspect -- --plan noir-premiere-restoration
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan noir-premiere-restoration --unit noir-baseline-restoration
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit noir-baseline-restoration
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit noir-baseline-restoration
```

## Expected Commit Headers

- `docs(agent): finalize noir premiere restoration plan`
- `refactor(invitation): drive footer styling from section variants`
- `fix(theme): restore noir premiere xv jewelry-box baseline`
