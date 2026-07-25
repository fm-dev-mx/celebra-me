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
- **Event Type** (`eventType`): Supported event type (e.g. `xv`, `boda`, `cumpleanos`,
  `baby-shower`, `bautizo`).
- **Theme Preset** (`themeId`): A valid theme preset from `THEME_PRESETS` (e.g. `enchanted-rose`,
  `editorial-magazine`, `jewelry-box`).
- **Visual Profile ID** (`visualProfileId`): Compatible visual profile.
- **Base Demo ID** (`baseDemoId`): Pre-existing demo snapshot ID paired with the selected theme.
- **Client Details**: Client name, client email, client WhatsApp number, and photo reception status.
- **Owner Policy**:
  - **Local**: Default local super admin or explicit `--owner-user-id <UUID>`.
  - **Preview**: Resolved Preview admin user (`iwipdvisoyerfdytuhwi`).
  - **Production**: Preserve the owner resolved from the existing target invitation. Require
    explicit `--owner-user-id <UUID>` only when creating a new hosted invitation.
- **Event Date & Time Zone**: ISO date string (`hero.date`) and IANA time zone (e.g.
  `America/Mexico_City`).
- **Section Inclusions & Omissions**: Explicit list of included sections; omitted optional sections
  must be completely omitted without empty renderable structures.
- **Section Order**: Array of section keys defining exact publication sequence.
- **Asset Requirements**: Stable semantic keys (`hero`, `portrait`, `gallery1`, etc.) mapped to
  verified source binaries (JPEG, PNG, WebP).
- **Storage Conventions**: Storage path `managed/<slug>/<key>.webp` in bucket `invitation-assets`.

---

## 2. Required Pipeline Invariants

These are contract invariants, not a substitute for the production runbook. Follow
[`production-flow.md`](../domains/intake/production-flow.md) for procedure, packaging, target order,
approval, and recovery.

1. **Intake & Normalization**: Raw asset binaries must pass MIME, dimension, and sharpness checks;
   normalized WebP delivery assets must carry `sourceHash` and `assetManifestHash`.
2. **Canonical Publication Validation**: `draftContent` must validate against `eventContentSchema`
   before release acceptance, packaging, or database/storage mutation.
3. **Immutable Operational Plan**: Applies must be backed by a deterministic `OperationalPlan`
   (`planId`, target preconditions, functional changes, physical DB/Storage counts).
4. **Drift Protection**: Target preconditions must be re-checked immediately before apply; abort on
   drift.
5. **Bounded DB & Storage Apply**: Publication uses the atomic publication boundary. Other hosted
   upserts and Storage writes use compensation. Never claim a full rollback without verified restore
   of every completed mutation.
6. **Provenance Recording**: Release provenance must be recorded in
   `public.managed_invitation_release_provenance`.
7. **Preview Approval Binding**: Production deployment requires an approved Preview artifact that
   matches exact source/package hashes and plan ID when the runbook requires that gate.
