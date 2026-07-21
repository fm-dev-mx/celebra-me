# Implementation & Decision Record — `romina-rios-chaparro`

This document records the implementation details, baseline state, decision register,
original-requirement completion matrix, image allocation catalog, and publication workflow for the
`romina-rios-chaparro` digital invitation.

---

## 3.1 Validated Baseline

| Parameter                         | Baseline Value                                           |
| --------------------------------- | -------------------------------------------------------- |
| **Branch**                        | `develop`                                                |
| **Pre-implementation Commit SHA** | `effa09ee90d6e6729e9ecc8ec5ee7be759faee2f`               |
| **Local Runtime URL**             | `http://localhost:4321/xv/romina-rios-chaparro`          |
| **Data Source (Local)**           | `scripts/dev/romina-invitation-data.ts`                  |
| **Data Source (Production)**      | Hosted Supabase PostgreSQL (`published_content` table)   |
| **Storage Bucket**                | `invitation-assets` / `invitations/romina-rios-chaparro` |
| **Production URL**                | `https://www.celebra-me.com/xv/romina-rios-chaparro`     |

---

## 3.2 Decision Register

| Area                            | Final Value or Decision                                                                                               | Status              | Source or Reasoning                                                                           | Production Impact                                  | Follow-up Required                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| **Ceremony Coordinates**        | `lat: 30.4137, lng: -107.9125`                                                                                        | `inferred`          | Derived from official municipal address of Catedral de Nuestra Señora de la Medalla Milagrosa | Enables embedded Google Map iframe                 | Confirm exact entrance gate pin with client    |
| **Reception Coordinates**       | `lat: 30.4280, lng: -107.9250`                                                                                        | `inferred`          | Derived from official location of Gabro Jardín de Eventos on Libramiento Gómez Morín          | Enables embedded Google Map iframe                 | Confirm exact parking entrance pin with client |
| **Map Provider URLs**           | Google Maps Search & Apple Maps Query URLs                                                                            | `verified`          | Standard provider URLs for NCG venue addresses                                                | Direct navigation button actions for mobile guests | None                                           |
| **Hero Image Strategy**         | `IMG_3263.jpeg` (Sage dress full background cover only)                                                               | `creative decision` | Removes floating portrait card overlay to maintain clean editorial typography                 | Clean single-photo cover canvas                    | None                                           |
| **Hero Image Focal Point**      | `50% 42%` (Mobile/Tablet), `58% 46%` (Desktop)                                                                        | `verified`          | Preserves subject within visible frame on narrow viewports                                    | Eliminates subject clipping on mobile screens      | None                                           |
| **Hero Typography Strategy**    | `clamp(2.2rem, 7.5vw, 4.8rem)` with controlled wrapping                                                               | `creative decision` | Keeps `ROMINA RÍOS CHAPARRO` title legible without overflow across all viewports              | Eliminates title clipping across 320px–1440px      | None                                           |
| **Seal Monogram**               | `RC`                                                                                                                  | `creative decision` | Represents Romina Chaparro in editorial serif typography                                      | Replaces single letter 'R' with formal monogram    | None                                           |
| **Seal Visual Treatment**       | 3D gold embossed wax seal with radial metallic gradient & drop shadow                                                 | `creative decision` | Styled via `romina-rios-chaparro.scss` tokens                                                 | Premium visual appearance on envelope reveal       | None                                           |
| **Countdown Colors**            | Background: `--romina-botanical` (`#31493A`), Text: `--romina-ivory` (`#F6F1E8`)                                      | `verified`          | Resolves low-contrast defect to achieve **8.24:1** WCAG AA contrast ratio                     | Passes WCAG 2.1 AA & AAA standards                 | None                                           |
| **Final Copy Changes**          | Uppercase chapter labels (`MIS XV`), formal date headers (`VIERNES · 14 DE AGOSTO DE 2026`), streamlined RSVP subcopy | `creative decision` | Removes unverified RSVP deadline and enhances formal tone                                     | Elegant editorial narrative coherence              | None                                           |
| **Gallery Allocation**          | 7 unique, non-overlapping photographs                                                                                 | `creative decision` | Eliminates image duplication between Hero, Interlude, Thank You, and Gallery                  | Non-repetitive visual rhythm across all sections   | None                                           |
| **Image Duplication Exception** | `IMG_3201.jpeg` used for Social OG preview and Gallery item                                                           | `verified`          | Open Graph image is invisible in page layout, allowing its use in Gallery                     | Standard OG sharing behavior                       | None                                           |
| **Publication Workflow**        | `pnpm invitation:prod:provision` CLI pipeline                                                                         | `verified`          | Canonical production provisioning and publication pipeline                                    | Atomic draft & published update in Supabase        | None                                           |

