---
title: Celestial Blue Demo Photo Set Overhaul
status: active
type: implementation
autonomy: 2
created: 2026-07-26
updated: 2026-07-26
# status note: Look P interludes delivered; gallery-03/profile-01 still paused
related_skills:
  - frontend-design
related_docs:
  - src/content/event-demos/xv/demo-xv-celestial-blue.json
  - src/assets/images/events/demo-xv-celestial-blue/index.ts
  - src/assets/images/talents/README.md
  - src/assets/images/talents/camila-ice-loggia/MODEL.md
supersedes: []
superseded_by: []
---

# Plan: Talent library + celestial-blue photo coherence

## Goal

1. Maintain a reusable **talent library** under `src/assets/images/talents/`.
2. Make `demo-xv-celestial-blue` consume **only** `camila-ice-loggia` (one person, one wardrobe, one
   world).
3. Wire `family.featuredImage: "family"`.

## Talents

| ID                   | Role                                                 | Demo celestial-blue |
| -------------------- | ---------------------------------------------------- | ------------------- |
| `camila-ice-loggia`  | Canonical — updo, strapless ice gown, covered loggia | **Only this**       |
| `camila-ice-waves`   | Other person — long waves + off-shoulder sleeves     | Parked / later      |
| `camila-marble-moon` | Legacy marble/moon archive                           | Not mixed into demo |

Frozen masters for Ice Loggia: `masters/hero-mobile.webp` + `masters/hero-desktop.webp`
(byte-identical to demo `hero.webp` / `hero-desktop.webp`). Never regenerate.

Work locks: `locks/face.webp`, `locks/body.webp`, `locks/environment.webp`.

---

## Section → image matrix (demo pack)

Event filenames stay stable. Talent `shots/` are the source of truth; demo only receives **copies**.

| Section / use             | JSON / asset key                              | Demo file                 | Talent shot ID        | Subject rule                                                                    |
| ------------------------- | --------------------------------------------- | ------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| Hero mobile               | `hero.backgroundImage` → `hero`               | `hero.webp`               | _(master)_            | Frozen                                                                          |
| Hero desktop              | `hero.backgroundImageDesktop` → `heroDesktop` | `hero-desktop.webp`       | _(master)_            | Frozen                                                                          |
| Envelope / OG portrait    | `hero.portrait` → `portrait`                  | `portrait.webp`           | `portrait-01`         | Face-critical                                                                   |
| Thank you                 | `thankYou.image` → `thankYouPortrait`         | `thank-you-portrait.webp` | `thankyou-01`         | Face-critical                                                                   |
| Family media              | `family.featuredImage` → `family` **(wire)**  | `family.webp`             | `family-01`           | Face-critical                                                                   |
| Location ceremony         | `location.ceremony.image` → `ceremony`        | `ceremony.webp`           | `ceremony-01`         | Place-led; no close face                                                        |
| Location reception        | `location.reception.image` → `reception`      | `reception.webp`          | `reception-01`        | Place-led                                                                       |
| Interlude after location  | `interlude01`                                 | `interlude-01.webp`       | `architecture-01`     | **Look P** — empty covered loggia / estate architecture (S1), no face           |
| Interlude after family    | `interlude02`                                 | `interlude-02.webp`       | `accessory-01`        | **Look P** — tiara/updo crop OR hands+tulle OR embroidery (face absent/cropped) |
| Interlude after itinerary | `interlude03`                                 | `interlude-03.webp`       | `environment-01`      | **Look P** — empty reception garden / lanterns (S5)                             |
| Interlude after RSVP      | `interlude04`                                 | `interlude-04.webp`       | `tulle-atmosphere-01` | **Look P** — ice tulle + cool silver-blue atmosphere, no walking Camila         |
| Gallery 1                 | `gallery01`                                   | `gallery-01.webp`         | `close-01`            | Camila close                                                                    |
| Gallery 2                 | `gallery02`                                   | `gallery-02.webp`         | `threequarter-01`     | Camila ¾                                                                        |
| Gallery 3                 | `gallery03`                                   | `gallery-03.webp`         | `profile-01`          | Camila profile / over-shoulder                                                  |
| Gallery 4                 | `gallery04`                                   | `gallery-04.webp`         | `gown-01`             | Camila mid/full gown                                                            |
| Gallery 5                 | `gallery05`                                   | `gallery-05.webp`         | `gown-02`             | Camila alternate full/mid                                                       |
| Gallery 6                 | `gallery06`                                   | `gallery-06.webp`         | `seated-01`           | Camila seated / ledge                                                           |
| Gallery 7                 | `gallery07`                                   | `gallery-07.webp`         | `detail-01`           | Detail (hands / embroidery)                                                     |
| Gallery 8                 | `gallery08`                                   | `gallery-08.webp`         | `detail-02`           | Detail (tiara / bodice)                                                         |
| Gallery 9                 | `gallery09`                                   | `gallery-09.webp`         | `atmosphere-01`       | Empty loggia                                                                    |
| Gallery 10                | `gallery10`                                   | `gallery-10.webp`         | `atmosphere-02`       | Night arcade mood                                                               |

