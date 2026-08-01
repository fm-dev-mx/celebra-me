---
title: Boda Perla y Carlos — Implementation Audit (Goal 1)
status: active
created: 2026-08-01
updated: 2026-08-01
related_docs:
  - docs/invitations/boda-perla-y-carlos.md
  - .agent/plans/active/boda-perla-y-carlos-audit-backlog.md
  - docs/domains/theme/architecture.md
  - docs/domains/invitations/reveal-gate-automation.md
related_rules:
  - .agent/rules/invitation-production.md
  - .agent/rules/invitation-preset-source-of-truth.md
---

# Goal 1 — Implementation audit: `boda-perla-y-carlos`

**Purpose:** Map how the invitation is implemented so Goal 2 can apply the **already identified**
visual / content / interaction corrections without another exploratory or design pass.

**Out of scope here:** implementing visuals, reopening design review, inventing components /
tokens / contracts, unrelated refactors.

**Fixed correction scope (from prior review + required decisions):** reveal CTA duplication,
opening transition / composition gaps, hero metadata skew, quote/countdown/location/family/gallery/
RSVP/thank-you presentation issues already flagged, provisional family handling, civil-ceremony
representation, RSVP label visibility in captured state, removable assets/code.

---

## 1. Section-to-file map

| Area | Ownership | Primary files |
| ---- | --------- | ------------- |
| **Provision / content SoT** | Invitation-specific | `scripts/provision/invitations/boda-perla-y-carlos.ts`, registry `scripts/provision/invitations/registry.ts` |
| **Prep facts** | Docs (not runtime) | `docs/invitations/boda-perla-y-carlos.md` |
| **Lane A skin** | Invitation-specific SCSS | `src/styles/invitation-profiles/boda-perla-y-carlos.scss` |
| **Assets** | Invitation-specific | `src/assets/invitations/boda-perla-y-carlos/{hero-source,hero-mobile-source,gallery-01-source}.jpg` |
| **Route / page ctx** | Shared | `src/pages/[eventType]/[slug].astro`, `src/lib/invitation/page-data.ts`, `content-resolver.ts`, `section-css-resolver.ts` |
| **Adapt / schema** | Shared | `src/lib/adapters/event.ts`, `db-event-adapter.ts`, `src/lib/schemas/content/*` |
| **Render plan** | Shared | `src/lib/invitation/render-plan.ts`, `section-render-data.ts` |
| **Reveal** | Shared Astro + scripts | `EnvelopeReveal.astro`, `InvitationRevealCard.astro`, `reveal-manager.ts`, `reveal-card.ts`, `invitation/_envelope-reveal.scss`, `themes/sections/reveal/shared-light` (via wedding bundle) |
| **Hero** | Shared Astro + base SCSS | `Hero.astro`, `invitation/_hero.scss`, `themes/sections/hero/_base.scss` — **jewelry-box hero partial not in wedding bundle** |
| **Quote** | Shared | `Quote.astro`, `invitation/_quote.scss` |
| **Countdown** | Shared | `Countdown.astro`, `CountdownTimer.astro`, `invitation/_countdown.scss` — jewelry-box countdown partial not in wedding bundle |
| **Location / dress / civil** | Shared markup; Perla content | `EventLocation.astro`, `VenueCard.astro`, `location-helper.ts`, `location-policy.ts`, `invitation/_event-location.scss`; indications owned by provision payload |
| **Family** | Shared + Perla content | `Family.astro`, `invitation/_family.scss`; groups/labels in provision |
| **Gallery** | Shared + Perla 1-item content | `Gallery.astro`, `PhotoGallery.astro`, `GalleryLightbox.astro`, gallery jewelry-box **is** in wedding bundle |
| **Personalized access** | Shared | `PersonalizedAccess.astro`; PA tokens remapped in Lane A |
| **RSVP** | Shared React island | `RSVP.tsx`, `RSVPFormFields.tsx`, `RSVPComponents.tsx`, `rsvp-logic.ts`, `use-rsvp-submission.ts`, `src/lib/client/rsvp-api.ts`, `invitation/_rsvp.scss` — jewelry-box RSVP partial **not** in wedding bundle |
| **Thank you** | Shared + Lane A DOM override | `ThankYou.astro`, `invitation/_thank-you.scss`; profile targets `[data-variant='jewelry-box-wedding']` |
| **Preset / section CSS** | Shared | `invitation-presets/jewelry-box-wedding.scss` → `_jewelry-box-wedding.scss`; `invitation-sections-by-preset/jewelry-box-wedding.scss` (thin: reveal, header, gallery, gifts, itinerary only) |
| **Motion / transitions** | Shared | `motion-coordinator.ts`, `InvitationSections.astro`, `REVEAL_RECIPES` in `section-render-data.ts` |
| **Base demo (Lane B reference only)** | Shared catalog | `src/content/event-demos/boda/demo-boda-jewelry-box-wedding.json` |

