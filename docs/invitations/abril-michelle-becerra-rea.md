# Canonical Invitation Document — `abril-michelle-becerra-rea`

## 1. Overview

| Parameter | Value |
| --- | --- |
| **Invitation Slug** | `abril-michelle-becerra-rea` |
| **Event Type** | `xv` (Quinceañera) |
| **Current Managed Status** | `Registrada` |
| **Local Environment Status** | `STABILIZED & VERIFIED` |
| **Preview Environment Status** | `NOT VERIFIED` (Out of scope) |
| **Production Environment Status** | `NOT VERIFIED` (Out of scope) |
| **Last Verified Date** | `2026-07-24` |
| **Published Version (Local)** | `v2` |

### Version History Note (`v1` → `v2`)
During initial Local invitation application, `publish_invitation_atomic` RPC published `v1` to `published_invitation_content`. However, step 5 aborted due to a pre-existing event lookup defect on `events_slug_key`. After rectifying `apply-local-invitation.ts` to perform a post-RPC lookup by slug, a synchronized second apply completed cleanly, advancing the version counter to `v2`. Subsequent synchronized apply executions remain strictly idempotent at `v2` with 0 database and 0 Storage mutations.

---

## 2. Confirmed Event Metadata

- **Honoree:** Abril Michelle Becerra Rea
- **Date & Time:** 12 de septiembre de 2026, 3:00 p. m.
- **Time Zone:** `America/Mexico_City` (`2026-09-12T21:00:00.000Z`)
- **Parents:**
  - Sandy Guadalupe Rea Mendoza (Mother)
  - José Luis Becerra Ornelas (Father)
  - *Order:* `mother-first`
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
- **Included Sections:** `quote`, `family`, `countdown`, `location`, `itinerary`, `gallery`, `personalizedAccess`, `rsvp`, `thankYou`.
- **Intentionally Omitted Sections:** `music`, `gifts`.

---

## 3. Locations

### Ceremony Venue
- **Visible Name:** Templo y Ex Convento de Nuestra Señora de la Merced
- **Visible Address:** Agustín Rivera 433-C, Colonia Centro, C.P. 47400, Lagos de Moreno, Jalisco
- **Google Maps URL:** `https://maps.app.goo.gl/PKbLyRbrjiLfcc4C6`
- **Apple Maps URL:** `https://maps.apple.com/?q=Templo+y+Ex+Convento+de+Nuestra+Senora+de+la+Merced+Lagos+de+Moreno`
- **Coordinates:** `lat: 21.3542979, lng: -101.9320163`
- **Known Discrepancies:** None.

### Reception Venue
- **Visible Name:** Garden Palace
- **Visible Address:** Macedio Ayala núm. 70, Colonia Plan de los Rodríguez, C.P. 47480, Lagos de Moreno, Jalisco
- **Google Maps URL:** `https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6`
- **Apple Maps URL:** `https://maps.apple.com/?q=Garden+Palace+Lagos+de+Moreno`
- **Coordinates:** `lat: 21.3206241, lng: -101.9328009`, `zoom: 14`
- **Known Discrepancies:** Address spelling `Macedio Ayala` vs standard street name `Macedonio Ayala`; pending client confirmation.

---

## 4. Visual Direction

- **Base Demo & Theme:** `demo-xv-premiere-floral` / `premiere-floral`
- **Visual Profile ID:** `abril-michelle-becerra-rea`
- **Palette:** Warm dusty rose, botanical leaf green, ivory, and soft gold accents.
- **Typography:** Serif display paired with clean sans-body typography.
- **Animation Principles:** Hardware-accelerated CSS transitions, smooth fade-in reveals, reduced-motion compliance.
- **Approved Reference:** Premiere Floral XV catalog specification.
- **Rejected Alternatives:** Generic card layout without custom SCSS theme bindings.

---

## 5. Asset Inventory

