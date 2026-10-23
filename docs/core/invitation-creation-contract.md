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
  - A definition marked `managedIdentityProvenance: owner-approved` is migration-pending. It may
    validate and render locally, but release requires a target-environment identity preflight; it is
    allowed only when the target row is absent, has a null managed identity, or already matches.
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
  - **Short public route (from 2026-10-19):** every invitation is shared as `/{slug}` (e.g.
    `/daniela-y-martin`), including those published earlier. The long `/{eventType}/{slug}` form
    keeps resolving to the same page with no redirect. Every static catalog demo (`demo-*`) declares
    a unique `routeSlug` in its catalog metadata and is shared as `/{routeSlug}` (e.g. `/brisa`);
    its long `/{eventType}/{slug}` form keeps resolving with a canonical link to the short one.
    Catalog aliases are reserved against managed invitation slugs; retired demo URLs use the shared
    permanent redirect registry. Slugs must be unique across all event types and must not be
    reserved: first-level routes (`dashboard`, `login`, `demos`, `api`, `i`, `r`, `terminos`,
    `privacidad`, `vista-previa`, `invitacion`, `404`) or event types (`xv`, `boda`, `cumple`,
    `bautizo`, `baby-shower`, `primera-comunion`). SSOT: `src/lib/invitation/slug-policy.ts`; link
    builder: `buildPublicInvitationPath` in `src/utils/invitation-link.ts`.
  - Prefer celebrant/couple identity tokens only (names), not event-type labels (`boda`, `xv`,
    `cumple`, etc.).
  - **Slug Brevity & Naming Discipline:** Prefer the concise public form
    `{primer_nombre}-{primer_apellido}` (e.g. `norma-hernandez`, `leslie-perez`). Do **not** bloat
    slugs with middle names and multiple compound surnames (e.g. avoid
    `norma-margarita-hernandez-zabalsa`). Slugs drive filesystem paths, asset folders, stylesheets,
    and URL links; compound surnames or middle names are permitted only when strictly necessary to
    disambiguate a collision or when explicitly requested by the celebrant for their public URL.
  - `visualProfileId` should match the canonical slug unless a documented exception exists.
  - New definitions live in their own folder, `src/invitations/clients/<slug>/`: `invitation.ts`
    (`export default defineCanonicalInvitation({ ... })`), an optional token-only `profile.scss`
    (then `visualProfileId` is the slug) and `assets/` (the definition's
    `assetDir: 'src/invitations/clients/<slug>/assets'`). Run `pnpm invitation:registry` to add the
    folder to `scripts/provision/invitations/client-registry.generated.ts`; a test fails while that
    file is stale. The single-file definitions in `scripts/provision/invitations/` are frozen: a
    test refuses new ones, and each leaves when its invitation expires.
  - New definitions do not declare `_assetSlug`: their binaries are referenced by semantic asset
    keys. `_assetSlug` remains only on demos and on the legacy definitions listed under
    [Documented exceptions](#documented-exceptions).
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
  `cumple`, `baby-shower`, `bautizo`, `primera-comunion`). Each type has a structure contract in
  `src/lib/invitation/event-type-contract.ts`: the sections `sectionOrder` must include and the
  theme presets verified for that type (the `eventTypes` of each row in `THEME_PRESET_METADATA`).
  Section variants stay type-agnostic.
- **Theme Preset** (`themeId` and `content.theme.preset`, required, no default): a value of
  `THEME_PRESETS`, the keys of `THEME_PRESET_METADATA` (e.g. `editorial-magazine`, `jewelry-box`).
  The content schema rejects a missing preset and the adapter throws on an unknown one; nothing
  falls back to a default preset. Keep `themeId` equal to `theme.preset`
  (`defineCanonicalInvitation` does not cross-check them).
- **Visual Profile ID** (`visualProfileId`): Compatible visual profile.
- **Template ID** (`content.templateId`, optional): reporting dimension `{eventType}-{themePreset}`.
  `defineCanonicalInvitation` derives it when the content omits it. Invitations have no base demo
  and definitions carry no `baseDemoId`; the legacy `base_demo_id`/`snapshot` columns leave with
  their contract migration.
- **Envelope reveal** (`envelope`, optional): `revealVariant: editorial-cover` replaces the envelope
  with the editorial cover reveal. A standalone reveal skin (`satin-filigree`, `seaside-lineart`,
  `storybook-lanterns`) replaces the preset-driven `data-variant` and its stylesheet. Otherwise
  `envelope.variant` (a theme preset name) selects the skin, falling back to `theme.preset` when
  omitted; `revealVariant: celestial-blue` layers on top of it
  (`src/lib/invitation/reveal-card.ts`).