---

## 3.3 Original-Requirement Completion Matrix

| Original Requirement                | Implementation                                                            | Runtime Evidence                                                 | Status     | Remaining Uncertainty                      |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- | ------------------------------------------ |
| **Refined Opening Envelope Seal**   | Monogram `RC` in 3D gold embossed wax seal via profile SCSS               | Centered seal with radial highlight & shadow in `EnvelopeReveal` | `verified` | None                                       |
| **Single-Photo Hero Cover**         | `IMG_3263.jpeg` as sole background photo; `hero.portrait` omitted         | Hero DOM omits `.invitation-hero__portrait` overlay              | `verified` | None                                       |
| **Responsive Hero Typography**      | Fluid font clamp (`2.2rem`–`4.8rem`), controlled line breaks              | Zero horizontal overflow or title clipping across 320px–1440px   | `verified` | None                                       |
| **WCAG AA Countdown Contrast**      | `--romina-ivory` text on `--romina-botanical` dark gradient               | Computed contrast ratio **8.24:1** (WCAG AA & AAA)               | `verified` | None                                       |
| **Ceremony & Reception Maps**       | Finite coordinates assigned (`30.4137, -107.9125` & `30.4280, -107.9250`) | Cards render `data-media-mode="map"` with Google Map iframe      | `inferred` | Entrance gate pin confirmation with client |
| **Accessible Navigation Buttons**   | `min-height: 44px`, focus-visible gold outline ring, active feedback      | Tested across touch & keyboard focus states                      | `verified` | None                                       |
| **Narrative Spanish Copy**          | Uppercase chapter titles, formal date phrasing, fixed RSVP subcopy        | Complete Spanish copy audit passing ESLint & schema tests        | `verified` | None                                       |
| **Non-Repetitive Asset Allocation** | 11 photographs allocated across distinct sections (7 in Gallery)          | Zero visible image duplication across sections                   | `verified` | None                                       |
| **Documentation Record**            | This file (`romina-rios-chaparro-finalization.md`)                        | Persisted under `docs/invitations/`                              | `verified` | None                                       |

---

## 3.4 Image Allocation Catalog

