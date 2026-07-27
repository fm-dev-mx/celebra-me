# Shot prompts v2 — camila-ice-loggia

Ready-to-run GenerateImage prompts. **Do not generate** until the owner approves this document.

Companion: `MODEL.md` · Plan: `.agent/plans/active/celestial-blue-photo-set-overhaul.md`

---

## 1) Same person (non-negotiable)

Camila is **one** person — the talent in `masters/hero-mobile.webp` + `masters/hero-desktop.webp`.

### Facial landmarks (must match `locks/face.webp`)

- Soft oval face; rounded chin (not fashion-CGI sharp).
- Dark natural brows, moderate arch.
- Dark almond eyes; soft lid (no “AI doll eyes”).
- Medium straight nose; bridge not overly narrow.
- Naturally full soft-pink lips (not overlined).
- Warm tan / olive skin with **visible pores and micro-variation** at 100%.
- Apparent age ~15 (quinceañera) — not mid-20s adult, not child.

### Body landmarks (must match `locks/body.webp`)

- Slender teen build; soft shoulders.
- Natural neck and collarbones.
- Gala proportion: fitted bodice + very full skirt volume.
- When hands appear: real teen hands, five fingers, discreet nails.

### Required refs

| Shot type               | Refs (order)                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| With face               | `locks/face.webp`, `locks/body.webp` (torso-only), + **at most 1** hero master |
| Body / gown detail only | `locks/body.webp`, optional `face.webp`                                        |
| Place only              | `locks/environment.webp`, `masters/hero-desktop.webp`                          |

**Forbidden as refs:** `camila-ice-waves`, `camila-marble-moon`, rejected shots.

**Body lock:** re-crop to bodice + upper skirt **without** the hero’s full standing pose, so pose
does not clone.

### Same-person gate

Reject if hairline, nose shape, eye–brow distance, skin tone, apparent age, or an obvious “cousin”
face drifts vs the face lock.

---

## 2) Looks (how many and why)

**v2 decision: 2 Camila looks + 1 place/detail layer (no person look).**  
Do not invent three different gowns — that breaks premium demo cohesion. Look B is the **same gala**
in another beat with minimal styling change.

| Look ID | Name                       | Wardrobe / hair                                                                          | When to use                                         | Shots                                                       |
| ------- | -------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| **A**   | Gala loggia                | Ice-blue strapless gown + thin tiara + updo (hero canon)                                 | Heroes (frozen), portrait, family, gallery Camila   | Default for face slots                                      |
| **B**   | Soft twilight              | **Same gown + same updo**, **no tiara**; optional sheer ice tulle/lace wrap on shoulders | 2 “other moment” gallery shots                      | `gown-02`, `seated-01`                                      |
| **P**   | Place / accessory / detail | No Camila face (or hands/fabric/tiara crop only)                                         | **All four interludes**, venues, atmosphere, macros | Interludes + ceremony/reception + gallery detail/atmosphere |

**Rule:** Look B does not change face or gown color; it only removes the tiara (± wrap) and changes
scene/light. It is still Look A in another beat.

**Interlude KEEP rule (owner):** Interludes are place / accessory / detail — **not** the quinceañera
as subject. Matches premium XV convention. Do not put a readable Camila figure in any interlude
slot.

---

## 3) Distinct scenes (not the same corridor)

One **estate** mood (Hacienda Los Claustros / Cuernavaca), **five spaces** that read differently:

| Scene ID | Space                    | Visual cues                                                           | Use in                                                               |
| -------- | ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **S1**   | Covered loggia           | Stone wall + arches + wood beams + blue hour (hero world)             | Frozen heroes; `architecture-01`, `gown-01`, gallery details         |
| **S2**   | Open garden terrace      | Open sky, low stone rail, dark foliage, no beam ceiling               | `gown-02`, `atmosphere-02`, optional gallery variety                 |
| **S3**   | Interior hacienda corner | Plaster or interior stone, warm lamp/candle light, no infinite arcade | `thankyou-01`, `family-01`, `seated-01`, `accessory-01`, `detail-02` |
| **S4**   | Ceremony atrium / facade | Religious stone or dusk atrium, architectural scale (no real brand)   | `ceremony-01`                                                        |
| **S5**   | Reception garden         | Distant tables or garden lanterns, patio/lawn, empty setup            | `environment-01` (interlude-03), `reception-01`, `atmosphere-01`     |

