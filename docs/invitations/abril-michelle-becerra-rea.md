# Canonical Invitation Document — `abril-michelle-becerra-rea`

## 1. Overview

| Parameter                         | Value                                                                  |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Invitation Slug**               | `abril-michelle-becerra-rea`                                           |
| **Event Type**                    | `xv` (Quinceañera)                                                     |
| **Current Managed Status**        | `Registrada`                                                           |
| **Local Environment Status**      | `STABILIZED & VERIFIED` (premium polish pass 2026-07-25)               |
| **Preview Environment Status**    | `NOT VERIFIED` (Out of scope)                                          |
| **Production Environment Status** | `NOT VERIFIED` (Out of scope)                                          |
| **Last Verified Date**            | `2026-07-25`                                                           |
| **Published Version (Local)**     | `v7` (2026-07-25 approved crop restored + hero composition correction) |

### Version History Note (`v1` → `v2`)

During initial Local invitation application, `publish_invitation_atomic` RPC published `v1` to
`published_invitation_content`. However, step 5 aborted due to a pre-existing event lookup defect on
`events_slug_key`. After rectifying `apply-local-invitation.ts` to perform a post-RPC lookup by
slug, a synchronized second apply completed cleanly, advancing the version counter to `v2`.
Subsequent synchronized apply executions remain strictly idempotent at `v2` with 0 database and 0
Storage mutations when content is unchanged.

---

## 2. Confirmed Event Metadata

- **Honoree:** Abril Michelle Becerra Rea
- **Date & Time:** 12 de septiembre de 2026, 3:00 p. m.
- **Time Zone:** `America/Mexico_City` (`2026-09-12T21:00:00.000Z`)
- **Parents:**
  - Sandy Guadalupe Rea Mendoza (Mother)
  - José Luis Becerra Ornelas (Father)
  - _Order:_ `mother-first`
- **Godparents:**
  - María del Carmen Becerra Ornelas
  - Ramiro Contreras Bermejo
- **Itinerary:**
  - `3:00 p. m.` — Misa (`Church`)
  - `5:00 p. m.` — Recepción (`Reception`)
  - `6:00 p. m.` — Cena (`Dinner`)
  - `7:00 p. m.` — Vals (`Waltz`)
  - `12:00 a. m.` — Cierre de evento (`Sparkles`)
- **Music Configuration:** Intentionally omitted (no auto-play background audio requested).
- **Guest Management Behavior:** `personalized-only`, default `guestCap: 4`.
- **Included Sections:** `quote`, `family`, `countdown`, `location`, `itinerary`, `gallery`,
  `personalizedAccess`, `rsvp`, `thankYou`.
- **Intentionally Omitted Sections:** `music`, `gifts`.

---

## 3. Locations

### Ceremony Venue

- **Visible Name:** Templo y Ex Convento de Nuestra Señora de la Merced
- **Visible Address:** Agustín Rivera 433-C, Colonia Centro, C.P. 47400, Lagos de Moreno, Jalisco
- **Google Maps URL:** `https://maps.app.goo.gl/PKbLyRbrjiLfcc4C6`
- **Apple Maps URL:**
  `https://maps.apple.com/?q=Templo+y+Ex+Convento+de+Nuestra+Senora+de+la+Merced+Lagos+de+Moreno`
- **Coordinates:** `lat: 21.3542979, lng: -101.9320163`
- **Known Discrepancies:** None.

### Reception Venue

- **Visible Name:** Garden Palace
- **Visible Address:** Macedio Ayala núm. 70, Colonia Plan de los Rodríguez, C.P. 47480, Lagos de
  Moreno, Jalisco
- **Google Maps URL:** `https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6`
- **Apple Maps URL:** `https://maps.apple.com/?q=Garden+Palace+Lagos+de+Moreno`
- **Coordinates:** `lat: 21.3206241, lng: -101.9328009`, `zoom: 14`
- **Known Discrepancies:** Address spelling `Macedio Ayala` vs standard street name
  `Macedonio Ayala`; **pending client confirmation** — do not change without confirmation.

---

## 4. Visual Direction

- **Base Demo & Theme:** `demo-xv-premiere-floral` / `premiere-floral`
- **Visual Profile ID:** `abril-michelle-becerra-rea`
- **Hero essence (Lane A):** Dusty-rose / antique-gold directional veil; Cormorant display;
  **compact, unified type stack in the photograph’s upper negative space** on mobile/tablet and left
  negative space on desktop; **no frosted glass card**. The name, divider, date, time, and venue
  remain one hierarchy and never cross the honoree’s face. Distinct from Romina (botanical /
  Parisienne desktop bias) and from Jewelry-Box preset glass cards.
