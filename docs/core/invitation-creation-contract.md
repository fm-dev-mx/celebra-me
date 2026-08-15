# Canonical Invitation Creation Contract — Celebra-me

**Owns:** identity and required fields for any managed invitation (what must exist before apply).

**Does not own:** operational runbook steps, CLI flags, packaging, target order, or agent safety
constraints. Those live in:

- Runbook — [`docs/domains/intake/production-flow.md`](../domains/intake/production-flow.md)
- Safety constraints —
  [`.agent/rules/invitation-production.md`](../../.agent/rules/invitation-production.md)

See the invitation authority chain in [`.agent/index.md`](../../.agent/index.md).

---

## 1. Global Invitation Identity & Requirements

Every managed digital invitation must define:

- **Managed Identity** (`managedIdentityId`): Immutable UUID v4 independent of slug, title, and
  client name. Never reuse across definitions; never change after first publication. Identity
  resolution and uniqueness use this value — never title or client name.
- **Previous Slugs** (`previousSlugs`, optional): Historical slugs for this managed identity. Used
  for alias diagnostics and fail-closed `REKEY_REQUIRED` protection. Creating a new row when a
  previous slug is still active is forbidden; operators must pass `--rekey-from <old-slug>`. Guarded
  rekey (Local and Preview only; Production blocked) preserves invitation UUID, owner, publication,
  event, RSVP data, provenance, and assets; it aborts on collisions or drift. `managedIdentityId` is
  assigned/backfilled even when content is otherwise unchanged.
- **Display Name** (`title`): Spanish human-readable title (e.g. `Romina Ríos Chaparro`).
- **Canonical Slug** (`slug`): Lowercase hyphenated unique identifier (e.g. `romina-rios-chaparro`,
  `daniela-y-martin`). Slug drives public URLs, assets, and storage paths. It is **not** the host
  login.
  - **Do not prefix the slug with `eventType`.** Public routes are already `/{eventType}/{slug}`
    (e.g. `/boda/daniela-y-martin`). A slug like `boda-daniela-y-martin` produces a redundant URL
    (`/boda/boda-daniela-y-martin`) and is forbidden for new invitations.
  - Prefer celebrant/couple identity tokens only (names), not event-type labels (`boda`, `xv`,
    `cumple`, etc.).
  - `assetSlug` and `visualProfileId` should match the canonical slug unless a documented exception
    exists.
- **Host Login Alias** (`hostLoginAlias`): Short unique Auth login for the dedicated host. Technical
  email is `{hostLoginAlias}@clientes.celebra.invalid`. Alias is independent of slug.
  - **Preferred form:** `{primer_nombre}_{primer_apellido}` from the celebrant/honoree (not the
    commercial purchaser), ASCII lowercase, underscores only (e.g. `abril_becerra`,
    `alba_quinonez`).
  - **Collision 1:** append segundo apellido → `abril_becerra_rea`.
  - **Collision 2:** numeric suffix `_2`, `_3`, … if still taken or no second surname.
  - Legacy aliases may retain a fuller form (e.g. `romina_rios_chaparro`) until intentionally
    remapped. Remapping an existing Auth host is a separate Admin update; updates preserve
    `created_by` and do not auto-rekey email.
- **Event Type** (`eventType`): Supported event type from live `EVENT_TYPES` (e.g. `xv`, `boda`,
  `cumple`, `baby-shower`, `bautizo`, `primera-comunion`).
- **Theme Preset** (`themeId`): A valid theme preset from `THEME_PRESETS` (e.g. `enchanted-rose`,
  `editorial-magazine`, `jewelry-box`).
- **Visual Profile ID** (`visualProfileId`): Compatible visual profile.
- **Base Demo ID** (`baseDemoId`): Pre-existing demo snapshot ID paired with the selected theme.
- **Lifecycle** (`lifecycle`): `in_progress` while the definition is intentionally absent or not yet
  aligned through Production; `published` once Production alignment is expected. This metadata is
  explicit and is not inferred from timestamps or environment presence.
