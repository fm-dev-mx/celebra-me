# Canonical Invitation Creation Contract — Celebra-me

This document defines the authoritative, global contract required for any human or AI agent to
create, validate, preview, publish, and update a managed digital invitation within Celebra-me across
Local, Preview, and Production targets.

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

## 2. Mandatory Pipeline Boundaries & Verification

1. **Intake & Normalization**: Validate raw asset binaries (MIME type, 480px+ dimension, sharpness,
   WebP conversion) and compute `sourceHash` & `assetManifestHash`.
2. **Canonical Publication Validation**: Validate `draftContent` against `eventContentSchema` before
   release acceptance, packaging, or database/storage mutation.
3. **Immutable Operational Plan**: Generate deterministic `OperationalPlan` containing `planId`,
   target preconditions (fingerprints of existing draft updated timestamp and published version),
   functional changes, and physical DB/Storage counts.
4. **Drift Protection**: Verify target preconditions immediately before apply; abort if target state
   has drifted.
5. **Bounded DB & Storage Apply**: Publication uses the atomic publication boundary. Other hosted
   upserts and Storage writes use compensation. If a pre-existing overwrite cannot be restored or
   final consistency cannot be verified, report `ERROR — REQUIERE REVISIÓN`; never claim a full
   rollback.
6. **Provenance Recording**: Record release provenance in
   `public.managed_invitation_release_provenance`.
7. **Preview Approval Binding**: Require an approved Preview artifact matching exact source/package
   hashes and plan ID before Production deployment.