**Hard rule:** two consecutive shots must not share the same Scene ID **and** the same framing
(bust/mid/full).

---

## 4) Image sizes (generation + delivery)

GenerateImage may return odd sizes. **Always normalize with sharp** before writing `shots/` and the
demo pack.

### Delivery targets (WebP q=84)

| Use                           | Demo file(s)                               | Orientation | Pixel target  | Aspect |
| ----------------------------- | ------------------------------------------ | ----------- | ------------- | ------ |
| Hero mobile                   | `hero.webp`                                | Portrait    | **1024×1536** | 2:3    |
| Hero desktop                  | `hero-desktop.webp`                        | Landscape   | **1536×1024** | 3:2    |
| Portrait / thank-you / family | `portrait`, `thank-you-portrait`, `family` | Portrait    | **1024×1536** | 2:3    |
| Interludes (tall full-bleed)  | `interlude-01`…`04`                        | Portrait    | **1024×1536** | 2:3    |
| Gallery                       | `gallery-01`…`10`                          | Portrait    | **1080×1350** | 4:5    |
| Venue                         | `ceremony`, `reception`                    | Portrait    | **1080×1350** | 4:5    |

### Generation rules

- Prompt must say `native VERTICAL 2:3` or `native HORIZONTAL 3:2` (desktop hero only; frozen).
- If a portrait slot returns landscape → **regenerate**; do not blind-crop (crop caused
  near-duplicates).
- Export: `sharp` resize with `fit: 'cover'` only when framing is already correct; otherwise
  regenerate.
- Do not upscale from thumbs; if short side &lt; 900px → regenerate.

---

## 5) Anti-AI + top-tier craft (global block)

Append to **every** prompt (Camila and place):

**Craft / anti-slop**

> Photographed on a full-frame camera with a 50mm or 85mm prime, optical depth of field, subtle film
> grain, natural color science. Believable fabric folds, imperfect real skin (pores, tiny freckle or
> peach fuzz), slight asymmetry. Single motivated light source + soft ambient. Editorial luxury
> invitation photography, quiet and expensive — not stock, not CGI, not beauty-filter.

**Bans**

> NO plastic porcelain skin, NO waxy glow, NO oversized anime eyes, NO perfect bilateral symmetry,
> NO giant moon, NO sparkle storm / glitter fog, NO fake bokeh orbs soup, NO melted hands, NO extra
> fingers, NO warped pillars, NO unreadable jewelry mush, NO watermark, NO text, NO logo, NO catalog
> grin, NO HDR crunch, NO oversaturated teal-orange grade.

**Luxury bar**

> Looks like a $5k+ quinceañera editorial for a premium digital invitation: restrained palette,
> tactile stone and tulle, emotional stillness, one clear subject. If it could be a generic
> Pinterest AI dump, reject.

---

## 6) Identity lock string (Camila Look A)

```text
Exact same Latina quinceañera as the provided face-lock and body-lock references (identity must match): ~15, warm tan skin with visible pores, dark almond eyes, soft oval face, natural brows, dark brown hair in an elegant UPDO with a few soft face-framing tendrils, thin delicate silver tiara. Ice-blue STRAPLESS sweetheart ballgown, fitted bodice with restrained silver floral embroidery, full layered tulle skirt. Same facial bone structure and body proportions as references — not a sister, not a different model.
```

**Look B delta** (add only on Look B shots):

```text
Look B variant of the SAME girl and SAME ice-blue strapless gown: remove the tiara; optional sheer ice-blue tulle wrap on shoulders. Hair remains the same elegant UPDO. Do not change her face.
```

---

## 7) Per-shot prompts

### Frozen

| File                | Size      | Notes                           |
| ------------------- | --------- | ------------------------------- |
| `hero.webp`         | 1024×1536 | Look A · S1 · do not regenerate |
| `hero-desktop.webp` | 1536×1024 | Look A · S1 · do not regenerate |

---

### Face-critical

#### `portrait-01` → `portrait.webp` · Look A · S1 · **1024×1536**

| Axis    | Value                                            |
| ------- | ------------------------------------------------ |
| Framing | Bust                                             |
| Pose    | Eyes to camera; hands out of frame               |
| Scene   | Loggia: stone-wall bokeh only (no full corridor) |

**Refs:** face, body, hero-mobile

