# Discovery Report: Gallery Section

**Date**: 2026-02-13 **Theme**: Luxury Hacienda (Gerardo)

## 🎨 Visual Patterns & Aesthetics

- **Tactile Details**: The use of "rivets" (`.rivet`) and metallic bevels in the `luxury-hacienda`
  theme creates a very premium "framed photo" feel.
- **Masonry Flow**: Column-based layout works well for mixed portrait/landscape assets.

## 🔴 Visual Bugs & Friction Points

- **The "Mobile Gap" (Critical)**: The transition from Black & White to Color is currently triggered
  ONLY by `:hover`. On mobile devices, there is no hover, so guests never see the memories in full
  color unless they open the lightbox.
- **Missing Interaction Reward**: There is no "feedback" as the user scrolls through the gallery
  other than the static B&W images.

## 🛠️ Technical Audit (SCSS & Tokens)

- **Hardcoded Aesthetic Values**:
    - `_gallery-theme.scss:109`: Hardcoded background gradient for the section.
    - `_gallery-theme.scss:156`: `background: #1a1510` for card backgrounds.
- **Animation Logic**: `viewport={{ once: true, margin: '-100px' }}` is used for the entry stagger,
  but not for toggling visual states (B&W vs Color).

## 📱 Mobile UX

- **Performance**: `mix-blend-mode: luminosity` (line 178 in `_gallery-theme.scss`) is used for the
  B&W effect. This can be heavy on some mobile GPUs. A CSS `filter: grayscale(1)` might be more
  performant as a fallback.
- **Lightbox Navigation**: Close button is large enough for touch, but "swipe to dismiss" is missing
  (purely click/tap based).

---

**Status**: Ready for Remediation Blueprinting.
