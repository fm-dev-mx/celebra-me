# Discovery Report: Family Section

**Date**: 2026-02-13 **Theme**: Luxury Hacienda (Gerardo)

## 🎨 Visual Patterns & Aesthetics

- **Editorial Ledger Concept**: The section successfully embodies a high-end editorial feel with
  sharp corners and "ledger" vertical lines.
- **Typography Hierarchy**: Use of _Cormorant_ for names and _Cinzel_ for group titles is consistent
  with the Hacienda theme.

## 🔴 Visual Bugs & Friction Points

- **Vertical Bloat**: The section uses very aggressive paddings (`clamp(6.5rem, 11vw, 10rem)`). This
  can make the section feel detached if there isn't enough intermediate content.
- **Mobile Density**: On smaller screens, the 2-column children layout might become cramped if guest
  names are long.

## 🛠️ Technical Audit (SCSS & Tokens)

- **Token Drift (Hardcoded Values)**:
    - `_family-theme.scss:47`: `#fdfcf9` (Parchment) should be a primitive or semantic token.
    - `_family-theme.scss:52-54`: `#1a1410`, `#5d4a3a`, `#926d48` are hardcoded bronze/ink colors.
    - `_family.scss:107`: `background: rgb(17 12 9)` inside `__media-frame` base style.
- **Thematic Consistency**: The "Jewelry Box" variant uses glassmorphism correctly, but the Hacienda
  variant bypasses the standard surface tokens for its custom parchment look.

## 📱 Mobile UX

- **Reveal Animations**: Triggered via `IntersectionObserver` with staggered delays (`0.08s`,
  `0.16s`, etc.), which is a premium touch.
- **Typography**: Name scaling (`clamp(1.6rem, 3.5vw, 2.3rem)`) is appropriate for legibility.

---

**Status**: Ready for Remediation Blueprinting.
