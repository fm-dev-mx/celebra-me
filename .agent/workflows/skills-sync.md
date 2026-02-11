---
description:
    Audits and synchronizes agent skills with the project's current state, ensuring architectural
    alignment and proper formatting.
---

# 💎 Workflow: Skills Sync & Alignment

Use this workflow to ensure all agent skills in `.agent/skills` are correctly formatted (YAML
frontmatter) and aligned with the project's latest architectural decisions (e.g., Jewelry Box
aesthetic, 3-Layer Color Architecture).

## Execution Steps

1. **Environmental Scan**:
    - List all skills in `.agent/skills/`.
    - Identify core architectural invariants from `ARCHITECTURE.md` and `PREMIUM_UX_VISION.md`.

2. **Structural Audit**:
    - Verify each `SKILL.md` contains proper YAML frontmatter:
        ```yaml
        name: skill-name
        description: Concise description of the skill.
        ```
    - Ensure all links within skills are absolute or project-relative correctly.

3. **Technical Alignment**:
    - Check if color/theming instructions use the **3-Layer Color Architecture**.
    - Verify animation patterns align with the **Jewelry Box** aesthetic (e.g., `premiumFadeUp`).
    - Ensure SCSS patterns prioritize design tokens over hardcoded values.

4. **Remediation**:
    - Fix missing or incorrect YAML frontmatter.
    - Update outdated technical references (e.g., replacing old color variables with new tokens).
    - Remove redundant or conflicting instructions across skills.

5. **Cross-Reference Sync**:
    - Ensure `Related skills` sections in `SKILL.md` files are accurate and point to existing
      skills.

6. **Final Verification**:
    - Run build/lint check if skill changes affect scripts or schemas.
    - Report changes with an **Architect's Rationale**.

// turbo

## Agent Instruction

You are the **Lead Design Systems Architect**. Analyze all skills for structural integrity and
technical alignment. Your goal is to eliminate "instruction drift" and ensure the agent's knowledge
base matches the project's premium state. Proceed with a "Safety First" approach—read a file fully
before modifying it.