**Composition boundary:** Hero + Envelope + Header sit outside `InvitationSections`. Sections follow
provision `sectionOrder` (hero is page-level, not in that array).

**Only client island on the public route:** `RSVP` with `client:visible`.

---

## 2. Current data and interaction flow

```
Provision buildPublishedContent (boda-perla-y-carlos.ts)
  → invitation:update / publish → DB published_invitation_content
  → [slug].astro → resolveInvitationContent → adaptDbEvent → adaptEvent
  → buildPageContextFromViewModel (location-policy, envelope, heroTime/Venue, CSS URLs)
  → EnvelopeReveal + EventHeader + Hero + InvitationSections + Footer
       InvitationSections → descriptors → Astro sections + RSVP island
       initInvitationMotion() for scroll reveals
```

### Metadata flow (duplication map)

| Datum | Canonical raw | Formatted / derived | Risk |
| ----- | ------------- | ------------------- | ---- |
| Timing | `PERLA_EVENT` (`localDateTime`, `startsAtUtc`, `timeZone`, `heroDate`) | Countdown via `resolveCountdownTarget`; Hero date via UTC `toLocaleDateString('es-MX')`; reveal card via `formatCardDate`; envelope teaser **explicit** `teaserDetails` | Multiple formatters; location uses **hand-written** Spanish date/time strings |
| Venues | Provision `location.ceremony` / `reception` | Adapter keeps legacy shape; `EventLocation` builds cards; `groupVenues` by maps URL | Two distinct Maps URLs → two cards (correct for dual venue) |
| Hero venue/time | Same location object | `page-data.pickHeroValue`: `venues[0]` → **reception** → ceremony; adapter `pickVenueValue` also prefers **reception** | Hero shows **Salón / 7:30**, not church / 5:30 |
| Civil | Indication text only | Not a venue, not itinerary | Matches OD2 “inside location”; not on VenueCard |
| Dress | `location.indications[0]` | EventLocation indications panel | Content-owned |
| Family | Published groups with `"Por confirmar"` | No raw `[[PENDIENTE:]]` in content (payload test) | Guest sees soft placeholders |
| Gallery | 1 uploaded item | Adapter drops empty; UI is multi-capable | Singular by content, not by schema |
| RSVP labels | `sectionStyles.rsvp: {}` → `labels` undefined | `resolveLabels()` fills Spanish defaults at client | DOM labels exist; visibility is a **contrast/skin** issue |
| Optional sections | Omitted keys (`gifts`, `music`, `itinerary`, padrinos) | `hasRenderableSection` / omit object | Correct |

### Reveal interaction

- Two live `[data-envelope-open]` controls when `microcopy` is set: seal button (+ hint from
  `tooltipText`) and external microcopy button (`EnvelopeReveal.astro`).
- Perla sets **identical** strings for `microcopy` and `tooltipText` → two “Abrir invitación”
  affordances. **Structural**, not capture artifact.
- States: `sealed` → opening → `revealed` (or screenshot `preview-opened` / `letter-held`).
- Reduced motion: immediate complete. Screenshot + `reveal=` per
  `docs/domains/invitations/reveal-gate-automation.md`.

### RSVP interaction

- Hybrid + API; public POST `/api/invitacion/public/{eventType}/{slug}/rsvp`.
- Validation/submit/retry in `useRsvpSubmission` + `rsvp-logic`.
- Personalized access section only when guest or demo preview.

---

## 3. Reusable patterns to preserve

1. **Lane A dual-scope token remap** — `.event--boda-perla-y-carlos.theme-preset--jewelry-box-wedding`
   with local `--perla-*` + RGB channels (do not mutate shared preset).
2. **Inheritance-reset checklist** — family sepia kill, PA champagne paper override, location
   indication retint (already in profile; extend same pattern for RSVP band).
3. **Content owns copy** — dress/civil/family soft-copy live in provision, not CSS.
4. **CSS delivery chain** — preset → `invitation-sections-by-preset` → visual profile
   (`docs/domains/theme/architecture.md`).
