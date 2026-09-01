# Canonical invitation and demo inventory

The only invitation inventory is `scripts/provision/invitations/registry.ts`. It contains the 17
managed invitation definitions. The Local Render Corpus is a derived validation projection of all
managed definitions and must not maintain a second list or a legacy classification.

The 13 demos are discovered from `src/content/event-demos/**` and use the same canonical schema,
adapter, render plan, section components, variants, and CSS ownership resolver. Templates are
validated structurally but are not invitation inventory entries.

Use these commands for current evidence:

```bash
pnpm test:local-render-corpus
pnpm visual:parity:candidate
pnpm visual:parity:compare
```

Persisted Local, Preview, and Production rows remain separately authorized operational state. A
read-only inventory audit must report any row without a matching managed definition as unmanaged; it
must never silently classify or import it as a supported invitation.

Nine definitions are canonical source definitions with literal `managedIdentityId` values and
`managedIdentityProvenance: owner-approved` until each environment preflight verifies the target row.
Release remains fail-closed until the owner authorizes the sequential rollout. Do not infer identity
from row IDs, or treat Local success as Preview/Production authorization.
