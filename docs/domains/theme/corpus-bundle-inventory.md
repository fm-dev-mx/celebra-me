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

Nine definitions currently retain `managedIdentityProvenance: authoring-placeholder`; read-only
checks found no persisted `managed_identity_id` to import for those rows. They are canonical source
definitions and render-corpus members, but release remains fail-closed until the owner approves a
stable identity assignment and authorizes each environment rollout independently. Do not label them
legacy, infer identity from row IDs, or treat Local success as Preview/Production authorization.
