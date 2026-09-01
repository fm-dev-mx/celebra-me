# Local Render Corpus

The Local Render Corpus is a derived validation projection of all managed canonical invitation
definitions. It is not an invitation inventory, does not own lifecycle, and has no legacy category.

## Authority

The only invitation inventory is `scripts/provision/invitations/registry.ts`. The projection in
`scripts/provision/local-render-corpus/registry.ts` is derived from that registry and is consumed by:

- `pnpm invitation:local-corpus` (persistent-local only, guarded pipeline)
- `pnpm test:local-render-corpus`
- `pnpm screenshot:local-render-corpus`
- `pnpm invitation:inventory-audit` (read-only)

Do not add independent slug lists to tests, seed scripts, screenshot configuration, or UI code.
Historical sanitized JSON files may remain as authoring evidence for migrated definitions; they are
not a runtime source and are never upserted by corpus tooling.

## Local bootstrap

```bash
pnpm invitation:local-corpus --dry-run
pnpm invitation:local-corpus --apply --slug <slug>
```

Every entry uses the definition and its declared delivery scope through `applyLocalInvitation`.
The command rejects Preview and Production, never clones databases, and never imports Auth users,
guests, RSVP responses, analytics, or tracking data. Apply remains a separately authorized write.
Definitions with `managedIdentityProvenance: owner-approved` remain render/schema inputs only;
release/package generation fails closed until each target identity preflight is verified.

## Regression and visual gate

```bash
pnpm test:local-render-corpus
pnpm screenshot:local-render-corpus
pnpm visual:parity:candidate
pnpm visual:parity:compare
pnpm visual:parity:accept -- --reference-sha=<approved-commit-sha>
```

Candidate files are ignored under `.tmp/visual-parity/candidate/`. Compare never modifies accepted
files. Acceptance is human-only and unavailable in CI. Accepted PNGs belong under
`tests/e2e/visual-baselines/` and are governed by `.gitattributes` for Git LFS.

## Adding a supported invitation

1. Add a typed definition under `scripts/provision/invitations/` with explicit canonical content,
   section order, variants, prerequisites, and asset keys.
2. Register it in `scripts/provision/invitations/registry.ts`.
3. Run the Local dry-run and the render-contract regression suite.

An invitation absent from the canonical registry is an audit failure. Demos remain discovered from
`src/content/event-demos/**`; templates remain schema and structural-validation inputs.

## Exclusions

Demo routes, Preview E2E fixtures, stale rekey aliases, and archived rows are not client invitation
definitions and must not be inserted into this projection.
