---
description: Premium Implementation & Verification Development Cycle (Full Rigor)
---

This workflow governs the development process for Celebra-me, ensuring every section meets luxury standards, architectural integrity, and technical perfection.

## 🔍 PHASE 0: Staging & Context Alignment

**Goal:** Analyze current workspace state to prevent technical debt and ensure architectural compliance.

1. **Staged Changes Audit:** If there are files in 'staged' or 'unstaged' changes:
    - **Anti-patterns:** Check for over-engineering, duplicated code, or placeholder logic.
    - **Architecture Check:** Validate BEM methodology, SCSS nesting limit (max 3 levels), and use of `@use` instead of `@import`.
    - **Security Boundary:** Ensure UI components do NOT import server-only modules or secrets.
    - **Integrity Check:** Verify if the current implementation matches the section's plan at 100%.
2. **Conflict Resolution:** Resolve incomplete work before starting new tasks.

## 🛠️ PHASE 1: Implementation (The Artisan)

**Goal:** Locate, plan, and execute with "Next-Gen" standards.

1. **Vision & Specification:** Analyze `docs/PREMIUM_UX_VISION.md` and the corresponding `docs/plan/[section].md`.
2. **Gap & Data Detection:** Stop if gaps are found or if real client data is being used (data must be 100% anonymized).
3. **Luxury Remediation Audit:** Identify and replace "low-quality" signals (placeholders, default easing, broken layout shifts).
4. **Optimization First:**
    - Use Astro's `<Image />` component for all assets (avoid raw `<img>`).
    - Minimize "Client Islands" (only use `client:*` if interactivity cannot be achieved with CSS/Astro).
    - Update `src/content/config.ts` if Content Collection schemas change.
4. **Premium Build:** Execute using: `astro-patterns`, `frontend-design`, `animation-motion`, `copywriting-es`, and `seo-metadata`.

## ⚖️ PHASE 2: Verification (The Curator)

**Goal:** Total Quality Battery and Audit.

1. **Technical & Style Suite:**
    - **Formatting & Linting:** Run Prettier and Lint (auto-fix if possible).
    - **Testing Mastery:** Run `pnpm test` and expand tests to cover new logic/edge cases (Skill: `testing`).
    - **Accessibility:** Ensure WCAG 2.1 AA compliance (Skill: `accessibility`).
2. **Aesthetic & SEO Audit:**
    - Evaluate "Jewelry Box" visual harmony.
    - Verify SEO/Open Graph metadata for social sharing.
3. **Issue Management:** Fix all "Improvement Points" before finalization.

## 📝 PHASE 3: Finalization & Dual Logging

**Goal:** Synchronize documentation and commit.

1. **Vision Update:** Mark section as `[x]` in `docs/PREMIUM_UX_VISION.md`.
2. **Implementation Log:** Add a formal entry to `docs/implementation-log.md` following the date/status/what-was-done format.
3. **Commit Message Generation:** Generate a professional commit message following Conventional Commits (e.g., `feat:`, `refactor:`, `chore:`, `fix:`, `style:`).
    - **Title:** Must reflect the most significant change.
    - **Body:** Provide a concise summary of changes for each file in the 'staged changes', explaining the *what* and *why* behind the modifications.

---
**Agent Instruction:** Follow this cycle strictly. Prioritize data anonymization and architectural boundaries.