- **Lifecycle** (`lifecycle`, required, no default): `in_progress` while the definition is
  intentionally absent or not yet aligned through Production; `published` once Production alignment
  is expected. This metadata is explicit and is not inferred from timestamps or environment
  presence. Hosted targets enforce it: `invitation:release --targets preview` and `prod:apply`
  reject an `in_progress` definition with `LIFECYCLE_NOT_PUBLISHED`, and `prod:apply --all-ready`
  leaves authoring definitions out of discovery (counted apart, like expired ones). Local remains
  open for authoring.
- **Delivery Scope** (`deliveryScope`): `content-only`, `content-and-assets`, or `assets-only`.
  Three-way reconciliation must use this declared scope and report out-of-scope changes rather than
  applying or hiding them. `pnpm invitation:release` inherits this value unless the operator passes
  `--update-scope` or `--content-only`.
- **Client Details**: client name, the WhatsApp RSVP destination when the invitation publishes one,
  and photo reception status. Definitions carry no client email
  ([sensitive data guide](./sensitive-data-guide.md)); provisioning writes the empty value that the
  NOT NULL `invitations.client_email` column defaults to, from one constant
  (`DEFINITION_CLIENT_EMAIL`), and existing rows keep theirs.
- **Creation timestamp** (`createdAt`): canonical UTC. It is part of the release `sourceHash`, so
  changing it on a published definition forces a re-release. `defineCanonicalInvitation` stamps
  `2026-08-29T00:00:00.000Z` (and `photosReceived: true`) on every canonical definition; this is
  intentionally left as is, and only release metadata reads it.
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
- **Validity window**: a client invitation stays public until the end of the anniversary of its own
  event date — event date + 1 year, 23:59:59.999 in the event time zone (Feb 29 → Feb 28) — as
  promised in the Terms (§8). One rule decides it
  (`src/lib/invitation/access/invitation-validity-window.ts`); the event date is the one
  `public.invitation_event_date()` derives (`eventTiming.localDateTime`, then `startsAtUtc`, then
  the legacy `hero.date`; default zone `America/Chihuahua`). There is no separate archive date and
  no manual override. An invitation without a resolvable event date never expires; demos never
  expire.
  - **Guests:** after that instant an invitation behaves exactly like a disabled one (neutral `403`
    page, same robots policy, `403 invitation_unavailable` from location and RSVP, memories space
    unknown; [payment and access](../domains/invitations/payment-access-and-preview.md)). Dashboard,
    admin and host views are unaffected, and no database row changes.
  - **Release planning:** expired definitions leave `prod:apply` discovery, `--all-ready`,
    `invitation:release --status` (`--include-expired` lists them) and the hash baseline; an
    explicit `--slug` still resolves them.
  - **Retirement from the repository:** a definition, its profile, its assets and a preset whose
    last consumer it is may be deleted only after the invitation expires.
    `scripts/provision/release-hash-baseline.json` pins each active invitation's `validUntil`;
    `pnpm invitation:hash-baseline -- --update` refuses to drop a slug whose window is still open,
    and `tests/provision/release-hash-baseline.test.ts` fails while such a slug is missing from the
    registry. When an invitation expires, the baseline test asks for `--update`; the definition may
    then leave the repository.
- **Section Inclusions & Omissions**: Explicit list of included sections; omitted optional sections
  must be completely omitted without empty renderable structures.
- **Section Order**: Array of section keys defining exact publication sequence.
- **Asset Requirements**: Stable semantic keys (`hero`, `portrait`, `gallery1`, etc.) mapped to
  verified source binaries (JPEG, PNG, WebP). Declared keys are operationally required.
- **Storage Conventions**: Local stores managed binaries in Supabase Storage bucket
  `invitation-assets` at `managed/<slug>/<key>.webp`. Preview and Production host them in R2 under
  the content-addressed object key `invitations/<eventType>/<slug>/<key>-<sha256>.<ext>`
  (`src/lib/intake/services/storage-provider.ts`, `r2-invitation-media.ts`). In both cases
  `invitation_assets` rows record the provider, path and delivery URL.

When a new invitation uses custom section-to-section composition, select and verify it against the
canonical [Invitation Section Intersection System](../domains/theme/section-intersections.md). That
theme-domain document owns the reusable patterns and review criteria; this creation contract does
not redefine them.

### Variant, style, and asset contract

New managed content must follow the canonical
[`variant-system.md`](../domains/theme/variant-system.md):

