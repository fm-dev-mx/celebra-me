# Phase 01: Creative Foundation & Cleanup

Platform: **Celebra-me**  
Status: **COMPLETED**  
Weight: **20%**

## 1. Objective

Decouple the Ximena Meza Trasviña invitation from the "Jewelry Box" demo logic and establish the
"Noir & Pearl" Creative Foundation.

## 2. Tasks

### 2.1 Content Audit & Decoupling

- [x] Update `ximena-meza-trasvina.json` to use the `editorial` variant across all sections.
- [x] Audit `asset-registry.ts` to ensure all Ximena assets are correctly scoped and isolated.
- [x] Remove redundant "Demo" microcopy from descriptions.

### 2.2 Palette & Token Setup

- [x] Update `_top-premium-xv-ximena.scss` with the new color tokens:
    - Obsidian Ink (`#1B140D`)
    - Pearl Silk (`#F9F6F2`)
    - Burnished Gold (`#C5A059`)
- [x] Configure the high-contrast typography variables (Bodoni Moda).

### 2.3 Local Scope Initialization

- [x] Clean up `src/styles/events/ximena-meza-trasvina.scss`.
- [x] Move any experimental styles into a structured "Phase 1" block.
- [x] Verify that the `event--ximena-meza-trasvina` class is correctly wrapping the invitation.

## 3. Acceptance Criteria

- [ ] Preset variables reflect the Noir & Pearl palette.
- [ ] No `jewelry-box` variant references remain in the `ximena` event JSON.
- [ ] Routing and asset resolution work perfectly for the isolated production slug.