5. **Reveal automation contracts** — prefer `?skipEnvelope=true` / `?screenshot=1&reveal=open` for
   verification; do not invent new gate APIs.
6. **Gallery as array** — keep length-1 content; do not invent a single-image component.
7. **Omit unused sections** — continue omitting gifts/music/itinerary/padrinos from payload and
   `sectionOrder`.

---

## 4. Confirmed duplication, obsolete code, privacy

### Duplication

- **Date/time:** ISO in `PERLA_EVENT` + Spanish strings in location venues + thankYou.date +
  calendar description narrative + envelope teaser.
- **Maps URLs:** duplicated as `mapUrl` and `googleMapsUrl` on each venue (adapter/schema pattern).
- **Hero assets:** `hero-source.jpg` and `hero-mobile-source.jpg` are **byte-identical**
  (SHA-256 `0BBF4C98…`); only focal points differ in specs.
- **Reveal CTA copy:** `microcopy` === `tooltipText`.
- **Venue preference:** both `pickVenueValue` (adapter) and `pickHeroValue` (page-data) prefer
  reception over ceremony for hero metadata.

### Obsolete / unreachable for this invite

- Wedding section bundle does **not** load `themes/sections/{hero,countdown,rsvp,thank-you}/_jewelry-box.scss`
  (XV `jewelry-box` bundle does). Perla rides base invitation SCSS + preset tokens + Lane A.
- Bundled gifts/itinerary jewelry partials unused (sections omitted).
- No Perla entry in `intersection-profiles.ts` (neutral — OK).

### Privacy

- Perla `location.visibility: 'public'` → full addresses/maps in HTML (intentional).
- Family placeholders are **guest-facing soft copy**, not prep tokens (good).
- RSVP island serializes only RSVP props (+ invite guest fields when present).
- Prep tokens `[[PENDIENTE:*]]` stay in Markdown only; payload test asserts absence in content.
- `clientEmail` / `clientWhatsapp` empty in definition — no extra PII in provision.
- No additional unpublished admin fields identified on the public serialization path beyond normal
  published content.

---

## 5. Exact files to modify / consolidate / delete (Goal 2)

### Modify (expected)

| File | Why |
| ---- | --- |
| `scripts/provision/invitations/boda-perla-y-carlos.ts` | Reveal CTA copy; hero venue/time representation; civil/family/gallery/RSVP content corrections within existing schema; asset path consolidate |
| `src/styles/invitation-profiles/boda-perla-y-carlos.scss` | Fix RSVP dark-band vs cream labels; spacing tweaks that must stay Lane A; thank-you/location token fixes without Lane B |
| `tests/content/boda-perla-y-carlos-payload.test.ts` | Lock corrected content contracts |
| `docs/invitations/boda-perla-y-carlos.md` | Record implementation notes only if facts/decisions change |

### Optional shared touch (only if Goal 2 chooses shared fix — prefer Lane A first)

| File | When |
| ---- | ---- |
| `src/lib/invitation/page-data.ts` / `src/lib/adapters/event.ts` | Only if hero ceremony-first is declared a **shared** bug; otherwise fix Perla via `venues[]` order or explicit hero fields without changing global preference |
| `src/styles/invitation-sections-by-preset/jewelry-box-wedding.scss` | Only if owner accepts Lane B: compose jewelry-box hero/rsvp/thank-you partials with wedding `data-variant` aliases |
| `src/components/invitation/EnvelopeReveal.astro` | Only if shared CTA UX change is required; prefer content (`tooltipText` / empty microcopy) first |

### Delete / consolidate

| Item | Action |
| ---- | ------ |
| `src/assets/invitations/boda-perla-y-carlos/hero-mobile-source.jpg` | Delete after pointing `hero-mobile.relativePath` at `hero-source.jpg` (keep distinct focals) |
| Dead profile selectors | None currently required beyond prior cleanup; do not delete shared jewelry-box partials (used by XV) |

### Do not invent

- New section components, tokens, itinerary schema fields, or RSVP API contracts.
- Multi-image gallery slots (OD4 freeze).
- Parent names (OD5).

---

## 6. Tests and docs to update

