---
description: Gerardo 60 aesthetic alignment (Luxury Hacienda).
---

# 🤠 Workflow: Gerardo 60 Aesthetic Alignment

1. **Audit (Read-Only)**
    - [ ] `src/content/events/cumple-60-gerardo.json`: Verify theme params.
    - [ ] `src/assets/images/events/cumple-60-gerardo/`: Ensure WebP optimization.
    - [ ] `src/styles/themes/presets/_luxury-hacienda.scss`: 3-Layer Color check (no hex).
    - [ ] **Section Variants**: Quote (elegant/masculine), Countdown (minimal), Location
          (structured).
    - [ ] **Masculine Tone**: Avoid "Jewelry Box" flourishes (glitter, soft curves).

2. **Typography (Hacienda)**
    - [ ] `_variables.scss`: Define `--font-display-hacienda` (Serif/Western),
          `--font-body-hacienda`.
    - [ ] `_luxury-hacienda.scss`: Restrict to these variables.

3. **3-Layer Color Fix**
    - [ ] `_luxury-hacienda.scss`:
        - `--color-primary` -> Leather/Brown.
        - `--color-action-accent` -> Gold/Western.

4. **Asset Registry**
    - [ ] `AssetRegistry.ts`: Ensure `cumple-60-gerardo` entry.
    - [ ] `cumple-60-gerardo.json`: Use semantic asset keys.

5. **Verification** // turbo
    - [ ] `pnpm build`: Verify static generation.
    - [ ] A11y: Contrast check (Gold-on-Leather).
    - [ ] Visual QA: "Wanted" poster effect integrity.

6. **Self-Archive**
    - [ ] Move to `archive/workflows/` post-completion.

---

> [!NOTE] Hacienda = Weight, texture, history. Avoid light/glass/air (Jewelry Box).
