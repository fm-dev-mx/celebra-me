---
description:
    Transforms raw instructions into high-fidelity, dual-language engineered prompts or
    ready-to-use workflows (Evergreen or Task) in .agent/workflows.
---

# 💎 Workflow: Prompt-to-Workflow Architect

Use this workflow to transform raw ideas or vague instructions into high-fidelity, dual-language
technical specifications AND deployable workflow files (Evergreen or Task).

## Execution Steps

1. **Context Synthesis & Ground Truth**:
    - Identify the core objective: New feature, visual refinement, or architectural debt?
    - **Source of Truth**: Always prioritize the current state of the code over outdated docs.
    - Reference the **Project Vision** (textures, motion, typography) and **Tech Stack** (Astro/SCSS).

2. **Lifespan Categorization**:
    - **Evergreen (Tool/System)**: Reusable tools or global standards (e.g., `safe-commit`).
    - **Task (Tactical/Ephemeral)**: Single-use fixes or event updates (e.g., `update-hero-gerardo`).

3. **Strategic Constraint Injection**:
    - **Role Definition**: Assign a specific persona (Senior Design Engineer, Architect, etc.).
    - **Optimization Standards**: Mandate checks for performance, accessibility (WCAG), and mobile-first responsiveness.
    - **UI & Language**: English for logic, Target Language for UI strings.
    - **Architectural Integrity**: Enforce data/UI separation and design tokens.

4. **Workflow Construction**:
    - **Frontmatter**: Clear description. For **Tasks**, include references to target data/files.
    - **Sequential Logic**: Break down into Atomic Deployable Units (ADUs).
    - **Turbo Mode**: Apply `// turbo` to safe, non-destructive commands.
    - **Verification**: Mandatory technical checks (builds, linting) and qualitative Visual QA.

5. **Critical Reflection (Pre-Finalization)**:
    - Analyze potential friction points: performance impact, UX inconsistencies, or technical debt.
    - **Self-Archive (Tasks Only)**: Ensure a final step to move the workflow to `archive/`.

6. **File Deployment & Sync**:
    - Generate a slug-based filename and save via `write_to_file`.
    - Update `docs/implementation-log.md`.
    - Inform the user: "Blueprint deployed: `/[filename]` (Categorized as [Evergreen|Task])".

// turbo

## Agent Instruction

Analyze the user's input, synthesize the context using the **Ground Truth** principle, and proceed to **create the workflow file**. You MUST include a **Critical Reflection** block in your output before deploying the file, analyzing friction points. The resulting workflow must follow the project's premium standards.