- **Palette:** Warm dusty rose, ivory, antique gold, wine-dark.
- **Typography:** Cormorant Garamond Variable (display); Cinzel (`--font-label`) for eyebrow/date;
  Montserrat body for venue/scroll; calligraphy accent only on “en”.
- **Hero focals (approved crop, restored):** mobile `50% 38%` · tablet `50% 40%` · desktop `50% 42%`
  · default `50% 40%`. Text placement adapts to the photograph; the image is not moved to compensate
  for copy collisions.
- **Animation Principles:** Hardware-accelerated CSS transitions, smooth fade-in reveals,
  reduced-motion compliance.
- **Approved Reference:** Premiere Floral XV catalog + `frontend-design` Invitation Hero Composition
  Contract.
- **Rejected Alternatives:** Centered type over face; frosted ivory hero card on client photo;
  cloning sibling profile hero SCSS; root PRODUCT/DESIGN / Impeccable SSOT installs.
- **Demo parity decision:** Demo = base template + catalog metadata only. Abril identity is
  **client-scoped** profile SCSS (Lane A), not demo visual parity. Catalog gap: no routable
  `src/content/event-demos/.../demo-xv-premiere-floral.json` (Lane B backlog).

---

## 5. Asset Inventory (v2 semantic keys)

| Key                          | Repository Path                                                                     | Role                     | Focal Point                           | Status      | Replacement          |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------ | ------------------------------------- | ----------- | -------------------- |
| `hero-desktop`               | `src/assets/invitations/abril-michelle-becerra-rea/hero-desktop.webp`               | Hero + OG                | `50% 42%` desktop / `50% 40%` default | Provisional | Final studio         |
| `hero-mobile`                | `src/assets/invitations/abril-michelle-becerra-rea/hero-mobile.webp`                | Hero mobile              | `50% 38%`                             | Provisional | Final studio         |
| `family-portrait`            | `src/assets/invitations/abril-michelle-becerra-rea/family-portrait.webp`            | **Family featured**      | `50% 35%`                             | Provisional | Final studio         |
| `interlude-crown`            | `src/assets/invitations/abril-michelle-becerra-rea/interlude-crown.webp`            | Interlude after quote    | `50% 50%`                             | Decorative  | Optional             |
| `interlude-palace`           | `src/assets/invitations/abril-michelle-becerra-rea/interlude-palace.webp`           | Interlude after location | `50% 50%`                             | Decorative  | Optional venue photo |
| `thank-you-confetti`         | `src/assets/invitations/abril-michelle-becerra-rea/thank-you-confetti.webp`         | Thank You                | `50% 40%`                             | Provisional | Final studio         |
| `gallery-01-candles`         | `src/assets/invitations/abril-michelle-becerra-rea/gallery-01-candles.webp`         | Gallery 1                | `50% 50%`                             | Provisional | Final studio         |
| `gallery-02-bw-cake`         | `src/assets/invitations/abril-michelle-becerra-rea/gallery-02-bw-cake.webp`         | Gallery 2                | `50% 40%`                             | Provisional | Final studio         |
| `gallery-03-seated-balloons` | `src/assets/invitations/abril-michelle-becerra-rea/gallery-03-seated-balloons.webp` | Gallery 3                | `50% 35%`                             | Provisional | Final studio         |
| `gallery-04-white-suit`      | `src/assets/invitations/abril-michelle-becerra-rea/gallery-04-white-suit.webp`      | Gallery 4                | `50% 32%`                             | Provisional | Final studio         |
| `gallery-05-white-dress`     | `src/assets/invitations/abril-michelle-becerra-rea/gallery-05-white-dress.webp`     | Gallery 5                | `50% 40%`                             | Provisional | Final studio         |

**Removed orphans (2026-07-25):** `hero.webp`, `gallery-01.webp`, `gallery-02.webp`,
`gallery-03.webp`, `crown-detail.webp`, `closing.webp` (superseded v1 filenames).

---

## 6. Technical Architecture

- **Single-File Definition:** `scripts/provision/invitations/abril-michelle-becerra-rea.ts`
- **Registry Entry:** Registered in `scripts/provision/invitations/registry.ts`
- **SCSS Theme Profile:** `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss`
- **Shared Components Used:** `Hero.astro`, `GoogleMap.astro`, `EnvelopeReveal.astro`,
  `Location.astro`, `Itinerary.astro`, `Gallery.astro`, `RSVP.astro`, `ThankYou.astro`