**Count:** 2 frozen heroes + 19 replaceable = 21 image slots. Itinerary / gifts / RSVP / quote /
countdown: no photos.

### Pose budget (anti near-duplicate)

Camila face shots must differ by **angle + crop + pose** (not the same standing ¾ repeated):

1. Frontal bust (`portrait-01`)
2. Intimate close (`thankyou-01`)
3. Featured ¾ (`family-01`)
4. Close face (`close-01`)
5. Mid ¾ / profile (`threequarter-01`)
6. High-angle bust (`profile-01`)
7. Full gown standing (`gown-01`)
8. Alternate gown terrace B (`gown-02`)
9. Seated / ledge B (`seated-01`)

**Optional gallery-only variety** (never interludes): wide with small figure; over-shoulder terrace;
walking Look B.

**Interludes = Look P only** (owner KEEP): `architecture-01`, `accessory-01`, `environment-01` (S5),
`tulle-atmosphere-01`.

Place/detail gallery + venues: `detail-01/02`, `atmosphere-01/02`, `ceremony-01`, `reception-01`.

---

## Same-person protocol (mandatory)

### Refs every generation

| Shot type            | Required `reference_image_paths`                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Any Camila face/body | `locks/face.webp` + `locks/body.webp` + `masters/hero-mobile.webp` (+ desktop when composition is wide) |
| Place-only           | `locks/environment.webp` + `masters/hero-desktop.webp`                                                  |

Never use `camila-ice-waves` or `camila-marble-moon` as refs for this demo.

### Locked attributes (Ice Loggia)

- Dark hair **updo** + soft tendrils (not long loose waves)
- Thin silver tiara
- Ice-blue **strapless** sweetheart gown (no detached puff sleeves)
- Covered stone loggia / blue hour; no giant moon / glitter storm / porcelain skin

### Gate before copy → demo

1. Side-by-side vs `locks/face.webp` (brows, nose, jaw, hairline, skin tone).
2. Wardrobe check vs `locks/body.webp` (strapless + updo).
3. Reject if another “cousin” face, wrong hair/sleeves, moon, or near-duplicate of an approved shot.
4. Max **2** regenerations per shot ID; then pause and report.
5. Only then: sharp → WebP → `talents/.../shots/<id>.webp` → copy to demo filename.

### Demo integrity

- After each approved batch, demo non-hero files for that batch must match talent shot bytes.
- Heroes must stay byte-identical to Ice Loggia masters.

---

## Cleanup done (2026-07-26)

Defaults applied on owner “Proceed”:

1. Deleted `camila-ice-loggia/shots/_quarantine-drift/`.
2. Demo non-heroes restored from marble archive; Ice overlay: `portrait`, `thank-you-portrait`,
   `family`, `interlude-03` + frozen heroes.
3. Marble Moon: full archive kept; face/env locks kept (no body lock).
4. Ice Waves: structure kept (parked).
5. JSON: `family.featuredImage: "family"` wired.

**Delivery (2026-07-26 evening):** Look P interludes copied (`architecture-01`, `accessory-01`,
`environment-01` S5, `tulle-atmosphere-01`). Most gallery + venues + face-critical Ice overlays in
demo. Remaining: `gallery-03` / `profile-01` (paused). Heroes frozen. `family.featuredImage` wired.

## Pipeline after cleanup

```text
Done: body lock → face-critical → Look P interludes → most gallery/venues → sharp → demo
Remaining: profile-01 high-angle → gallery-03 → invitation QA 390+1440
```

## Stop / rollback

- Identity drift after 2 tries → pause
- Hero overwrite → restore from talent masters
- Interlude with readable Camila face → reject / regenerate as Look P
- Do not commit unless explicitly asked
