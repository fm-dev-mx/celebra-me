# Fictional demo models

These personas are invented presentation identities, not biographical claims about depicted people.
Runtime invitation facts belong to each demo's `content.json`; this record owns stable identity and
source provenance only. Do not reuse client identities, guest records, music or payment details.

## Luciana Isabel Montes Rivera

- Model identifier: `luciana-montes-v1`.
- Full name: Luciana Isabel Montes Rivera. Full display: Luciana Isabel. Replica cover/signature:
  Luciana.
- Persona monogram: L·M; the America replica uses the single initial L. Fictional birth date: 16
  October 2012 (internal consistency only).
- Hometown: Los Mochis, Sinaloa, México.
- Father: Andrés Montes Salazar. Mother: Elena Rivera Castañeda.
- Godparents: Mariana Rivera Castañeda and Javier Ortega León (text only).
- Visual anchors: lilac embroidered gown, crown, dark hair and warm garden lanterns.
- Voice: warm, grateful, close to her family; Spanish guest-facing copy uses “usted.”
- Source: `source:model-session-xv-gemini-v3`, owner-supplied synthetic demo imagery.
- Family source `family-2.png`: fictional mother on the left, celebrant in the center, father on the
  right. These are authored roles, not identities inferred from the image.
- Active candidate: `src/invitations/demos/demo-xv-lantern-garden/content.json`.

### Source bindings

| Source           | Semantic role                 | Delivery derivative          | Treatment                           |
| ---------------- | ----------------------------- | ---------------------------- | ----------------------------------- |
| hero-2.png       | hero and showroom             | assets/hero.webp             | Whole source, 1080 x 1920, q84      |
| hero-1.png       | gallery01, first interlude    | assets/interlude-01.webp     | Whole source, 1280 x 2276, q84      |
| hero-3.png       | interlude02, second interlude | assets/interlude-02.webp     | Whole source, 1280 x 2276, q84      |
| gallery-02-3.png | gallery02, dress detail       | assets/gallery-01.webp       | Whole source, 1080 x 1350, q84      |
| gallery-03-1.png | gallery03, bouquet portrait   | assets/gallery-02.webp       | Whole source, 1080 x 1350, q84      |
| family-2.png     | gallery04, family photograph  | assets/family.webp           | Whole source, 1600 x 1066, q84      |
| gallery-05-1.png | gallery05, twirl              | assets/gallery-05.webp       | Whole source, 1280 x 853, q84       |
| gallery-05-2.png | gallery06, garden scene       | assets/closing.webp          | Whole source, 1080 x 720, q84       |
| gallery-05-2.png | thankYouPortrait              | assets/closing-keepsake.webp | Centered 4:5 crop, 1080 x 1350, q84 |

Paths above are relative to the candidate demo folder. Originals remain untouched. The closing
intentionally returns to the final gallery moment with a separate portrait crop; eight distinct
sources fill America's nine photographic slots. No extra imagery was generated. The family chapter
is text-only, as in the reference; the family photograph now belongs to the album.

The replica uses the complete profile and section configuration from America's repository definition
at 72842fa00 as a frozen copy, with demo-owned artwork in assets/art/. Client names, event dates,
venues and music are not inherited. There is no runtime dependency on the client profile. The
reference's five-photo album, two framed interludes and all ten sections are retained.

### Event edition and reuse

The 2027 XV edition turns fifteen on 16 October 2027. Do not silently change the birth date or move
the same fifteenth birthday forward each year. A future reuse must state its event edition and
reconcile age, birth date, dates and captions explicitly. Do not infer childhood milestones.

Program: 18:00 ceremony, 19:30 reception, 20:30 waltz, 20:45 surprise dance, 21:00 dinner and 01:00
farewell on the following Sunday. Demonstration guest: María Fernanda Solís, four places, supplied
by the shared demo pipeline. This replaces the proposed Sofía Navarro to avoid a second guest
mechanism. The completed demo must simulate replies without persistent writes. Venue names are
fictional; no invented street addresses, payment details or misleading venue-map links.

## Regina Sofía Alcázar Medina

- Model identifier: `regina-alcazar-v1`.
- Full name: Regina Sofía Alcázar Medina. Cover, envelope and signature: Regina; closing line:
  Regina Sofía.
- Persona monogram: R. Fictional birth date: 20 November 2012 (internal consistency only).
- Hometown: Querétaro, Querétaro, México.
- Father: Tomás Alcázar Ruiz. Mother: Paulina Medina Ortiz.
- Godparents: Adriana Medina Ortiz and Ernesto Villaseñor Paz (text only).
- Visual anchors: champagne satin gown with a full floor-length skirt and a sage sash, a small gold
  olive-leaf comb, pearl studs, olive grove, wooden pergola and a plain stone chapel without a bell
  tower. Never lanterns, towers, braids, crowns, a sun motif or lilac, so the design never recalls
  America.
- Voice: warm and direct, the serenade is the night's promise; Spanish guest-facing copy uses
  “usted.”
- Source: owner-approved synthetic session «Serenata» (twelve shots, review log in the owner's
  creative-ops session folder `demo-photo-sessions/xv-serenata/`). Slots: 03 cover, 09 interlude,
  01, 04, 05, 06 and 11 gallery, 12 closing, 05 cropped for the share card; 02, 07, 08 and 10 stay
  in reserve.
- Active candidate: `src/invitations/demos/demo-xv-serenata/content.json` (route `/serenata`, hidden
  in the showroom until the owner approves it).

The 2027 XV edition is Saturday 20 November 2027 in Querétaro: 18:00 mass, 19:30 reception, 20:30
waltz, 21:00 dinner, 22:00 serenade and 01:00 farewell on Sunday. The same event-edition rules as
above apply to any reuse.