| Coverage | Status | Goal 2 action |
| -------- | ------ | ------------- |
| `tests/content/boda-perla-y-carlos-payload.test.ts` | Exists — schema, sectionOrder, Por confirmar, gallery length 1, rsvp modes | Extend assertions for corrected teaser/CTA fields, civil indication, family policy, asset path |
| Envelope / reveal unit+E2E | Shared (`envelope-reveal-interaction`, `reveal-gate-automation-contract`) | Reuse; no Perla-specific suite required unless CTA content regresses |
| RSVP unit/API/E2E | Shared | Spot-check labels contrast manually; add payload assert only if `sectionStyles.rsvp.labels` set |
| Motion / progressive visibility | Shared jewelry-box demos | Optional smoke on Perla local route with reveal bypass |
| Location policy | Shared unit | Unchanged (public visibility) |
| Prep validate | `validate:invitation-preparation` | Re-run after content edits |
| Docs | Prep MD + this audit + audit-backlog | Update prep only for decided fact changes; keep design direction frozen |

**Missing coverage to add (minimal):**

1. Payload: hero-mobile shares source file path (after consolidate).
2. Payload or unit: family visibility/policy after Goal 2 decision (publish soft vs omit).
3. Manual/browser: RSVP label contrast after Lane A band fix; reveal CTA count after copy fix.
4. No dedicated visual-regression suite for this slug today — use reveal-gate automation + local smoke.

---

## 7. Ordered implementation sequence (Goal 2)

1. **Content corrections in provision** (no CSS yet)
   - Reveal: differentiate or collapse duplicate CTA copy (`tooltipText` vs `microcopy`; prefer
     seal hint default “Toque el sello” if external CTA kept).
   - Hero metadata: express ceremony-first for hero without premature shared refactor — prefer
     Perla `venues[]` with ceremony first **or** document intentional reception hero; align
     location Spanish strings with `PERLA_EVENT` times.
   - Civil: keep as location indication unless blocker #2 flips (see §8).
   - Family: apply decided hide vs “Por confirmar” policy.
   - Gallery: keep single item; captions/eyebrow only if already flagged.
   - RSVP: set `sectionStyles.rsvp.labels` only if review required custom wording; defaults already Spanish.
2. **Asset consolidate** — retarget hero-mobile → `hero-source.jpg`; delete duplicate JPEG; re-apply assets.
3. **Lane A SCSS** — paint RSVP (and PA if needed) dark olive band so cream labels contrast; fix any
   flagged thank-you/location token issues using existing `--perla-*` pattern; **do not** change
   shared `svh` mins unless a Perla-only override is required and justified.
4. **Spacing triage** — if excessive gaps remain after content density, apply **Lane A** padding /
   min-height overrides on specific sections; treat shared `100svh` hero/RSVP and `80svh`
   thank-you as intentional platform rhythm unless owner authorizes Lane B.
5. **Tests + prep MD** — extend payload tests; re-validate preparation helper; local
   `invitation:update` + smoke with `?skipEnvelope=true` / screenshot reveal open.
6. **Cleanup pass** — remove duplicate asset; drop any obsolete profile rules introduced then unused.
7. **Stop** — no Lane B jewelry-box-wedding bundle expansion unless explicitly approved.

---

## 8. Required decisions — resolved with evidence

