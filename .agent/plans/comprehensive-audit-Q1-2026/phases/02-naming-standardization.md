# Phase 02: File Naming Standardization

## 🔍 Finding: Inconsistent File Naming (PascalCase vs kebab-case)
**Domain**: Project Standardization
**Criticality**: Medium

### Root Cause & Impact
Multiple core components in `src/components/` and `src/lib/` use `PascalCase` filenames (e.g., `InvitationSections.astro`, `EnvelopeReveal.tsx`).
*   **Root Cause**: Deviation from the project's official `kebab-case` naming convention.
*   **Impact**: Confusion in automated CLI tools, CI/CD linting failures (potentially), and a "broken window" effect where new development defaults to inconsistent naming patterns.

## 🛠️ Minimalist Viable Improvement (MVI)
1.  **Mass Rename**: Execute a controlled rename of all `PascalCase` components to `kebab-case`.
2.  **Import Update**: Update all references in `.astro`, `.ts`, and `.tsx` files to match the new filenames.
3.  **Linter Enforcement**: Add/Update a lint rule (e.g., in `eslint`) or a git hook to prevent the re-introduction of `PascalCase` files.

### ROI
Medium. Low technical risk, high impact on architectural cleanliness and developer consistency.
