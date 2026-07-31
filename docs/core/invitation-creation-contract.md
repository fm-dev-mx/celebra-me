# Canonical Invitation Creation Contract — Celebra-me

**Owns:** identity and required fields for any managed invitation (what must exist before apply).

**Does not own:** operational runbook steps, CLI flags, packaging, target order, or agent safety
constraints. Those live in:

- Runbook — [`docs/domains/intake/production-flow.md`](../domains/intake/production-flow.md)
- Agent procedure —
  [`.agent/workflows/managed-invitation-lifecycle.md`](../../.agent/workflows/managed-invitation-lifecycle.md)
- Safety constraints —
  [`.agent/rules/invitation-production.md`](../../.agent/rules/invitation-production.md)

See the invitation authority chain in [`.agent/index.md`](../../.agent/index.md).

---

## 1. Global Invitation Identity & Requirements

Every managed digital invitation must define:

- **Display Name** (`title`): Spanish human-readable title (e.g. `Romina Ríos Chaparro`).
- **Canonical Slug** (`slug`): Lowercase hyphenated unique identifier (e.g. `romina-rios-chaparro`).
  Slug drives public URLs, assets, and storage paths. It is **not** the host login.
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
  verified source binaries (JPEG, PNG, WebP).
- **Storage Conventions**: Storage path `managed/<slug>/<key>.webp` in bucket `invitation-assets`.

When a new invitation uses custom section-to-section composition, select and verify it against the
canonical [Invitation Section Intersection System](../domains/theme/section-intersections.md). That
theme-domain document owns the reusable patterns and review criteria; this creation contract does
not redefine them.

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