| Key | Original Source Filename | Repository Path | Dimensions | Role | Focal Point (Mobile / Desktop) | Status | Replacement Requirement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hero` | `00000039` (`1783174465071.png`) | `src/assets/invitations/abril-michelle-becerra-rea/hero.webp` | `1080×1920` | Hero Background Cover | `50% 38%` / `50% 42%` | Provisional | Replace when final studio photos arrive |
| `gallery01` | WhatsApp attachment | `src/assets/invitations/abril-michelle-becerra-rea/gallery-01.webp` | `1080×1350` | Gallery Item 1 | `50% 30%` / `50% 25%` | Provisional | Replace when final studio photos arrive |
| `gallery02` | WhatsApp attachment | `src/assets/invitations/abril-michelle-becerra-rea/gallery-02.webp` | `1080×1350` | Gallery Item 3 | `50% 35%` / `50% 35%` | Provisional | Replace when final studio photos arrive |
| `gallery03` | WhatsApp attachment | `src/assets/invitations/abril-michelle-becerra-rea/gallery-03.webp` | `1080×1350` | Gallery Item 4 | `50% 32%` / `50% 32%` | Provisional | Replace when final studio photos arrive |
| `crownDetail` | WhatsApp attachment | `src/assets/invitations/abril-michelle-becerra-rea/crown-detail.webp` | `1080×1080` | Family Featured & Gallery Item 2 | `50% 30%` / `50% 30%` | Provisional | Replace when final studio photos arrive |
| `closing` | Derived from `1783173591739.png` | `src/assets/invitations/abril-michelle-becerra-rea/closing.webp` | `1080×1350` | Gallery Item 5 & Thank You Background | `50% 40%` / `50% 40%` | Provisional | Replace when final studio photos arrive |

---

## 6. Technical Architecture

- **Single-File Definition:** `scripts/provision/invitations/abril-michelle-becerra-rea.ts`
- **Registry Entry:** Registered in `scripts/provision/invitations/registry.ts`
- **SCSS Theme Profile:** `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss`
- **Shared Components Used:** `Hero.astro`, `GoogleMap.astro`, `EnvelopeReveal.astro`, `Location.astro`, `Itinerary.astro`, `Gallery.astro`, `RSVP.astro`, `ThankYou.astro`
- **Generic System Corrections:**
  - `apply-local-invitation.ts`: Post-RPC event lookup by slug avoids duplicate key errors on `events_slug_key`.
  - `invitation-update-plan.ts`: Guarded array recursion prevents stack overflow when comparing against `undefined` targets.
  - `GoogleMap.astro`: Generic `isRustic` mapping uses `variant === 'premiere-floral'` without hardcoded invitation slugs.
- **Media Provider Strategy:** Supabase Storage (`CLOUDINARY EXECUTION BLOCKED — ROTATED CREDENTIALS NOT CONFIGURED`).

---

## 7. Validation Status

- **Focused Unit Tests:** `pnpm test tests/content/abril-local-invitation.test.ts tests/provision/apply-local-invitation-events.test.ts tests/provision/invitation-update-plan.test.ts` (10 passed)
- **Full Unit Suite:** `pnpm test` (311 passed)
- **Playwright E2E CI:** `pnpm test:e2e:ci` (36 passed)
- **Playwright Visual Audit:** `tests/e2e/abril-audit.spec.ts` (6 passed across 5 viewports)
- **Type Check:** `pnpm type-check` (0 errors, 0 warnings, 0 hints across 1080 files)
- **Production Build:** `pnpm build` (100% clean output)
- **Tested Viewports:** `360×800`, `390×844`, `768×1024`, `1024×768`, `1440×900`
- **Accessibility & Interaction:** Keyboard focus ring verified, reduced motion verified, WCAG contrast verified.
- **Apply-Time Idempotency:** Verified 0 DB writes, 0 storage mutations on re-apply.

---

## 8. Implementation Changelog

- **2026-07-24:** Materialized single-file definition `abril-michelle-becerra-rea.ts` and SCSS theme profile `abril-michelle-becerra-rea.scss`.
- **2026-07-24:** Added post-RPC event lookup in `apply-local-invitation.ts` to support atomic `publish_invitation_atomic` event creation.
- **2026-07-24:** Fixed `invitation-update-plan.ts` array diffing recursion for absent target objects.
- **2026-07-24:** Refactored `GoogleMap.astro` to remove hardcoded Abril slug in favor of generic theme mapping.
- **2026-07-24:** Added Playwright E2E audit suite `tests/e2e/abril-audit.spec.ts` for automated multi-viewport visual QA.
- **2026-07-24:** Evaluated Cloudinary vs Supabase Storage; retained Supabase Storage due to lack of rotated credentials and full local testability.

---

## 9. Missing or Pending Client Information

1. **Reception Street Address Spelling:** `Macedio Ayala` (provided in client intake text) vs `Macedonio Ayala` (standard municipal spelling). Pending client confirmation.
2. **Final Photograph Session:** Replacing provisional WebP assets with final studio photographs when delivered by client.
3. **Dress Code:** Optional section currently omitted.
4. **Gifts / Mesa de Regalos:** Optional section currently omitted.
5. **Parking / Lodging Details:** Optional venue notes currently omitted.
6. **Cloudinary Credential Rotation:** External security requirement before any future Cloudinary trial.
7. **Hosted Release Validation:** Preview and Production environments remain unverified per task scope.

---

## 10. Release Gates

- [x] **Local Completion:** Fully stabilized, verified, and idempotent on Local Supabase.
- [ ] **Final-Photo Replacement:** Awaiting studio photography delivery.
- [ ] **Preview Materialization:** Deferred until client photo confirmation.
- [ ] **Preview Visual Approval:** Deferred until Preview deployment.
- [ ] **Production Promotion:** Deferred until final sign-off.
- [ ] **Post-Publication Verification:** Deferred until Production release.