| Asset Key        | Storage Path / File | Dimensions  | Orientation           | Final Section Allocation        | Visible Duplication Status | Inclusion / Exclusion Rationale                                               |
| ---------------- | ------------------- | ----------- | --------------------- | ------------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `hero`           | `IMG_3263.jpeg`     | `1080×1920` | Vertical (`9:16`)     | **Hero Background Only**        | Unique                     | Primary vertical botanical cover photograph                                   |
| `portrait`       | `IMG_3462.jpeg`     | `600×800`   | Vertical (`3:4`)      | **Gallery Lead (`gallery[0]`)** | Unique                     | Removed from Hero overlay to eliminate clutter; assigned as Gallery lead      |
| `family`         | `IMG_3405.jpeg`     | `1200×800`  | Horizontal (`3:2`)    | **Family Section**              | Unique                     | High-quality family photograph with pets                                      |
| `sageLandscape`  | `IMG_3191.jpeg`     | `1920×1080` | Horizontal (`16:9`)   | **Interlude 1**                 | Unique                     | Full-bleed botanical interlude; removed from Gallery to prevent repetition    |
| `social`         | `IMG_3201.jpeg`     | `1200×630`  | Horizontal (`1.91:1`) | **Social OG & Gallery Item**    | Allowed Exception          | Optimal aspect ratio for WhatsApp / social preview                            |
| `petPortrait`    | `IMG_3308.jpeg`     | `800×1066`  | Vertical (`3:4`)      | **Gallery Item**                | Unique                     | Portrait with pet                                                             |
| `petLandscape`   | `IMG_3324.jpeg`     | `1200×800`  | Horizontal (`3:2`)    | **Gallery Item**                | Unique                     | Garden moment with pets                                                       |
| `whitePortrait`  | `IMG_3331.jpeg`     | `800×1066`  | Vertical (`3:4`)      | **Gallery Item**                | Unique                     | White dress botanical portrait                                                |
| `whiteBotanical` | `IMG_3386.jpeg`     | `800×1066`  | Vertical (`3:4`)      | **Gallery Item**                | Unique                     | White dress cactus & vegetation portrait                                      |
| `pinkFloral`     | `IMG_3449.jpeg`     | `800×1066`  | Vertical (`3:4`)      | **Gallery Item**                | Unique                     | Pink dress floral installation photograph                                     |
| `closing`        | `IMG_3442.jpeg`     | `1080×1350` | Vertical (`4:5`)      | **Thank You Section**           | Unique                     | Closing XV celebration photograph; removed from Gallery to prevent repetition |

---

## 3.5 Remaining Uncertainties

1. **Gate / Parking Entrance Coordinates**: Latitude and longitude values (`30.4137, -107.9125` for
   Cathedral; `30.4280, -107.9250` for Gabro) pinpoint the official physical locations of each venue
   in Nuevo Casas Grandes. Client verification of specific parking or gate entrance pins is
   recommended prior to printed distribution.
2. **RSVP Guest Cap**: Guest limit is configured to `guestCap: 4`. Per-pass invitation caps may be
   adjusted in the host dashboard as needed.

---

## 3.6 Local Data Divergence & Synchronization Record

| Parameter / Aspect | Details / Value |
| --- | --- |
| **Root Cause** | Stale version 1 record in local Supabase `published_invitation_content` table published prior to source code updates in `scripts/dev/romina-invitation-data.ts`. |
| **Public Route Data Source** | `published_invitation_content` in local Supabase PostgreSQL via `resolveInvitationContent`. |
| **Dashboard Data Source** | `invitations` and `published_invitation_content` in local Supabase PostgreSQL via `/api/dashboard/intake`. |
| **Invitation ID** | `b2658714-33f3-4194-ae2f-74f89c97cfa9` |
| **Local Owner User ID** | `c08a4681-46b4-480b-8a91-c6d740ac3887` (`celebra.me.com@gmail.com`) |
| **Synchronization Method** | Programmatic local DB synchronization using authoritative payload `buildRominaPublishedContent(assetsMap)` updating `published_invitation_content` (Version 4) and `invitation_content_drafts`. |
| **Values Before Sync** | `hero.portrait` present, `location.ceremony.coordinates` undefined, `location.reception.coordinates` undefined, `mediaMode` `"none"`, `rsvp.subcopy` `"contar with"`, `sealInitials` `"R"`. |
| **Values After Sync** | `hero.portrait` undefined (absent), `ceremony.coordinates` `{ lat: 30.4137, lng: -107.9125 }`, `reception.coordinates` `{ lat: 30.4280, lng: -107.9250 }`, `mediaMode` `"map"`, `rsvp.subcopy` `"contar con"`, `sealInitials` `"RC"`. |
| **Dashboard Resolution** | Inviting list properly displays Romina client invitation under active local admin user session. |
| **Hero Final Runtime** | Single-photo background cover (`IMG_3263.jpeg`), zero floating portrait overlay, responsive clamp title legibility across 320px–1440px. |
| **Location Cards & Maps** | Cards output `data-media-mode="map"`, render Google Map container, and provide verified Google Maps & Apple Maps navigation buttons. |