- **Delivery Scope** (`deliveryScope`): `content-only`, `content-and-assets`, or `assets-only`.
  Three-way reconciliation must use this declared scope and report out-of-scope changes rather than
  applying or hiding them. `pnpm invitation:release` inherits this value unless the operator passes
  `--update-scope` or `--content-only`.
- **Client Details**: Client name, client email, client WhatsApp number, and photo reception status.
- **Owner Policy**:
  - **All targets**: Preserve the existing invitation owner on updates.
  - **New creates**: Ensure a dedicated Auth host from `hostLoginAlias`
    (`{hostLoginAlias}@clientes.celebra.invalid`). UUID may differ per environment; do not copy
    Local UUIDs across projects. Dry-run reports `OWNER_REUSE` | `OWNER_CREATE_PLANNED` |
    `OWNER_CONFLICT`.
  - **Override**: `--owner-user-id <UUID>` is optional assertion/override only; happy path does not
    require a manually discovered owner. Preview admin / shared operator accounts are not the
    default owner for new client invitations.
- **Event Date & Time Zone**: ISO date string (`hero.date`) and IANA time zone (e.g.
  `America/Mexico_City`).
- **Section Inclusions & Omissions**: Explicit list of included sections; omitted optional sections
  must be completely omitted without empty renderable structures.
- **Section Order**: Array of section keys defining exact publication sequence.
- **Asset Requirements**: Stable semantic keys (`hero`, `portrait`, `gallery1`, etc.) mapped to
  verified source binaries (JPEG, PNG, WebP). Declared keys are operationally required.
- **Storage Conventions**: Storage path `managed/<slug>/<key>.webp` in bucket `invitation-assets`.

When a new invitation uses custom section-to-section composition, select and verify it against the
canonical [Invitation Section Intersection System](../domains/theme/section-intersections.md). That
theme-domain document owns the reusable patterns and review criteria; this creation contract does
not redefine them.

### Variant, style, and asset contract

New managed content must follow the canonical
[`variant-system.md`](../domains/theme/variant-system.md):

- Select structural or behavioral choices with the owning `section.variant` field. Do not author
  `sectionStyles.*.structuralVariant`, theme-named Gallery layouts, or
  `itinerary.presentation.behavior` in new content. `envelope.variant` selects the reveal design
  independently of `themeId`; omit it to keep the current theme-preset resolution.
- Treat `theme.preset` and `visualVariant` as visual skin inputs only. Neither may select a
  renderer, structural layout, required DOM, or section behavior.
- Supply every variant-specific field required by its discriminated section schema. Unknown and
  incompatible configurations must fail publication validation.
- Keep profile SCSS limited to tokens, palette, typography, crop, decoration, and timing. Canonical
  grid, order, required visibility, and structural breakpoints belong to the section variant's
  semantic SCSS entrypoint.
- Reference client photographs and artwork through the invitation's typed semantic asset keys. Do
  not import another invitation's files from reusable code or styles.
- Author non-neutral boundary choices in typed `composition.intersections`; do not derive them from
  slug or profile identity.

A reusable variant may originate during invitation work, but its name and implementation must
describe design, structure, or behavior and retain no originating-client identity. Promotion
requires an explicit typed contract, isolated CSS delivery, invalid/incompatible tests, and a
non-origin portability proof without the originating profile or assets. One-off profile composition
remains invitation-specific until that evidence exists.

---

## 2. Required Pipeline Invariants

These are contract invariants, not a substitute for the production runbook. Follow
[`production-flow.md`](../domains/intake/production-flow.md) for procedure, packaging, target order,
approval, and recovery.

1. **Intake & Normalization**: Raw asset binaries must pass MIME, dimension, and sharpness checks;
   normalized WebP delivery assets must carry `sourceHash` and `assetManifestHash`.
2. **Package freshness**: A file `--package` must match the current managed definition `sourceHash`
   (or use an explicit `--allow-stale-package` override). Regenerate the package after every
   definition change before hosted apply.
3. **Canonical Publication Validation**: `draftContent` must validate against `eventContentSchema`
   before release acceptance, packaging, or database/storage mutation.