```text
Native VERTICAL 2:3 bust portrait for a luxury invitation envelope/OG. Exact same Latina quinceañera as the provided face-lock and body-lock references (identity must match): ~15, warm tan skin with visible pores, dark almond eyes, soft oval face, natural brows, dark brown hair in an elegant UPDO with a few soft face-framing tendrils, thin delicate silver tiara. Ice-blue STRAPLESS sweetheart bodice with restrained silver floral embroidery at the neckline only — tight bust crop, no full skirt, no standing full-body. Background: out-of-focus dark stone wall inside a covered loggia, blue-hour cool ambience, soft key at 45°. Photographed on a full-frame camera with an 85mm prime, optical DOF, subtle film grain, natural color science. Believable skin, slight asymmetry. Quiet expensive editorial. NO plastic skin, NO catalog grin, NO full-length hero pose, NO hand lifting skirt, NO long loose waves, NO puff sleeves, NO giant moon, NO glitter storm, NO text.
```

#### `thankyou-01` → `thank-you-portrait.webp` · Look A · S3 · **1024×1536**

| Axis    | Value                                |
| ------- | ------------------------------------ |
| Framing | Intimate close (face ~60% of height) |
| Pose    | Gaze slightly off-camera             |
| Scene   | Hacienda interior, warm side light   |

**Refs:** face, body

```text
Native VERTICAL 2:3 intimate close-up thank-you portrait. Exact same person as face-lock (identity must match): dark UPDO, thin silver tiara, warm tan skin with pores. Face fills most of the frame; soft contemplative gaze slightly OFF camera. Only a hint of ice-blue strapless bodice at bottom. Scene: quiet hacienda interior — plaster or stone wall, warm sidelight from a single lamp/candle feel, cool shadows — NOT the outdoor arcade corridor. Full-frame 85mm, film grain, natural skin. NO outdoor loggia clone, NO plastic skin, NO hero standing pose, NO long waves, NO puff sleeves, NO moon, NO glitter, NO text.
```

#### `family-01` → `family.webp` · Look A · S3 · **1024×1536**

| Axis    | Value                               |
| ------- | ----------------------------------- |
| Framing | Mid (waist to head)                 |
| Pose    | Hands clasped in front              |
| Scene   | Interior corner, soft doorway light |

**Refs:** face, body, hero-mobile

```text
Native VERTICAL 2:3 mid portrait for family section. Exact same person as face-lock and body-lock: dark UPDO, thin silver tiara, ice-blue STRAPLESS gown. Crop mid-thigh to head. Hands gently clasped in front of waist — NOT lifting the skirt. Calm gaze to camera. Scene: hacienda sitting-room corner, warm interior light from a side doorway, soft wall texture — different from outdoor loggia heroes. Full-frame 50mm, subtle grain, luxury stillness. NO outdoor corridor clone, NO plastic skin, NO long waves, NO puff sleeves, NO moon, NO text.
```

---

### Interludes — Look P only (place / accessory / detail)

Demo filenames stay stable. Shot IDs renamed for intent. **No readable Camila face or walking figure
in any interlude.**

| After section | Demo file           | Shot ID               | Subject                                                                      |
| ------------- | ------------------- | --------------------- | ---------------------------------------------------------------------------- |
| location      | `interlude-01.webp` | `architecture-01`     | Empty covered loggia / estate architecture (S1)                              |
| family        | `interlude-02.webp` | `accessory-01`        | Tiara/updo crop OR hands+tulle OR embroidery (face absent / heavily cropped) |
| itinerary     | `interlude-03.webp` | `environment-01`      | Empty reception garden / lanterns (S5)                                       |
| rsvp          | `interlude-04.webp` | `tulle-atmosphere-01` | Closing ice tulle + cool silver-blue atmosphere (no person)                  |

#### `architecture-01` → `interlude-01.webp` · Look P · S1 · **1024×1536**

| Axis    | Value                                       |
| ------- | ------------------------------------------- |
| Framing | Wide architectural                          |
| Subject | Empty covered loggia — stone, arches, beams |
| Ban     | Any person / face / gown figure             |

**Refs:** environment, hero-desktop

