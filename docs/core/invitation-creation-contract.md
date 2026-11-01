# Canonical Invitation Contract — Celebra-me

**Owns:** the order in which an invitation is created; preparation semantics (classifications,
canonical Markdown, placeholders, asset preparation, preparation readiness); identity and required
fields (what must exist before apply); the authoring boundaries of profiles, slug compositions,
variants and presets; and the pre-push check.

**Does not own:** operational runbook steps, CLI flags, packaging, target order, agent safety
constraints, the dashboard draft/publish state machine, or technical Local/Preview/Production
readiness (`invitation-readiness.ts` / **envReadiness**). Those live in:

- Runbook — [`docs/domains/intake/production-flow.md`](../domains/intake/production-flow.md)
- Safety constraints —
  [`.agent/rules/invitation-production.md`](../../.agent/rules/invitation-production.md)
- Dashboard draft → publish —
  [`.agent/rules/intake-publishing.md`](../../.agent/rules/intake-publishing.md)

Related authorities:

- Preparation workflow —
  [`.agent/skills/invitation-preparation/SKILL.md`](../../.agent/skills/invitation-preparation/SKILL.md)
- Analysis skill —
  [`.agent/skills/client-invitation-audit/SKILL.md`](../../.agent/skills/client-invitation-audit/SKILL.md)
- Executable preparation SSOT —
  [`src/lib/invitation-preparation/`](../../src/lib/invitation-preparation/)
- Markdown template —
  [`.agent/templates/invitation/preparation-state.md`](../../.agent/templates/invitation/preparation-state.md)
- Durable per-invite state — `docs/invitations/<slug>.md`

See the invitation authority chain in [`.agent/index.md`](../../.agent/index.md).

---

## Creation workflow

Every new invitation follows these steps in order. A step may be revisited, but none is skipped.