- **Generic System Corrections:**
  - `apply-local-invitation.ts`: Post-RPC event lookup by slug avoids duplicate key errors on
    `events_slug_key`.
  - `invitation-update-plan.ts`: Guarded array recursion prevents stack overflow when comparing
    against `undefined` targets.
  - `GoogleMap.astro`: Generic `isRustic` mapping uses `variant === 'premiere-floral'` without
    hardcoded invitation slugs.
- **Media Provider Strategy:** Supabase Storage
  (`CLOUDINARY EXECUTION BLOCKED — ROTATED CREDENTIALS NOT CONFIGURED`). Asset specs may still
  declare `provider: 'cloudinary'` for future readiness.

---

## 7. Validation Status

- **Focused Unit Tests (2026-07-25):**
  `pnpm test tests/content/abril-local-invitation.test.ts tests/provision/cloudinary-adapter.test.ts tests/provision/apply-local-invitation-events.test.ts`
  — **22 passed**
- **Local apply:** crop restoration published as **v7** (`content-only`, assets preserved)
- **Playwright Visual Audit (2026-07-25):** `tests/e2e/abril-audit.spec.ts` — **6 passed** (five
  visual/responsive viewports + accessibility/reduced motion)
- **Tested Viewports:** `360×800`, `390×844`, `768×1024`, `1024×768`, `1440×900`
- **Accessibility & Interaction:** Keyboard focus ring on location nav; reduced-motion gate on nav
  transitions; countdown high-contrast panel

---

## 8. Implementation Changelog

- **2026-07-24:** Materialized single-file definition `abril-michelle-becerra-rea.ts` and SCSS theme
  profile `abril-michelle-becerra-rea.scss`.
- **2026-07-24:** Added post-RPC event lookup in `apply-local-invitation.ts` to support atomic
  `publish_invitation_atomic` event creation.
- **2026-07-24:** Fixed `invitation-update-plan.ts` array diffing recursion for absent target
  objects.
- **2026-07-24:** Refactored `GoogleMap.astro` to remove hardcoded Abril slug in favor of generic
  theme mapping.
- **2026-07-24:** Added Playwright E2E audit suite `tests/e2e/abril-audit.spec.ts` for automated
  multi-viewport visual QA.
- **2026-07-24:** Evaluated Cloudinary vs Supabase Storage; retained Supabase Storage due to lack of
  rotated credentials and full local testability.
- **2026-07-25:** Premium Local polish pass:
  - Fixed profile SCSS selectors to live Hero/Location BEM (`.invitation-hero__*`,
    `.event-location__*`).
  - Extended Lane A tokens (family, location, interlude, countdown, envelope, PA) for dusty-rose
    Jewelry Box finish.
  - Reassigned Family featured → `family-portrait`; Gallery item 2 → `gallery-02-bw-cake`.
  - Removed six orphaned v1 WebP assets; refreshed this inventory.
  - Client gates unchanged: reception street spelling + final studio photos.
- **2026-07-25:** Hero face-safe composition pass (Local `v6`):
  - Bottom-anchored type stack; wine lower veil; no frosted hero card; solid ivory display on
    mobile.
  - Label/date via `--font-label`; venue secondary meta; spacing tokens + `respond-to(md|lg)`.
  - Retuned hero focals to `28%` / `32%` / `34%` (mobile / tablet / desktop).
  - Documented Invitation Hero Composition Contract in `.agent/skills/frontend-design` (v1.2.0) so
    future invites keep face-safe + per-profile essence.
- **2026-07-25:** Hero composition correction (Local `v7`):
  - Found the cascade conflict: the shared Premiere Floral editorial hero left metadata
    `position: absolute` over a translucent light band while the profile moved only the title.
  - Explicitly reset inherited `position`, `inset`, grid, transform, mix-blend, background, and
    backdrop behavior in the Abril profile.
  - Restored the approved `38%` / `40%` / `42%` crop; all relocation now belongs to typography.
  - Grouped eyebrow, title, divider, date, time, and venue as one compact stack in photographic
    negative space; mobile/tablet center it above the subject, desktop aligns it left.
  - Added E2E contract assertions across the five existing audit viewports for crop preservation,
    grouped metadata, no frosted band, and reset editorial transforms.

---

## 9. Missing or Pending Client Information

1. **Reception Street Address Spelling:** `Macedio Ayala` (provided in client intake text) vs
   `Macedonio Ayala` (standard municipal spelling). Pending client confirmation. **P1 — do not
   invent.**
2. **Final Photograph Session:** Replacing provisional WebP assets with final studio photographs
   when delivered by client. **P1 at Preview/Production promotion.**
