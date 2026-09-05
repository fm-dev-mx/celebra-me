---
template: agent-report-contract
purpose: Human-facing evidence reports and material decision prompts
version: 1.3.0
applies_to:
  - .agent/skills/error-remediation/SKILL.md
  - .agent/skills/staged-code-review
  - .agent/skills/staged-code-review-apply
  - .agent/skills/commit-planner
---

# Agent Report Contract

Presentation guidance for the listed workflows. Task/Handoff semantics remain in
[plans/README.md](../plans/README.md); this template grants no edit, Git, or environment authority.
Follow the user's requested output format. Preserve the workflow's required evidence and statuses.

## Report content

Lead with the verdict and material finding. Include actionable findings or commit boundaries,
expected vs observed behavior, why it matters, the concrete correction, and supporting file/line or
validation evidence. Keep risk, cleanup, apply-tags, and mixed staged/unstaged state explicit when
those distinctions affect the next action.

Use short prose, lists, or cards according to complexity. Omit empty sections and repeated
summaries. Report validation passed/failed/not run, residual risks, and session/stash state when
relevant. Examples in [agent-report-samples.md](agent-report-samples.md) are layouts, not extra
gates.

## Decisions and authorization

- Ask only for missing material intent, scope, acceptance, or permission required by the owning
  rule. Continue already-authorized work without a proceed/stop prompt or cosmetic feedback gate.
- Ask one question at a time. When options clarify a tradeoff, offer two or three meaningful choices
  ordered by recommendation (a first); do not invent a third option merely to fill a template.
- Describe the exact action and consequence briefly. Never recommend a policy-violating option.
- Bind approval to the actual pending action and scope. Do not interpret an ambiguous affirmative as
  permission for a broader option, destructive operation, or unrelated Git/environment write.
  Clarify only if the intended authorized action remains ambiguous.
- Reuse explicit current-task authorization; do not ask again between commits of an approved plan or
  for a remediation choice already made. New scope or protected-state drift requires the owning
  policy's decision process.
- Keep required failure escalation and human acceptance gates. A shorter report never waives them.

Match the user's language for report prose; technical identifiers and commit messages follow the
repository language rules.