| Decision | Verdict | Evidence |
| -------- | ------- | -------- |
| **Canonical formatted wedding metadata** | **No single formatted SSOT.** Raw timing SSOT = `PERLA_EVENT` / `eventTiming`. Guest-facing Spanish venue strings are provision-authored. Formatters: Hero UTC locale, `formatCardDate`, countdown resolver, explicit `teaserDetails`. Goal 2 must edit provision strings + keep ISO fields coherent — do not invent a new formatter module. | `boda-perla-y-carlos.ts`; `event.ts`; `page-data.ts`; `reveal-card.ts` |
| **Shared vs Perla visual rules** | **Palette / inheritance reset / RSVP band / thank-you retint → Lane A.** Structure, reveal machine, section components, base `svh` rhythm → shared. Jewelry-box section chrome for hero/rsvp/thank-you is **not currently delivered** on wedding — treating that gap as Lane B. | Profile SCSS; `jewelry-box-wedding.scss` bundle vs `jewelry-box.scss` |
| **Existing components enough?** | **Yes.** Corrections fit provision + Lane A + optional content-shaped `venues[]`. No new components. | Section map above |
| **Provisional family** | **Currently published** as text-only groups with `"Por confirmar"` + explanatory message (OD5 / F06 closed). Hide options without new APIs: omit `family` from `sectionOrder` and/or omit `family` object; or `visible: false` if still passed through. **Product choice for Goal 2:** keep soft placeholders (current contract) vs omit section. | Provision L193–211; payload test; Family.astro |
| **Gallery singular vs multi** | **Structurally multi** (`items[]`); Perla **content-singular** (length 1, OD4). Keep length 1. | `gallery.schema.ts`; provision; adapter empty→undefined |
| **Why RSVP labels absent in capture** | **Not missing props.** `resolveLabels` supplies defaults. Lane A forces cream `--rsvp-label-color` / title for a “dark olive band” but **does not paint** `.rsvp-section` with dark `--rsvp-bg`; card uses cream `--color-glass-bg` → cream-on-cream. Jewelry-box RSVP variant CSS not loaded for wedding. | Profile L136–158; `_rsvp.scss` L100–190; wedding bundle |
| **Duplicated reveal CTA** | **Structural** — seal + external microcopy both `[data-envelope-open]`; identical Perla strings amplify it. Screenshot modes may hide external instruction only in letter-held/preview-opened. | `EnvelopeReveal.astro`; provision envelope fields |
| **Excessive vertical gaps** | **Primarily shared viewport sizing** (`hero` 100svh, quote 40svh, countdown 50svh, RSVP 100svh, thank-you 80svh, large family/gallery clamps) + short Perla content — **not** Perla profile rules. Animation-pending hide can add temporary emptiness; screenshot composition can exaggerate. | Base invitation SCSS; profile has no svh overrides |
| **Civil ceremony in event model** | **Valid as indication** (current). Alternatives already supported: `itinerary` section (omitted by OD2) or `venues[]` entry `type: 'custom'` (can group with salon via shared Maps URL). Prefer keep indication unless review demands a third VenueCard. | `location.schema.ts`; provision indications; demo jewelry-box uses itinerary differently |
| **Removable code/assets** | Delete duplicate `hero-mobile-source.jpg` after path retarget. Do not delete shared jewelry-box section files. No orphan Perla components. | SHA-256 identity; asset specs |

---

## 9. Blockers / unresolved (must be explicit for Goal 2)

| ID | Blocker | Why it blocks | Resolution owner |
| -- | ------- | ------------- | ---------------- |
| B1 | **Family: keep “Por confirmar” vs omit section** | Both are implementable; visual review preference not re-litigated here. Prep OD5 + F06 currently mandate soft guest copy. | Owner: confirm before content edit |
| B2 | **Civil: remain indication vs VenueCard/custom/itinerary** | Indication matches prep OD2; promoting to venue/itinerary changes layout density and Maps grouping. | Owner: confirm if review demanded a third card |
| B3 | **Hero ceremony-first via Perla content vs shared `pickVenueValue`/`pickHeroValue`** | Shared change affects all legacy ceremony+reception invites that prefer reception today. | Prefer Perla-only content shaping unless owner wants Lane B |
| B4 | **Lane B wedding bundle expansion** | Would load jewelry-box hero/rsvp/thank-you chrome for all jewelry-box-wedding routes (demo + Perla). Out of “no premature generalization.” | Defer; fix RSVP contrast in Lane A first |
| B5 | **Shared `svh` rhythm reduction** | Platform-wide invitation spacing; Perla-only overrides are safer. | Owner if gaps remain after Lane A content+RSVP fixes |

No schema, API, or server/client boundary blocker remains for starting Goal 2 once B1–B2 are answered (B3–B5 have safe Lane A defaults).

---

## 10. Goal 2 handoff package

**File map:** §1 + §5  
**Correction sequence:** §7  
**Cleanup scope:** duplicate hero-mobile JPEG; CTA string consolidation; Lane A RSVP band; provision content alignment  
**Architectural constraints:**

- Prefer current architecture (provision + Lane A + shared components).
- No new abstractions, tokens, dependencies, or data contracts.
- Keep server-only / prep tokens out of published content and client props.
- Do not mutate `_jewelry-box-wedding.scss` for one client.
- Preserve buildability: payload schema tests must stay green after each step.
- Treat prior design findings as fixed scope — do not reopen visual direction.

**Acceptance for this Goal 1 artifact:** every known correction area maps to responsible code, data
source, and test surface; shared vs Perla responsibilities are separated; duplicates/removals and
RSVP/reveal/gap/civil/family/gallery decisions are evidenced; remaining items are named blockers
B1–B5 only.