| Step               | Output                                                                   | Section                                                      |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Preparation     | `docs/invitations/<slug>.md` with a helper-backed `prepReadiness`        | [Preparation](#1-preparation)                                |
| 2. Aesthetic brief | Three references, hero decisions and one owner-accepted viewport         | [Aesthetic brief](#2-aesthetic-brief)                        |
| 3. Definition      | `src/invitations/clients/<slug>/invitation.ts` with every required field | [Identity](#3-invitation-identity--requirements)             |
| 4. Styling         | Tokens, then an optional slug composition; variants stay experimental    | [Styling](#4-styling-tokens-composition-variants-presets)    |
| 5. Pre-push        | Every local guard green before the first push                            | [Pre-push](#5-pre-push)                                      |
| 6. Acceptance      | Readable composition and the human creative outcome                      | [Acceptance](#6-acceptance)                                  |
| 7. Release         | Preview, approval and Production by the runbook                          | [`production-flow.md`](../domains/intake/production-flow.md) |

Conceptual lifecycle: **Preparation → Implementation → Managed lifecycle / publication**.

---

## 1. Preparation

### 1.1 Intake channels

| Channel                                                     | Role             | Notes                                                                                 |
| ----------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Full chat / WhatsApp (text, photos, videos)                 | **Evidence**     | Facts, preferences, constraints, ambiguities; media proves claims, not managed assets |
| High-resolution (HR) photo URL or approved folder/repo path | **Asset source** | Required before photograph inventory                                                  |
| Dashboard intake / editor publish state                     | **Out of scope** | Owned by intake-publishing + publication chain — not this contract                    |

WhatsApp / conversation material is a source of client facts, event requirements, preferences,
explicit decisions, constraints, textual content, and unresolved ambiguities.

It is **not** the authoritative source of invitation photographs or managed visual assets. Chat
attachments must not be ingested into managed asset storage. Photos for production inventory must
come from an explicit high-resolution URL and/or filesystem/repository path supplied for the
invitation, then processed under the asset-preparation protocol.

Do not implement WhatsApp API synchronization in this contract. The workflow operates on supplied
conversation material only.

### 1.2 Information classifications

Canonical states (executable: `InfoClassification` in
`src/lib/invitation-preparation/classification.ts`):

| State                     | Meaning                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `verified`                | Explicit supporting client/source evidence exists                        |
| `inferred`                | Agent-derived; must include basis; never presented as a client statement |
| `ambiguous`               | Competing interpretations preserved in notes                             |
| `missing`                 | Not present; absence is not consent                                      |
| `not_applicable`          | Event contract or invitation scope excludes the field                    |
| `requires_owner_decision` | Subjective/commercial choice; recommendation must not auto-apply         |

Creative recommendations must be stored under **Agent Recommendations**, never as `verified` client
requirements until explicitly approved.

**Ambiguous-fact discipline:** `ambiguous` on a required or conditional completeness field is
**blocking** until resolved or validly marked `not_applicable`. Do not describe the invitation as
complete, done, or release-ready while such ambiguity remains.

**Media evidence interpretability:** Supplied audio, image, or video material may provide evidence
only when its substantive information can be reliably interpreted. Unavailable, unintelligible, or
otherwise unreliable media must never be reconstructed from surrounding conversational context and
must remain `ambiguous` or `missing`, as appropriate, when material to preparation. This does not
change the WhatsApp-vs-HR asset boundary (§1.1) or info-hygiene (§1.4.1): raw transcripts and media
dumps must not become durable preparation state.

**Identity spelling freeze:** Before freezing `slug` and `hostLoginAlias`, celebrant/honoree name
orthography must be `verified` (or an explicit owner override recorded). Do not lock identity on
inferred spelling.

**Slug vs route:** Never include `eventType` in the slug. The public path is already
`/{eventType}/{slug}` — see Canonical Slug in [Identity](#3-invitation-identity--requirements).

### 1.3 Event-type completeness

Executable contracts live in `src/lib/invitation-preparation/event-completeness.ts` (**SSOT**).

Each field supports: `required` | `conditional` | `recommended` | `optional`.

Contract maturity:

| Maturity          | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `evidence-backed` | Sufficient verified practice to evaluate preparation completeness |
| `partial`         | Some fields evidenced; gaps documented                            |

Current posture:

- `xv` — evidence-backed
- `boda`, `cumple`, `baby-shower`, `bautizo`, `primera-comunion` — partial (evidenced field lists in
  `event-completeness-contracts.ts`; the two sacraments come from one invitation each)

**Process for partial contracts:** Evaluate only defined fields; record maturity gaps in Markdown;
apply client-specific constraints from chat as classified facts. Do not invent XV-scale matrices for
under-evidenced event types.

Live event-type identifiers use `cumple` (not `cumpleanos`).

The structure side of the same event-type contract (required sections and verified theme presets)
lives in `src/lib/invitation/event-type-contract.ts`. `defineInvitation` rejects a definition that
breaks it, and `tests/content/event-type-contract.test.ts` checks every definition and demo.

`evaluateEventCompleteness(eventType, facts)` answers deterministically whether available
information is sufficient to prepare (no blocking unresolved required/conditional fields).

### 1.4 Canonical invitation Markdown

Path: `docs/invitations/<slug>.md`

This file is the durable preparation source of truth. Update it in place. Conversation context and
tracked plans must not replace it.

Required sections match `.agent/templates/invitation/preparation-state.md`:

Identity, Sources, Fact Register, Event Completeness, Placeholders, Owner Decisions, Agent
Recommendations, Sections, Design Direction, Photograph Inventory (including uniqueness),
Implementation Constraints, Preparation Readiness.

#### 1.4.1 Info-hygiene — persist vs session-only

| May persist in `docs/invitations/<slug>.md`                                         | Session-only / never commit                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Opaque source labels (e.g. `source:wa-export`, `source:hr-photos`)                  | Absolute OneDrive / `Clientes\` / user-profile paths                 |
| Classified facts needed to build the invite (names, dates, venues as event content) | Full chat exports, raw transcripts, photo/video dumps                |
| Repo-relative asset paths under the repository                                      | Chat folder titles that embed contact names (`WhatsApp Chat - …`)    |
| High-level “HR photo URL on file (session)” without the secret URL                  | Paste of payroll / HR-portal / credential-bearing / environment URLs |
| Quality labels, role map, uniqueness table                                          | Screenshots of private chats committed as binaries                   |

**Forbidden in durable prep docs and agent commits:** absolute machine paths to client folders;
chat-title dumps as durable identity; human-resources/payroll/internal portal URLs; secrets;
credential-bearing links.

**Demo crossover:** never point a demo `_assetSlug` at a real client asset directory (see skill
content-profile invariants).

### 1.5 Missing-information semantics

| Kind                      | Effect                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| Blocking missing data     | Prevents READY_*; implementation forbidden when `NOT_READY`          |
| Non-blocking missing data | May use a controlled placeholder; preparation may continue           |
| Ambiguous data            | Requires resolution; blocking when the field is required/conditional |
| Owner decision            | Cannot be inferred                                                   |
| Not applicable            | Valid closed state                                                   |

Do not fabricate plausible client content as a substitute for missing information.

### 1.6 Placeholder policy

Tokens: `[[PENDIENTE:FIELD_ID]]` (grep-able).

- Register every placeholder in the Markdown.
- Identify the real missing datum and replacement requirement.
- Never treat a placeholder as verified production content.
- Blocking placeholders ⇒ `NOT_READY`.
- `READY_WITH_PLACEHOLDERS` may contain only documented non-blocking placeholders.

Helpers: `createPlaceholderToken`, `findPlaceholderTokens`, `validatePlaceholderRecords`.

### 1.7 Asset preparation

1. Require an explicit high-resolution URL and/or source asset path (opaque label in Markdown).
2. Inventory images; preserve originals.
3. Record dimensions, format, orientation, weight, quality, role, duplicates, processing.
4. Classify WhatsApp-compressed material as `provisional-whatsapp`.
5. Produce a **photo uniqueness** map: each production role has a distinct source unless intentional
   multi-role reuse is documented.
6. Produce a role-aware optimization **plan** using the canonical transfer-weight targets in
   `image-optimization.ts`; role-aware managed delivery enforces those targets while generic and
   historical assets retain the hard safety limits for compatibility.
7. Do not bind one uploaded asset (same spec key / asset id) to published paths with different
   delivery roles. Same source photograph + two role-encoded derivatives is the allowed form of
   multi-role reuse (`hero.backgroundImage` vs `hero.backgroundImageMobile`). Dashboard publish and
   managed release both validate bytes against `getImageOptimizationRoleForPath(path)`.
8. Do not recompress already suitable images solely for process theater.
9. Generate derivatives only when crop/DPR/role weight justifies it.
10. **Double-encode note:** Prefer delivering already-normalized managed-release WebPs without a
    second Astro/`getImage` encode that upscales or re-compresses past native width (see Hero
    managed-URL direct delivery). Record the risk when sources are provisional.
11. **Social card (`ogShare`):** compose it natively at 1200×630 (1.91:1). WhatsApp often shows a
    small square thumbnail cropped from the centre, so the focal artwork must sit inside the central
    630×630 square (x 285–915) with no seams, strips or hard edges there. Never paste a portrait
    hero onto a wide background as the social card. Review the centre-square crop before release.

Prepared managed media must use direct delivery. Storage and R2 URLs do not request an implicit
Astro transformation, including content-addressed objects. Preserve explicit `original` dimensions
on references where layout requires them. Historical explicit `optimized` contracts remain readable
until their prepared replacements are published; new canonical managed references must not depend on
this compatibility path. Bundled demo/template assets retain their separate Astro pipeline.

Existing `normalizeInvitationImage` and publish dimension gates remain the runtime enforcers.
WhatsApp attachments never become managed assets without this protocol and explicit quality labels.

Helpers: `planImageOptimization`, `summarizeAssetQuality`, `isProductionAuthoritativeImage`.

### 1.8 Theme preset and visual decisions

Invitations do not depend on demos: a demo is only a visual reference for its theme preset, and the
preparation record carries no base demo (`baseDemoId` is not a preparation field).

- Record the decision in the Design Direction row `Selected theme preset`; it gates readiness.
- Client-selected preset (or a chosen demo, which identifies its preset) ⇒ `verified`.
- No selection ⇒ recommend options; final choice `requires_owner_decision`.
- Client colors preserved when stated; otherwise recommend separately until approved.

### 1.9 Preparation readiness (**prepReadiness**)

Independent from technical publication readiness (**envReadiness** — `invitation-readiness.ts` /
`pnpm invitation:release -- --status`).

| State                      | Meaning                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `NOT_READY`                | Blocking gaps/assets/decisions remain; **no** payload/SCSS implementation                           |
| `READY_WITH_PLACEHOLDERS`  | Structure resolved; only documented non-blocking placeholders and/or provisional asset replacements |
| `READY_FOR_IMPLEMENTATION` | Required facts/assets/decisions resolved; production-authoritative assets; no placeholders remain   |

#### 1.9.1 Helper is SSOT

Executable evaluation in `src/lib/invitation-preparation/readiness.ts` is the **only** authority for
prepReadiness:

- `evaluatePreparationReadiness`
- `summarizeAssetQuality` / `onlyNonProductionImages`
- `canBeginImplementation` / `assertImplementationAllowed`

**Markdown must mirror the helper.** Hand-editing `READY_FOR_IMPLEMENTATION` while assigned
production roles remain `provisional-whatsapp` (or `summarizeAssetQuality` reports
`onlyNonProductionImages: true`) is **invalid**. The correct ceiling is `READY_WITH_PLACEHOLDERS`
until production-ready assets exist.

Agents must **cite** the helper outcome when updating Preparation Readiness (session note + history
row). Repository gate: `pnpm validate:invitation-preparation` (Markdown prepReadiness ↔ helpers +
hygiene). Prose alignment to the helpers remains mandatory between runs.

#### 1.9.2 Creative acceptance is a separate human gate

The canonical machine-readable field is `**Human creative outcome:**` followed by exactly one of
`PENDING`, `ACCEPTED`, `ACCEPTED_WITH_BLOCKERS`, or `REJECTED`. Only exact `ACCEPTED`, together with
a `prepReadiness` other than `NOT_READY`, permits a future `in_progress -> published` transition.
Existing published definitions are audited as warnings and are not rewritten.

`prepReadiness` answers whether preparation is sufficiently resolved to begin implementation. It
does **not** mean that the rendered invitation is creatively finished. After implementation and
before final acceptance or release, the invitation must receive a lightweight creative-QA review
recorded in the canonical preparation Markdown (and optionally detailed in the existing
[`creative-qa-report.md`](../../.agent/templates/creative/creative-qa-report.md)).

The review is whole-invitation, not a collection of isolated screenshots. At minimum inspect one
representative mobile viewport and one desktop viewport (the default proof pair is 390 × 844 and
1440 × 900; a focused browser review may use equivalent dimensions when documented), and assess:

- typography roles, vertical rhythm/density, and surface hierarchy;
- photographic treatment and focal crops;
- section boundaries, intersection intent, and narrative continuity;
- local exceptions to the selected preset;
- responsive reflow, legibility, focus, reduced motion, and visible/operational placeholders.

Record mechanical capture/render status separately from the human outcome. The human outcome is one
of `PENDING`, `ACCEPTED`, `ACCEPTED_WITH_BLOCKERS`, or `REJECTED`; only an explicit human `ACCEPTED`
may clear creative acceptance. `ACCEPTED_WITH_BLOCKERS` names a non-creative dependency and remains
blocking for the applicable release boundary. Pixel thresholds, image diffs, and visual snapshots
are not part of this contract.

This gate does not replace executable readiness or publication preflight. The helpers and release
checks remain authoritative for their respective invariants; the QA record supplies the explicit
human decision that automation cannot make.

### 1.10 Owner interaction

Before asking the owner anything, exhaust conversation material, canonical Markdown, event contract,
assets, repository conventions, compatible demos, and deterministic project knowledge.

Then emit one consolidated owner decision pack (`buildOwnerDecisionPack`) whenever feasible.

Conversational phase script (checkpoints and hard-stops): [`.agent/skills/client-invitation-audit/references/conversational-phase-script.md`](../../.agent/skills/client-invitation-audit/references/conversational-phase-script.md).
---

## 2. Aesthetic brief

Before any definition, profile or SCSS, settle the visual direction with the owner in one brief,
recorded in the Design Direction table of `docs/invitations/<slug>.md`:

1. **Three references.** Three images or published pages that show the intended look (a demo, a
   previous invitation, an external reference), each with one line on what to take from it (palette,
   typography, hero framing, ornament).
2. **Hero decisions.** Photo or illustration, the focal crop, and the size of the celebrant's name
   relative to the viewport (for example "name fills about 60 % of the mobile width").
3. **One accepted viewport.** A single capture or mock-up of the first mobile screen (390 × 844)
   that the owner explicitly accepts. Record the acceptance with its date.

Implementation starts only when the three items exist and `prepReadiness` allows it. Direction
changes after the accepted viewport are new brief rounds: record them in the same table instead of
iterating directly in code.

---

## 3. Invitation Identity & Requirements

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
  with the editorial cover reveal. A standalone reveal skin (`celestial-letter`, `satin-filigree`,
  `seaside-lineart`, `storybook-lanterns`, `storybook-butterflies`) replaces the preset-driven
  `data-variant` and its stylesheet. Otherwise `envelope.variant` (a theme preset name) selects the
  skin, falling back to `theme.preset` when omitted; `revealVariant: celestial-blue` layers on top
  of it (`src/lib/invitation/reveal-card.ts`).
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
- **Voice** (`voice`, optional, default `usted`): the register of the guest-facing copy, `usted` or
  `tu`. A definition without the field is treated as `usted` (`resolveInvitationVoice`); `tu` is an
  explicit client request. It is authoring metadata only: it never enters the published content, the
  release metadata, or any hash, so adding it changes no `sourceHash` or `packageHash`.
  `tests/unit/invitation-voice-register.test.ts` checks every unpublished `usted` definition for
  «tú» forms (list in `tests/helpers/tu-register.ts`); copy addressed to someone other than the
  guests, such as a prayer to God, is exempted there by slug and content path. Published definitions
  are not rewritten to adopt it (A7 in
  [invitation standards](../domains/theme/invitation-standards.md)).
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
- **Initial administrative state**: a new invitation exists only through its managed definition; the
  dashboard editor edits existing invitations and has no create or duplicate endpoint. A new row
  starts with work status `in_progress` and no manual review, and with `payment_status: unpaid` and
  `public_access: enabled`, so it renders as the unpaid preview until an administrator marks it
  paid. Release never copies these decisions between environments
  ([intake-publishing](../../.agent/rules/intake-publishing.md)).
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

---

## 4. Styling: tokens, composition, variants, presets

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
- Client text belongs in content data, never in CSS `content:` or baked into an image. Canonical
  grid, order, required visibility, and structural breakpoints belong to the section variant's
  semantic SCSS entrypoint. See
  [`docs/domains/theme/architecture.md`](../domains/theme/architecture.md#invitation-css-ownership-normative).
- Reference client photographs and artwork through the invitation's typed semantic asset keys. Do
  not import another invitation's files from reusable code or styles.
- Author non-neutral boundary choices in typed `composition.intersections`; do not derive them from
  slug or profile identity.

### Profile in two levels

An invitation's own styling has two levels, both in `src/invitations/clients/<slug>/`:

1. **Tokens — `profile.scss`.** Custom-property declarations only: client palette remap and
   rhythm/intersection token overrides. Selectors and wrapping `@media`/`@supports`/`@container` may
   scope tokens; nothing else emits output. Example:
   `.event--ana-lopez { --color-action-accent: rgb(186 140 74); }`.
2. **Composition — `composition.scss` (optional).** Real declarations for what tokens cannot express
   (a tower-door hero frame, a perforated ticket edge). `profile.scss` loads it with
   `@use './composition';` as its first line. Its limits:
   - every top-level rule starts with the invitation's own `.event--<slug>` selector, so nothing
     leaks into another invitation;
   - at most **600 lines**;
   - it never edits, `@use`s, `@forward`s or overrides `src/styles/invitation/scenes/**`, and never
     imports another invitation's files; it may `@use` `src/styles/tools/**` and font-face modules;
   - client text still comes from content data (`content:` stays for ornaments only).

Reach for the composition only after trying tokens. A composition that approaches the line limit is
a signal to promote part of it as a variant (below).
`tests/unit/invitation-profile-boundary.test.ts` enforces both levels.

### Experimental variants

A reusable variant may originate during invitation work: it starts as an **experimental variant**
inside the slug composition: rules under `.event--<slug>` that reshape an existing canonical
variant's DOM, with tokens that may carry the slug's own prefix (`--ana-lopez-ticket-edge`). It
ships with the invitation and changes nothing for any other invitation.

Promotion to the shared library is a **separate PR** after the invitation is accepted:

- the variant gets a design name (never the client's), a typed `section.variant` contract, isolated
  CSS delivery and invalid/incompatible tests;
- its tokens move to the variant prefix (`--ticket-edge-*`) or to `--scene-*` for scene-wide values;
  shared SCSS never reads a `--<slug>-*` token;
- a portability proof renders it in a non-origin invitation or demo without the originating profile
  or assets;
- the token-shadowing guard runs and the PR names every published invitation whose look changes.

The originating invitation then swaps its experimental rules for the promoted variant in the same PR
or a later one; until then its composition stays as it is.

### Presets and derived presets

A **preset** is a reusable atmosphere (semantic color, type, radius, motion and public component
tokens) under `.theme-preset--<name>`. A new standalone preset needs two consumers (invitations or
demos) when it is created.

A **derived preset** extends an existing base preset and declares only its overrides; it may start
with **one consumer**. Use it when an invitation's look is a coherent variation of a base preset
that would otherwise push hundreds of token lines into a profile. Its rules:

- a new `THEME_PRESET_METADATA` row and its own `_<name>.scss` partial, whose header comment names
  the base preset; it re-declares only the tokens that differ;
- it owns no section layout or client-specific values (names, photos, slug selectors);
- it leaves with its last consumer, like any preset.

`jewelry-box-wedding` (base `jewelry-box`) is the existing example of the pattern.

---

## 5. Pre-push

Run the guards locally before the **first** push of an invitation branch, and again before any push
that touches SCSS, a definition or a profile. CI repeats them; it is not the place to discover them.

```sh
pnpm validate:changed
pnpm visual:matrix:check
pnpm exec jest tests/unit/invitation-token-shadowing.test.ts tests/unit/style-scale-literals.test.ts tests/unit/visual-coverage-lifecycle.test.ts tests/unit/invitation-profile-boundary.test.ts
pnpm invitation:hash-baseline -- --strict
```

- `validate:changed` runs lint, types and the tests related to the changed files.
- `visual:matrix:check` fails when a published invitation was added or changed and the visual matrix
  hash is stale; regenerate it as the message says.
- The token-shadowing test fails when a variant token redeclares a token another invitation
  inherits; scope the token under the variant instead.
- `invitation:hash-baseline -- --strict` must report no collateral move for invitations outside the
  task. A changed `sourceHash` of a published invitation means its definition moved and forces a
  re-release.
- When the change is visual and touches only this invitation's own files, compare just its page with
  `pnpm visual:parity:affected:certified -- --sha <commit> --base-sha <base commit>`. When it
  touches shared files or changes the matrix, produce the pinned full candidate and have it accepted
  before pushing ([CSS visual parity](../domains/theme/css-visual-parity.md)); a branch that reaches
  CI without its accepted captures stays red. The owner feedback loop is the
  `invitation-visual-iteration` skill.

---

## 6. Acceptance

### Readable composition

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

### Creative outcome

The human creative outcome gate is defined in
[Creative acceptance](#192-creative-acceptance-is-a-separate-human-gate): only an explicit owner
`ACCEPTED` clears it.

---

## 7. Required Pipeline Invariants

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

## 8. Local Render Corpus vs Canonical Registry

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

## 9. Environment Observability & Identity Rekey Boundaries

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

A new standalone preset needs two consumers (invitations or demos) when it is created; a derived
preset may start with one ([Presets and derived presets](#presets-and-derived-presets)); otherwise
use a section variant, a visual profile or a slug composition. An existing preset may remain while
at least one live invitation or demo uses it, and leaves with its last consumer. Single-consumer
presets today: `jewelry-box` (`naydelin-paredes`), `storybook-lilac` (`america`), `enchanted-rose`
(its demo) and `sacred-keepsake` (the published `cesar-ramses` until it expires; see above). This
wording supersedes the "≥2 consumers" existence rule in the
[theme architecture](../domains/theme/architecture.md) for presets that already exist and for
derived presets.

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
