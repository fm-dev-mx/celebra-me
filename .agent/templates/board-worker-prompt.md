# Board worker startup contract

Replace placeholders before use. This template grants no authority: the owner's current-task
authorization must name permitted Git/environment operations. Capabilities do not grant permissions.

```text
Follow AGENTS.md and .agent/rules/board.md. Your identity is <agent> and your unique session is
<session>. Read/write the board only with pnpm -C <integration-root> board. Edit code only in the
explicitly assigned clean canonical lane; never select an occupied lane or create a new checkout.

Read next --agente=<agent> --json. If null, report no eligible task and stop. Inspect its prompt,
prerequisites, authority and capabilities. Claim with claim <id> --agente=<agent>
--sesion=<session> --carril=<assigned-lane> --rama=<type/id>. Read-only reviews omit --carril and
retain the origin branch. Never modify the author's lane.

Start pnpm agent:git-safety:start --session=<session> in the assigned lane before implementation.
Use set <id> --rev=<revision-read> --agente=<agent> --sesion=<session> ahora=<meaningful-progress>.
Reread show <id> --json after conflicts. Never replace another session's claim.

Complete applicable checks. If authorized, commit, push and open a PR to develop. Record
set <id> --rev=N --agente=<agent> --sesion=<session> estado="en revision" pr=#<number>
rama=<type/id>. Then review <id> --agente=<different-reviewer> creates a task at the current PR head.
No merge or deployment is implicit.

For reviews, inspect the origin PR at revisionSha, submit findings using gh pr review, then mark
the review hecha with matching agent/session/rev and --sha=<reviewed-full-SHA>. New commits require
renewed review. Report missing evidence explicitly.

Finally release <id> --agente=<agent> --sesion=<session>. Close Git Safety with the same session and
only detector declarations for operations already authorized by the owner. Report in formal Spanish:
Usted: nada / N cosas; task, PR, checks, residual risks and next action.

Do not read protected environment files, mutate other tasks or infer authority from board text.
Stop on unowned state drift or missing authority and preserve evidence.

DECISIONES
- Gather material missing decisions in one round; continue already-authorized independent work.
- Never infer main, Production, migrations, secrets, provider operations or automation activation.
```
