# Phase 02: Post-Mortem Templates

## Objective

Create a reusable template for capturing lessons learned (Post-Mortem) before a plan is formally archived.

## Context

Capturing what went right, what went wrong, and what we learned is crucial for continuous improvement, especially for plans that involve complex architectural changes or long-running tasks.

## Implementation Steps

1.  Create a new template file at `.agent/plans/templates/post-mortem.md`.
2.  The template should include the following sections:
    - **Plan Context:** Plan ID, Start Date, End Date, Owner.
    - **Executive Summary:** A brief summary of the outcome (Success, Partial Success, Failed, Superseded).
    - **What went well:** Highlights and successful strategies.
    - **What didn't go well / Challenges:** Friction points, technical debt discovered, or workflow issues.
    - **Lessons Learned:** Actionable takeaways for future plans.
    - **Pending items:** Minor things left undone that didn't block completion.

## Output

A new file `.agent/plans/templates/post-mortem.md`.