- Select structural or behavioral choices with the owning `section.variant` field. Do not author
  `sectionStyles`, legacy aliases, theme-named Gallery layouts, or `itinerary.presentation.behavior`
  in new content. `envelope.variant` selects the reveal design independently of `themeId`; omit it
  to keep the current theme-preset resolution.
- Treat `theme.preset` as a visual skin input only. It may not select a renderer, structural layout,
  required DOM, or section behavior. Every present section must declare its canonical variant; never
  derive variants from `theme.preset`.
- Supply every variant-specific field required by its discriminated section schema. Unknown and
  incompatible configurations must fail publication validation.
- Keep profile SCSS to custom-property declarations: client palette token remap and
  rhythm/intersection token overrides. Client text belongs in content data, never in CSS `content:`
  or baked into an image. Canonical grid, order, required visibility, and structural breakpoints
  belong to the section variant's semantic SCSS entrypoint. See
  [`docs/domains/theme/architecture.md`](../domains/theme/architecture.md#invitation-css-ownership-normative).
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

The **Local Render Corpus** (`scripts/provision/local-render-corpus/registry.ts`) is a derived
projection of every managed canonical invitation that must be renderable and regression-tested in
Local before remote deployment. Definitions with `lifecycle: in_progress` remain authoring-only
until their separately authorized persisted reconciliation; they are still schema-tested by the
projection. The corpus has no independent invitation category or source contract. See
[`local-render-corpus.md`](./local-render-corpus.md).

`pnpm dbs` active “Managed” counts include demos and are not corpus size.

---

## 4. Environment Observability & Identity Rekey Boundaries

`pnpm dbs` is the read-only status command for schema and managed invitation state across Local,
Preview, and Production. Its flags live in the
[status diagnostics cheatsheet](../domains/database/cheatsheets/status-diagnostics.md). Git hooks do
not query it; `pnpm lane:sync` prints the same bounded status after synchronization (opt out with
`--skip-status` or `CELEBRA_SKIP_MANAGED_STATUS=1`).

### Rekey Target Semantics

- Identity rekeying (`--rekey-from <old-slug>`) is supported on Local and Preview only.
- Production fails closed with `IDENTITY_REKEY_UNSUPPORTED_TARGET`.
- Rekeying preserves the invitation UUID, event ownership, and RSVP records while updating the
  canonical slug and release provenance.

## Readable composition acceptance

Before accepting a new invitation or variant, verify complete names (including accented and
multiline surnames) inside their content area without clipping or ellipsis. Titles, date/venue
information, credits, scroll cues and music prompts must not overlap. Maintain the music control's
accessible label and minimum 44px touch target. Small informational text requires at least 4.5:1
contrast.

Reuse the canonical visual matrix (390×844 and 1440×900, defined in
`scripts/screenshot/visual-coverage-contract.ts`) and shared geometry checks for affected flows.
Exercise representative long names and wrapped venue/date content in shared variant fixtures.
Geometry regressions and approved screenshots provide complementary evidence; neither replaces human
inspection of photographic contrast and ornamental lettering.

Follow [CSS visual parity](../domains/theme/css-visual-parity.md) for complete-page capture, pinned
runtime, scoped exceptions and exact-artifact human acceptance. A published invitation passing
schema or route tests alone is not visually accepted.

---

## Documented exceptions

The single register of accepted deviations from this contract. Each entry was verified against the
code on 2026-10-13; lists only shrink, and an entry leaves when its exit condition is met.

### Legacy definitions without `defineCanonicalInvitation`

These definitions build their own `buildPublishedContent` and still declare `_assetSlug`. Migrating
them moves their `sourceHash` and forces a re-release, so the owner decided to document them rather
than migrate them. Each leaves together with its definition, assets and profile once its invitation
expires (validity window above).

- Active: `daniela-y-martin`, `melissa-y-luis-osmar`, `norma-hernandez`, `victoria-y-roberto`, and
  `destenid-sofia` (`in_progress`).
- Past events kept until they expire: `abril-michelle-becerra-rea`, `alba-rosa-quinonez`,
  `leslie-perez`, `renata`, `romina-rios-chaparro`, `valentina-hernandez` (its assets still live
  under `src/assets/images/events/xv-valentina-hernandez/`).

New invitations always use `defineCanonicalInvitation`.

### Frozen profiles of `in_progress` invitations

`tests/unit/invitation-profile-boundary.test.ts` freezes legacy profiles by digest. Two of them
belong to `in_progress` definitions (`destenid-sofia`, `naydelin-paredes`), and one to a demo
(`demo-xv-celestial-blue`). A frozen profile may not change until it is rewritten token-only; the
digest list only shrinks, and an entry leaves with its invitation or with that rewrite.

### Published invitations retired from the repository before expiry

Nine published invitations lost their definitions before the validity window existed (commit
`43000fc7e`). Their published content still renders, so what their pages need stays until each
expires; definitions, assets, baselines and dedicated tests are not restored. Profiles and the
preset are resolved by file name (`import.meta.glob` in `src/lib/invitation/section-css-resolver.ts`
and `preset-css-resolver.ts`), so keeping the stylesheet is enough.

| Invitation                    | Expires (end of day, event zone)   | Kept in the repository                                       |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `gerardo-sesenta`             | 2027-02-21 (`America/Mazatlan`)    | nothing (preset `luxury-hacienda` is shared)                 |
| `ximena-meza-trasvina`        | 2027-04-11 (`America/Mazatlan`)    | nothing (preset `premiere-floral` is shared)                 |
| `ana-sofia-cota-guillen`      | 2027-05-23 (`America/Mazatlan`)    | nothing (preset `celestial-blue` is shared)                  |
| `cesar-ramses`                | 2027-06-20 (`America/Mexico_City`) | preset `sacred-keepsake` (all its SCSS and contract entries) |
| `leah-lexa`                   | 2027-06-21 (`America/Mexico_City`) | profile `leah-lexa.scss` (frozen digest)                     |
| `ayrin-samantha-lerma-castro` | 2027-08-01 (`America/Mazatlan`)    | nothing (preset `enchanted-rose` stays with its demo)        |
| `luna-y-estrella`             | 2027-08-01 (`America/Mexico_City`) | profile `luna-y-estrella.scss` (frozen digest)               |
| `america-johana`              | 2027-08-29 (`America/Mexico_City`) | profile `america-johana.scss` (frozen digest)                |
| `xareni-iyarit`               | 2027-09-12 (`America/Mexico_City`) | profile `xareni-iyarit.scss` (frozen digest)                 |

`tests/unit/invitation-profile-boundary.test.ts` (`RETAINED_UNTIL_EXPIRY`) fails once a retained
profile's window has closed, so it is removed with its digest. Remove `sacred-keepsake` after
2027-06-20 together with its `THEME_PRESET_METADATA` row, its two stylesheet entrypoints and
`tests/unit/style-boundaries.test.ts`. This list only shrinks.

### Presets and their consumers

A new preset needs two consumers (invitations or demos) when it is created; otherwise use a section
variant or a visual profile. An existing preset may remain while at least one live invitation or
demo uses it, and leaves with its last consumer. Single-consumer presets today: `jewelry-box`
(`naydelin-paredes`), `storybook-lilac` (`america`), `enchanted-rose` (its demo) and
`sacred-keepsake` (the published `cesar-ramses` until it expires; see above). This wording
supersedes the "≥2 consumers" existence rule in the
[theme architecture](../domains/theme/architecture.md) for presets that already exist.

### Tooling modules under `src/lib`

Some `src/lib` modules have no runtime importer and are used only by scripts and tests: all of
`src/lib/invitation-preparation/` except what `asset-policy.ts`, `publishing.service.ts` and
`event-type-contract.ts` import, `intake/mutations/structural-operation.ts`,
`intake/services/{draft-contract-audit,published-content-audit}.service.ts`,
`invitation/{delivery-budget,delivery-contract,event-type-contract}.ts`,
`memories/contract/space-reference.ts` and `status/{dbs-json,media-reference-types}.ts`. They stay
in `src/lib` on purpose: they encode domain contracts next to the runtime code they validate, and
`ci:static` runs them through `validate:invitation-preparation` and the content tests.

### Operator surfaces without a screen

- `/api/dashboard/commercial/classifications` has no dashboard caller. It is the documented owner
  procedure for marking commercial records (leads, customers, orders, Meta conversion events) as
  test/QA data or revoking that mark: `GET` lists marks and `POST` classifies or revokes, both
  behind a strong administrator session, and `tests/unit/commercial-classifications-api.test.ts`
  covers it.
- `src/lib/rsvp/rsvp-operation-contract.ts` declares the RSVP submit lookup and RPC budget owned by
  `docs/domains/invitations/performance-metrics.md`. Only `tests/unit/rsvp-v2.service.test.ts`
  imports it: it is the executable form of that budget, not dead code.

### `?debug=1` diagnostics

Debug output is server-side only in a local process: `/api/auth/session` and `/api/dashboard/events`
honor `?debug=1` only when `isLocalProcess()` is true (`src/lib/server/deploy-identity.ts`), and
`src/utils/debug.ts` limits the client flag to console diagnostics. Hosted environments never return
debug payloads; diagnose them through server logs, correlated by the hosting platform's per-request
id (the application does not mint its own request id yet).