```text
Native VERTICAL 2:3 establishing place interlude. Empty covered stone loggia at blue hour — pillars, arches, wooden ceiling beams in strong perspective, cool twilight depth, one or two warm wall lanterns. Estate architecture dominates; NO people, NO face, NO gown figure, NO small silhouette of a quinceañera. Photoreal stone grit, film grain, quiet luxury invitation atmosphere. Full-frame 35mm. NO giant moon, NO glitter fog, NO marble ballroom stock, NO text, NO logos.
```

#### `accessory-01` → `interlude-02.webp` · Look P · S3 · **1024×1536**

| Axis    | Value                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Framing | Tight accessory / detail crop                                                                                                               |
| Subject | Choose ONE: (a) thin silver tiara + updo hair only, face cropped away; OR (b) hands + ice-blue tulle; OR (c) silver bodice embroidery macro |
| Ban     | Eyes-to-camera portrait; readable full face                                                                                                 |

**Refs:** body, face (crop-away only), environment optional

```text
Native VERTICAL 2:3 accessory interlude, NO portrait. Luxury quinceañera detail only — pick one clear subject: thin delicate silver tiara resting in a dark elegant UPDO with face completely out of frame or reduced to an unreadable cheek/ear edge; OR teen hands (match body-lock skin tone, five real fingers) gently holding ice-blue tulle; OR tight macro of restrained silver floral embroidery on ice-blue strapless bodice fabric. Warm interior hacienda bokeh or soft cool stone. Full-frame 85mm, film grain, tactile luxury. NO eyes-to-camera, NO full face, NO standing full-body Camila, NO catalog grin, NO moon, NO glitter storm, NO text.
```

#### `environment-01` → `interlude-03.webp` · Look P · S5 · **1024×1536**

**Status:** refine toward empty reception garden / lanterns (S5). Prior S1 loggia plate is wrong for
this slot if it still reads as covered arcade only.  
**Refs:** environment, hero-desktop

```text
Native VERTICAL 2:3 empty reception-garden place interlude at blue hour. Hacienda patio or lawn with distant unoccupied tables or soft garden lanterns / restrained string lights, lush dark greenery, cool silver-blue ambient. No people, no faces, no gown figure. Photoreal luxury venue setup waiting for guests. Full-frame 35mm, film grain. NO covered loggia corridor clone, NO Camila, NO giant moon, NO marble ballroom stock, NO glitter storm, NO text.
```

#### `tulle-atmosphere-01` → `interlude-04.webp` · Look P · S2-ish / abstract · **1024×1536**

| Axis    | Value                                                                             |
| ------- | --------------------------------------------------------------------------------- |
| Framing | Soft atmosphere / fabric still life                                               |
| Subject | Ice-blue tulle layers + cool silver-blue light; optional faint stone/garden bokeh |
| Ban     | Walking Camila; any readable person                                               |

**Refs:** body (fabric only), environment optional

```text
Native VERTICAL 2:3 closing atmosphere interlude. Layers of ice-blue tulle and sheer fabric in cool silver-blue light — soft folds, tactile mesh, quiet luxury. Optional distant open-terrace or garden bokeh only; NO walking figure, NO face, NO tiara portrait, NO readable quinceañera. Mood: farewell stillness after RSVP. Full-frame 85mm, optical DOF, subtle film grain. NO person walking toward camera, NO hero pose, NO moon, NO glitter fog, NO text.
```

---

### Gallery — Camila

**Variety notes (optional extra Camila beats — gallery only, never interludes):**

- Wide establishing with a **small** Camila figure in depth (former `wide-01` idea).
- Over-shoulder mid on open terrace (former `portrait-02` idea).
- Walking Look B with subtle hem motion (former `portrait-03` idea).

Use these only if a gallery slot needs more pose variety after the named gallery shots below; do
**not** map them back to interlude-01…04.

#### `close-01` → `gallery-01.webp` · Look A · S3 · **1080×1350**

**Refs:** face, body

```text
Native VERTICAL 4:5 extreme close-up of the exact same face as face-lock: eyes, brows, nose, lips; tiara edge at top. Skin pores visible. Background: warm interior bokeh (hacienda room), not arcade. Beauty light soft and real. Full-frame 85mm, film grain. NO full body, NO plastic skin, NO moon, NO text.
```

#### `threequarter-01` → `gallery-02.webp` · Look A · S2 · **1080×1350**

**Refs:** face, body