4. **Immutable Operational Plan**: Applies must be backed by a deterministic `OperationalPlan`
   (`planId`, target preconditions, functional changes, physical DB/Storage counts).
5. **Drift Protection**: Target preconditions must be re-checked immediately before apply; abort on
   drift.
6. **Bounded DB & Storage Apply**: Publication uses the atomic publication boundary. Other hosted
   upserts and Storage writes use compensation. Never claim a full rollback without verified restore
   of every completed mutation.
7. **Provenance Recording**: Release provenance must be recorded in
   `public.managed_invitation_release_provenance`.
8. **Preview Approval Binding**: Production deployment requires an approved Preview artifact that
   matches exact source/package hashes and plan ID when the runbook requires that gate.

---

## 3. Local Render Corpus vs Canonical Registry

The **Canonical Managed Registry** (`scripts/provision/invitations/registry.ts`) owns managed
release lifecycle definitions.

The **Local Render Corpus** (`scripts/provision/local-render-corpus/registry.ts`) owns every
currently supported Production **client** invitation that must be renderable and regression-tested
in Local before remote deployment. It includes the canonical managed set plus supported legacy
clients. See [`local-render-corpus.md`](./local-render-corpus.md).

`pnpm dbs` active “Managed” counts include demos and are not corpus size.

---

## 4. Environment Observability & Identity Rekey Boundaries

### Unified Status Command (`dbs`)

The single canonical repository command for inspecting environment status and managed invitation
state across Local, Preview, and Production is:

```bash
pnpm dbs                 # Canonical schema + publication + readiness
pnpm dbs <slug>          # One registry invitation
pnpm dbs --verbose       # Migration IDs, env states, reasonCode
pnpm dbs --diagnostics   # Same decisions plus diagnostic enrichment
pnpm dbs --compact       # Connectivity CONTENT + SCHEMA (not publication; Git-hook friendly)
pnpm dbs --compact <slug># Same connectivity CONTENT scoped to one slug
```

Compact output is connectivity plus `classifySchemaLifecycle` only. It is strictly read-only and
never migrates, reconciles, updates, or promotes. Unavailable remotes degrade to `UNREACHABLE` /
`CREDENTIALS_REQUIRED` / `UNVERIFIED` without noisy failure for expected gaps. Publication state
comes from `pnpm dbs` / `pnpm dbs <slug>` via `classifyLiveInvitation` and `decidePromotionAction`,
not from package-hash compact output.

Optional non-blocking Git hooks (`post-commit`, `post-merge`, `post-rewrite`) may print compact
status with a strict per-query timeout. They never block Git success. Temporary opt-out:
`CELEBRA_SKIP_MANAGED_STATUS=1`. Blocking husky gates (`pre-commit`, `pre-push`, `commit-msg`) do
not run database/network status.

**Hooks vs lane sync:** `post-rewrite` is not a reliable semantic equivalent of “lane synchronized”.
A rebase that fast-forwards or rewrites nothing may produce no hook output. Use the canonical
lane-sync command for deterministic observability after aligning with `develop`:

```bash
pnpm lane:sync            # fetch + rebase onto origin/develop, then dbs --compact
pnpm lane:sync -- --ff-only
pnpm lane:sync -- --skip-status
```

`pnpm lane:sync` never fails the Git synchronization step because remote managed status is
unavailable; status remains read-only and bounded. Opt-out via `--skip-status` or
`CELEBRA_SKIP_MANAGED_STATUS=1`.

### PowerShell Helper

Developers and operators can define a thin human helper in their PowerShell `$PROFILE`:

```powershell
function dbs {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    pnpm dbs @Args
}
```

The PowerShell helper delegates directly to `pnpm dbs` without containing DB or status business
logic.

### Rekey Target Semantics

- Identity rekeying (`--rekey-from <old-slug>`) is supported only on the **local** target
  environment.
- Any attempt to execute `--rekey-from` against Preview or Production targets fails closed
  immediately with `IDENTITY_REKEY_UNSUPPORTED_TARGET`.
- Rekeying preserves the invitation UUID, event ownership, and RSVP records while updating the
  canonical slug and release provenance.
