---
description:
    ARCHIVED - Task workflow completed and replaced by broader Gerardo governance workflows.
---

# [ARCHIVED] 🤠 Workflow: Gerardo 60 Aesthetic Alignment

> **Archived Date**: 2026-02-13 **Reason**: Tactical alignment workflow completed. **Coverage**: Use
> `.agent/workflows/gerardo-technical-audit.md`, `.agent/workflows/gerardo-remediation.md`, and
> `.agent/workflows/theme-architecture-governance.md` for active work.

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
    - [x] Moved to `.agent/workflows/archive/align-gerardo-styles.md`.

---

> [!NOTE] Hacienda = Weight, texture, history. Avoid light/glass/air (Jewelry Box).