```text
Native VERTICAL 4:5 TRUE PROFILE (90°). Exact same person as face-lock in silhouette: dark UPDO, thin tiara, strapless ice-blue bodice edge. She looks across an open terrace to blue-hour sky and trees — profile clean, not three-quarter. Rim light on face edge. Full-frame 85mm, grain. NO frontal face, NO covered loggia clone of hero, NO long waves, NO puff sleeves, NO moon, NO text.
```

#### `profile-01` → `gallery-03.webp` · Look A · S1 · **1080×1350**

**Refs:** face, body, environment

```text
Native VERTICAL 4:5 slightly HIGH-ANGLE bust inside covered loggia. Exact same person as face-lock looking UP toward lens, chin gently raised. Dark UPDO, thin tiara, strapless bodice. Wooden ceiling beams visible above. Warm lantern fill from below-front. Different camera height than eye-level heroes. Full-frame 50mm, grain. NO eye-level hero clone, NO long waves, NO puff sleeves, NO moon, NO text.
```

#### `gown-01` → `gallery-04.webp` · Look A · S1 · **1080×1350**

**Refs:** face, body, environment

```text
Native VERTICAL 4:5 full-length almost BACK view in covered loggia. Exact same person as face-lock: UPDO and thin tiara from behind; strapless ice-blue gown back + huge tulle dominate. Slight glance over one shoulder (face small). Columns both sides, blue hour. Fashion emphasis on gown volume. Full-frame 35mm, real fabric folds, grain. NO large frontal face hero clone, NO puff sleeves, NO moon, NO text.
```

#### `gown-02` → `gallery-05.webp` · Look B · S2 · **1080×1350**

**Refs:** face, body, environment

```text
Native VERTICAL 4:5 full-length, slight LOW angle on open garden terrace. Exact same person — Look B: same gown and UPDO, NO tiara, optional sheer wrap. One hand resting on a stone balustrade, weight on one leg, skirt cascading. Open sky blue hour + dark foliage (not beam ceiling). Full-frame 35mm, grain, tactile stone. NO centered covered-loggia hero clone, NO long waves, NO puff sleeves, NO moon, NO text.
```

#### `seated-01` → `gallery-06.webp` · Look B · S3 · **1080×1350**

**Refs:** face, body

```text
Native VERTICAL 4:5 seated portrait indoors. Exact same person — Look B: same strapless ice-blue gown and UPDO, NO tiara. Sitting on a carved wooden or stone bench in a hacienda room, tulle cascading to floor, hands in lap. Warm side window light. Clearly seated silhouette. Full-frame 50mm, grain, quiet luxury. NO standing outdoor hero pose, NO long waves, NO puff sleeves, NO moon, NO text.
```

---

### Gallery — detail / atmosphere · Look P

#### `detail-01` → `gallery-07.webp` · S1 · **1080×1350**

**Refs:** body, environment

```text
Native VERTICAL 4:5 detail, NO face. Hands of the same young woman (match body-lock skin tone) gently holding ice-blue tulle and silver bodice embroidery. Covered loggia stone bokeh. Believable fingers, no extras. Full-frame macro-ish 85mm, grain. NO face, NO moon, NO glitter storm, NO text.
```

#### `detail-02` → `gallery-08.webp` · S3 · **1080×1350**

**Refs:** face, body

```text
Native VERTICAL 4:5 detail of thin silver tiara in dark elegant UPDO and strapless ice-blue shoulder — face cropped away or only cheek/ear, NOT eyes-to-camera. Warm interior bokeh. Full-frame 85mm, grain. NO full hero portrait, NO moon, NO sparkle storm, NO text.
```

#### `atmosphere-01` → `gallery-09.webp` · S5 · **1080×1350**

**Refs:** environment, hero-desktop

```text
Native VERTICAL 4:5 empty hacienda garden reception at blue hour: gravel or stone path, distant lanterns, soft foliage, hint of empty reception setup far away. No people. Photoreal, film grain, restrained luxury. NO faces, NO giant moon, NO marble ballroom stock, NO text.
```

#### `atmosphere-02` → `gallery-10.webp` · S2 · **1080×1350**

**Refs:** environment, hero-desktop

```text
Native VERTICAL 4:5 empty open terrace at deeper night blue: stone balustrade, two warm lanterns, cool ambient, subtle floor reflection, garden silhouettes. No people. Photoreal, grain. NO faces, NO giant moon, NO fireworks, NO glitter fog, NO text.
```

