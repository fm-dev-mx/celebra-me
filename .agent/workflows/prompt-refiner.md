---
description:
    Optimizes raw instructions into high-fidelity, dual-language engineered prompts for the
    Celebra-me ecosystem.
---

# 💎 Workflow: Prompt Refiner & Architect

Use this workflow to transform raw ideas or vague instructions into high-fidelity, dual-language
technical specifications that respect the project's core vision, architectural integrity, and
quality standards.

## Execution Steps

1. **Context Synthesis**:
    - Identify the core objective: Is it a new feature, a visual refinement, or architectural debt?
    - Reference the **Project Vision**: Align with defined aesthetic standards (e.g., textures,
      motion, typography).
    - Map to the **Tech Stack**: Ensure compatibility with the current framework, styling
      methodology, and data management patterns.

2. **Strategic Constraint Injection**:
    - **UI & Language Duality**: Detect the target audience language for UI strings while
      maintaining English for technical logic and documentation.
    - **Architectural Integrity**: Enforce established patterns (e.g., data/UI separation, component
      reusability, or specific design tokens).
    - **Optimization Standards**: Mandate checks for performance, accessibility, and mobile-first
      responsiveness.

3. **Documentation & Accountability**:
    - **Pre-Execution**: Review existing plan files or documentation for relevant context.
    - **Log & Sync**: Require the creation or update of implementation logs and high-level status
      documents (e.g., vision docs or master plans).
    - **Ground Truth**: Always prioritize the current state of the code as the source of truth over
      outdated documentation.

4. **Refined Prompt Structure (The Output)**:
    - **Role**: Senior Design Engineer, Architect, or Product Manager as appropriate.
    - **Sequential Logic**: Clear, actionable steps for file modification, creation, or archival.
    - **Verification**: Mandatory technical checks (builds, linting) and qualitative inspection
      (visual QA).

5. **Critical Reflection**:
    - Ask the agent to analyze potential friction points (e.g., performance impact, UX
      inconsistencies, or technical debt) before finalizing the plan.

// turbo

## Agent Instruction

Analyze the user's input and rewrite it into a professional technical prompt. The output must
strictly separate logic/technical instructions (English) from user-facing UI content (Target
Language), and include mandatory documentation and verification tasks.
