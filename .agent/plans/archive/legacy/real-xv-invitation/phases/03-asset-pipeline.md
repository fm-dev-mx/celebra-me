# Phase 03: Asset Pipeline & CDN Strategy

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Define and implement the strategy for hosting, referencing, and optimizing real
client photos and media without bloating the main repository.

**Weight:** 20% of total plan

---

## 🎯 Analysis / Findings

### Current Asset Architecture

The project uses two asset referencing strategies:

| Strategy           | How It Works                                                                     | Used By                                        |
| :----------------- | :------------------------------------------------------------------------------- | :--------------------------------------------- |
| **Asset Registry** | `src/lib/assets/asset-registry.ts` maps keys → `ImageMetadata` (Astro-optimized) | Demos (`demo-xv`, `demo-bodas`, `demo-cumple`) |
| **Direct URLs**    | CDN URLs (Cloudinary, R2, Unsplash) referenced in JSON                           | Templates, legacy                              |

**Current registry structure:**

````text
src/assets/images/events/
├── alberto-sesenta/   ← demo-cumple assets (local)
├── demo-wedding/      ← demo-bodas assets (local)
├── demo-xv/           ← demo-xv assets (local)
└── gerardo-sesenta/   ← transformation event (local)
```text

Each event folder exports a `RawEventAssets` object with hero, portrait, gallery, ceremony, etc. The
`mapEventAssets()` helper normalizes them into `EventAssets`.

### Problem: Local Storage for Real Photos

Demo images are checked into the repository (~2-5 MB per event). For **production client events**,
this approach creates:

- **Repo bloat:** Real photos are higher resolution and more numerous.
- **Privacy concerns:** Client photos in a public (or shared) Git history.
- **Build time degradation:** Astro's image optimization pipeline processes every local image.

### Recommended Strategy: Hybrid CDN + Registry

| Asset Type        | Strategy                 | Rationale                     |
| :---------------- | :----------------------- | :---------------------------- |
| Hero background   | **CDN URL** (Cloudinary) | Largest file; CDN transforms  |
| Portrait          | **CDN URL** (Cloudinary) | Privacy-sensitive             |
| Gallery (12+ img) | **CDN URL** (Cloudinary) | Volume; CDN auto-optimization |
| Ceremony/Venue    | **CDN URL** (Cloudinary) | Shared venue photos           |
| Signature/Logo    | **CDN URL** or local svg | Small; rarely changes         |
| Music             | **CDN URL** (R2)         | Binary; not for Git           |

With this approach, the production JSON file references URLs directly in the `image` fields:

```json
{
 "hero": {
  "backgroundImage": "https://res.cloudinary.com/dusxvauvj/image/upload/v.../xv-client-hero.jpg"
 },
 "gallery": {
  "items": [
   {
    "image": "https://res.cloudinary.com/.../gallery01.jpg",
    "caption": "..."
   }
  ]
 }
}
````

The `AssetSchema` in `config.ts` already supports this — it's a union of `z.enum(EVENT_KEYS)`,
`z.string().url()`, and `z.string().startsWith('/')`.

### Optional: Registry Entry for Client Event

If Astro's built-in `<Image>` optimization is desired, a **slim registry entry** can be added:

```ts
// In asset-registry.ts
import { assets as ClientXvAssets } from '../../assets/images/events/<client-slug>';

// In ImageRegistry.events:
'<client-slug>': mapEventAssets(ClientXvAssets, 'XV de <client-name>'),
```

**Decision:** CDN-only for v1. Add registry entry **only** if performance audits reveal a need for
Astro's built-in image optimization on client photos.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### CDN Infrastructure

- [ ] Confirm Cloudinary account has sufficient storage/bandwidth (15% of Phase)
- [ ] Create a dedicated folder in Cloudinary: `celebra-me/events/<client-slug>/` (10% of Phase)
- [ ] Define Cloudinary transformation presets for consistent quality:
  - Hero: `w_1920,q_80,f_auto`
  - Gallery: `w_1200,q_80,f_auto`
  - Portrait/Signature: `w_800,q_85,f_auto` (15% of Phase)

### Photo Processing Pipeline

- [ ] Receive raw client photos and organize by section (hero, gallery, family, etc.) (15% of Phase)
- [ ] Upload to Cloudinary with consistent naming: `<slug>-hero.jpg`, `<slug>-gallery-01.jpg`, etc.
      (15% of Phase)
- [ ] Generate optimized URLs with transformation parameters (10% of Phase)

### Music Asset

- [ ] Receive or select background music track (5% of Phase)
- [ ] Upload to R2 / Cloudflare CDN with proper CORS headers (5% of Phase)

### Privacy & Security

- [ ] Verify Cloudinary folder permissions (no public listing) (5% of Phase)
- [ ] Ensure no client PII is stored in Git repository (5% of Phase)

---

## ✅ Acceptance Criteria

- [ ] All client photos are uploaded to Cloudinary with optimized transformation presets.
- [ ] Photo URLs are accessible and return correct `Content-Type` headers.
- [ ] No client photos are committed to the Git repository.
- [ ] Music file is hosted on R2/CDN and playable via the `MusicPlayer` component.
- [ ] Naming convention is documented for future client events.

---

## 📎 References

- [Asset Registry](../../../../src/lib/assets/asset-registry.ts)
- [Asset Schema in config.ts](../../../../src/content/config.ts) — `AssetSchema` union type
- [Demo XV Assets](../../../../src/assets/images/events/demo-xv/) — Local asset pattern