3. **Dress Code:** Optional section currently omitted.
4. **Gifts / Mesa de Regalos:** Optional section currently omitted.
5. **Parking / Lodging Details:** Optional venue notes currently omitted.
6. **Cloudinary Credential Rotation:** External security requirement before any future Cloudinary
   trial.
7. **Hosted Release Validation:** Preview and Production environments remain unverified per task
   scope.
8. **Client contact fields:** `clientEmail` / `clientWhatsapp` empty in definition (ops
   completeness, P3).

---

## 10. Release Gates

- [x] **Local Completion:** Stabilized, verified, and idempotent on Local Supabase (baseline
      2026-07-24).
- [x] **Local Premium Polish:** Profile SCSS + art-direction remap + orphan cleanup (2026-07-25).
- [ ] **Final-Photo Replacement:** Awaiting studio photography delivery.
- [ ] **Reception Address Confirmation:** `Macedio` vs `Macedonio`.
- [ ] **Preview Materialization:** Deferred until client photo/address confirmation.
- [ ] **Preview Visual Approval:** Deferred until Preview deployment.
- [ ] **Production Promotion:** Deferred until final sign-off.
- [ ] **Post-Publication Verification:** Deferred until Production release.

---

## 11. Two-Lane Spec (2026-07-25 premium pass)

### Lane A (done / in this cycle)

| Item                                                     | Status                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Profile SCSS premium tokens + correct BEM selectors      | Done                                                                 |
| Family featured = `family-portrait`; B&W cake in gallery | Done                                                                 |
| Orphan v1 asset cleanup                                  | Done                                                                 |
| Docs §5 inventory sync                                   | Done                                                                 |
| Local apply after content remap                          | Done — Local `v5`; hero experiments `v6`; corrected crop/layout `v7` |

### Lane A (blocked on client)

| Item                                   | Priority      |
| -------------------------------------- | ------------- |
| Final studio photo replacement         | P1 at release |
| Reception street spelling confirmation | P1            |
| Optional dress code / gifts / parking  | P3            |

### Lane B (deferred — not in this cycle)

| Item                                                                       | Priority     |
| -------------------------------------------------------------------------- | ------------ |
| Create routable `demo-xv-premiere-floral` JSON + fix catalog `previewSlug` | P1 theme SKU |
| Document family featured-image pattern in theme-architecture               | P3           |

---

## 12. Creative QA Snapshot (Local premium pass — 2026-07-25)

Conversation-scoped evidence against `creative-qa-report` + `frontend-design` checklist. Primary
viewport: `390×844`; secondary: `1440×900`. Browser screenshot pass not re-run in this session;
unit/provision gates + dry-run zero-drift used as technical evidence.

### Copy QA

| Check                             | Status | Notes                                       |
| --------------------------------- | ------ | ------------------------------------------- |
| Spanish throughout / formal usted | Pass   | RSVP, envelope, locations                   |
| No invented client data           | Pass   | Address spelling left as intake (`Macedio`) |
| Tone / event fit                  | Pass   | XV dusty-rose editorial                     |

### UI / Invitation Visual QA

| Area                                                 | Status  | Notes                                                                          |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Reference fidelity (premiere-floral + Abril profile) | Pass    | Lane A overrides only                                                          |
| Typography hierarchy                                 | Pass    | Cormorant display; Cinzel label/date; BEM hero selectors                       |
| Theme / token coherence                              | Pass    | Family/location/interlude/countdown/envelope/hero tokens                       |
| Hero face-safe composition                           | Pass    | Unified negative-space stack; inherited editorial band removed; five viewports |
| Image assignment / focal points                      | Pass    | Family = portrait; gallery B&W cake; approved hero crop restored in v7         |
| Distill / anti-slop                                  | Pass    | No frosted hero card; no pills/glows                                           |
| Reduced motion                                       | Pass    | Nav button transitions gated                                                   |
| Production placeholder assets                        | Blocked | Provisional WhatsApp-derived photos — release gate                             |
| Responsive / E2E visual audit                        | Pass    | 6/6 Playwright checks; deterministic reduced-motion screenshots                |

### Findings

| ID  | Severity  | Status           | Criterion                         | Notes                    |
| --- | --------- | ---------------- | --------------------------------- | ------------------------ |
| F1  | Important | Blocked (client) | Final studio photos               | Gate before Preview      |
| F2  | Important | Blocked (client) | Reception street spelling         | `Macedio` vs `Macedonio` |
| F3  | Minor     | Open (Lane B)    | Missing premiere-floral demo JSON | Theme SKU integrity      |
