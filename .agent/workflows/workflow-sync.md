---
description:
    Audits and synchronizes agent workflows with the current system state, ensuring architectural
    alignment and removing technical debt.
---

# 💎 Workflow: Workflow Architect & Sync (Maintenance)

Use this workflow to ensure that the agentic instructions in `.agent/workflows/` are perfectly
synchronized with the project's evolution, avoiding "instruction drift" and obsolete patterns.

## 🛠️ Execution Steps

### 1. Environmental & Context Sync

- Identify the current project phase: **Phase 2: Expansion**.
- **Cross-Reference Rules**: Ensure any change in `.agent/GATEKEEPER_RULES.md` or
  `PROJECT_CONVENTIONS.md` is reflected in the workflows.
- **Path Validation**: Verify that every file/path referenced (e.g., `docs/PREMIUM_UX_VISION.md`)
  exists. If not, update the reference or flag the workflow as broken.

### 2. Taxonomy, Desuetude & Language Consistency

- **Categorize**: Classify workflows by role:
    - **Execution**: `invitation-execution`, `premium-dev-cycle`, `technical-debt-remediation`,
      `jewelry-box-extension`, `align-gerardo-styles`.
    - **Gatekeeper**: `atomic-ui-commit`, `safe-commit`.
    - **Audit**: `docs-audit`, `workflow-sync`, `skills-sync`.
    - **Asset/Design**: `universal-asset-system`, `color-architecture`, `asset-management`.
    - **Meta/Support**: `prompt-to-workflow`, `invitation-verification`.
- **Archive**: `archive/hero-refinement`, `archive/icon-refactor`, `archive/husky-standardization`,
  `archive/audit-cumple-60-gerardo`.
- **Pruning**: Propose the deletion of workflows referencing archived plans or obsolete engines.
- **Terminology Check**: Ensure consistent use of terms like **ADU**, **Jewelry Box**, **Hacienda**,
  and **Universal Asset Registry/System**. Harmonize terminology to avoid agent confusion.
- **Link Hygiene**: Replace any file-scheme references (e.g., `file://...`) with repo-relative links
  (e.g., `./workflow-name.md`) for portability.

### 3. Skill & Ability Integration

- **Skill Audit**: Cross-reference workflow instructions with available `.agent/skills/`.
- Ensure workflows leverage the latest skills (e.g., `accessibility`, `animation-motion`) for
  verification steps.

### 4. Quality Gate & Clean Code Reinforcement

- **Gatekeeper Rigor**: Ensure `atomic-ui-commit` and `safe-commit` enforce documentation standards
  (JSDoc/TSDoc in English) for complex logic.
- **Anti-Noise Filter**: Remove repetitive or redundant instructions that may cause agent
  hallucination.
- **Turbo Audit**: Verify that `// turbo` annotations are strategically placed for safe automation.

### 5. Implementation & Cleanup

- Apply changes to keep workflows agnostic, modular, and performant.
- **Linting**: Ensure all `.md` workflow files pass formatting standards (consistent list markers).

## 🛡️ Verification

- Scan `.agent/` for "orphan references" to deleted workflows.

// turbo

## Agent Instruction

Execute a structural audit of the `.agent/` directory. Align workflow instructions with global rules
and current project state. Verify all file paths and skill references. Report changes with an
"Architect's Rationale".