---

### Location · Look P

#### `ceremony-01` → `ceremony.webp` · S4 · **1080×1350**

**Refs:** environment, hero-desktop

```text
Native VERTICAL 4:5 dusk ceremony place plate: historic stone atrium or church-adjacent courtyard in Mexican colonial mood (Cuernavaca feeling), blue hour, elegant and real. No readable modern brands, no people faces. Full-frame 35mm, grain, architectural honesty. NO giant moon, NO wedding-cake stock, NO glitter, NO text, NO logos.
```

#### `reception-01` → `reception.webp` · S5 · **1080×1350**

**Refs:** environment, hero-desktop

```text
Native VERTICAL 4:5 hacienda garden reception place plate at blue hour: cloister-garden or terrace dining setup empty or with distant unoccupied tables, restrained string lights or lanterns, lush dark greenery. Photoreal luxury venue. NO people faces, NO giant moon, NO heavy sparkle storm, NO marble ballroom from another set, NO text.
```

---

## 8) Summary map

| Shot                | Demo                      | Look | Scene      | Size      |
| ------------------- | ------------------------- | ---- | ---------- | --------- |
| _(frozen)_          | `hero.webp`               | A    | S1         | 1024×1536 |
| _(frozen)_          | `hero-desktop.webp`       | A    | S1         | 1536×1024 |
| portrait-01         | `portrait.webp`           | A    | S1         | 1024×1536 |
| thankyou-01         | `thank-you-portrait.webp` | A    | S3         | 1024×1536 |
| family-01           | `family.webp`             | A    | S3         | 1024×1536 |
| architecture-01     | `interlude-01.webp`       | P    | S1         | 1024×1536 |
| accessory-01        | `interlude-02.webp`       | P    | S3         | 1024×1536 |
| environment-01      | `interlude-03.webp`       | P    | S5         | 1024×1536 |
| tulle-atmosphere-01 | `interlude-04.webp`       | P    | atmosphere | 1024×1536 |
| close-01            | `gallery-01.webp`         | A    | S3         | 1080×1350 |
| threequarter-01     | `gallery-02.webp`         | A    | S2         | 1080×1350 |
| profile-01          | `gallery-03.webp`         | A    | S1         | 1080×1350 |
| gown-01             | `gallery-04.webp`         | A    | S1         | 1080×1350 |
| gown-02             | `gallery-05.webp`         | B    | S2         | 1080×1350 |
| seated-01           | `gallery-06.webp`         | B    | S3         | 1080×1350 |
| detail-01           | `gallery-07.webp`         | P    | S1         | 1080×1350 |
| detail-02           | `gallery-08.webp`         | P    | S3         | 1080×1350 |
| atmosphere-01       | `gallery-09.webp`         | P    | S5         | 1080×1350 |
| atmosphere-02       | `gallery-10.webp`         | P    | S2         | 1080×1350 |
| ceremony-01         | `ceremony.webp`           | P    | S4         | 1080×1350 |
| reception-01        | `reception.webp`          | P    | S5         | 1080×1350 |

**Look A:** 7 slots (+2 heroes) · **Look B:** 2 · **Look P:** 10 (all 4 interludes + 4 gallery
detail/atmosphere + 2 venues)

---

## 9) Order + gates

1. Owner approves this v2.
2. Re-crop `locks/body.webp` (torso-only).
3. Generate face-critical A / S1–S3 → same-person gate.
4. **Interludes Look P only:** `architecture-01` → `accessory-01` → refine `environment-01` (S5) →
   `tulle-atmosphere-01`.
5. Gallery Camila (close → profile → high-angle → back gown → terrace B → seated B). Optional: add
   former wide / over-shoulder / walking-B ideas here only if variety still needed.
6. Detail / atmosphere / venues.
7. sharp → exact pixel targets → `shots/` → copy into demo.
8. Full contact sheet: same features + distinct scenes + no AI-slop look; interludes must pass
   **no-face / place-or-accessory** gate.
9. Invitation QA at 390×844 and 1440×900.

### Immediate reject

- Same pose/scene as another approved shot (clone).
- Landscape output in a vertical slot.
- Waves look (loose hair / puff sleeves).
- Giant moon, glitter, plastic skin.
- Face that fails side-by-side vs `locks/face.webp`.
- **Any interlude with a readable Camila face or walking figure** (must be Look P).
