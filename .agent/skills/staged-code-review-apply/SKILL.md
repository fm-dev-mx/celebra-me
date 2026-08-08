---
name: staged-code-review-apply
description: |
  Apply fixes from a staged-code-review report after revalidating apply-tags with safety gates.
  Prefer deletion and net reduction. Auto-apply safe TS/JS/SCSS/JSON cleanups; never auto-apply SQL,
  production, or governance docs. Never stages, unstages, or commits — user owns the index for
  visualization. Respects prior review MCQ scope choices.
domain: workflow
version: 1.4.0
when_to_use:
  - Immediately after a staged-code-review report when the user says proceed / apply / adelante
  - User explicitly asks to apply staged-code-review fixes
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read .agent/templates/agent-report-contract.md
  - A staged-code-review report exists in the current conversation
  - User explicitly asked to apply fixes
related_skills:
  - staged-code-review
  - commit-planner
  - git-stash-branch-cleanup
  - celebra-delegation-patterns
related_docs:
  - docs/core/git-governance.md
  - docs/core/project-conventions.md
  - .agent/templates/agent-report-samples.md
---

# Staged Code Review Apply

## Mission

Apply the `staged-code-review` plan with **net reduction**, revalidating review apply-tags against
gates. Leave the working tree dirty — **never stage, unstage, or commit**. The user stages when they
want to visualize or ship; MM (staged + unstaged) after edits is expected and correct.

Review tags are a **hint**, never a bypass. Prefer deletion over patching when both are safe.

**Report contract:** [`.agent/templates/agent-report-contract.md`](../../templates/agent-report-contract.md)
(samples: [`agent-report-samples.md`](../../templates/agent-report-samples.md)).

**Gates / protected paths:** [`references/gates-and-protected-paths.md`](./references/gates-and-protected-paths.md).

**Large apply sets:** [`references/parallel-mode.md`](./references/parallel-mode.md).

## Hard constraints

- Never mutate the index: no `git add`, `git restore --staged`, `git reset` (staging), or
  “re-stage after apply”. Never commit, tag, or push.
- Leave applied edits **unstaged** (or MM if the path was already staged) so the user can review in
  the working tree / Source Control “Changes” panel.
- Never auto-apply SQL or production patches.
- Prefer deletion; for cleanup-class auto-apply, success metric is net line reduction. Authorized
  HIGH `risk` fixes (via review/pre-apply MCQ that includes them) are **not** blocked by Gate A
  net-reduction; `~L` may be 0 or positive for those items.
- Gates stay agent-internal; human skip reasons in plain language (not “Gate A failed”).
- Decision MCQs: exactly `a`/`b`/`c` with action + scope + brief example (contract). Never offer
  agent-driven stage/unstage as an option.
- Use the same apply-tag vocabulary as review: `auto-safe` · `needs-confirm` · `manual`.

## Preconditions

1. A `staged-code-review` report with file:line findings and actionable fixes is in context. If
   missing, stop and ask the user to run `staged-code-review` first.
2. User explicitly authorized applying fixes in this task.
3. Optional backup stash **only** if the user also authorized git stash in this task (git-safety).
   If not authorized, skip stash and note that in Verify.

## Backup (when stash is authorized)

```sh
git stash push -m "pre-staged-code-review-apply-<timestamp>" --include-untracked
git stash apply --index
```

`--index` restores the user's staged state. Document the stash name in Verify. Old apply stashes:
`git-stash-branch-cleanup`.

## Flight order

1. **Inspect** — `git status --short`; note MM; confirm apply authorization (+ stash if allowed).
2. **Parse** — extract findings (file, line, issue, fix, priority, type, apply-tag, Clase). Prefer
   review tags when present. Process HIGH → MEDIUM. LOW only if it still passes the allowlist after
   revalidation (single-line deletion or comment-only).
3. **Revalidate** — load gates/protected paths; assign a **final** tag per finding (rules below).
4. **Scope bind** — if the user already chose scope via the review MCQ (`a`/`b`/`c`), honor it and
   do **not** re-ask the same question. If no equivalent choice exists and any final tag is
   `needs-confirm`, stop for one pre-apply MCQ before editing.
5. **Apply** — only authorized items. Re-read each target (line drift). Prefer deletion. Clean
   blank-line residue. Do not stage, unstage, or commit.
6. **Verify** — proportional commands (below). Fix regressions only in files you modified.
7. **Report** — Verdict → Body (Manual → Aplicado → Omitido) → Decision → Verify (ops).

If ≥6 findings across ≥3 files, load [`references/parallel-mode.md`](./references/parallel-mode.md).

## Tag revalidation

| Review tag | Apply may |
| --- | --- |
| `auto-safe` | Confirm against the same allowlist as review, or **downgrade** to `needs-confirm` / `manual` if gate/MM/protected/honesty fails |
| `needs-confirm` | Keep, or downgrade to `manual`; **upgrade** to `auto-safe` only with new evidence (e.g. proven zero `@use`) |
| `manual` | Never auto-apply; list under Manual |

Use the review skill’s **`auto-safe` allowlist and deny list**
([`staged-code-review/SKILL.md`](../staged-code-review/SKILL.md)) as the honesty check. If review
said `auto-safe` but the fix fails honesty, downgrade and list under **Omitido** (when out of scope)
or **Manual** as appropriate — do not silently apply.

### LOW triviality

Apply a LOW finding only when the **final** tag is `auto-safe` under that allowlist:

- Single-line deletion, **or**
- Comment-only fix with zero behavior change

Otherwise omit (even if review labeled `auto-safe`).

### Omitido reason phrases (standardize)

Prefer these short human reasons when downgrading or skipping:

- `cambia superficie pública`
- `no es borrado trivial`
- `requiere call sites fuera de staged`

Additional plain-language reasons are fine when none of the three fit (e.g. “fuera del alcance `a`”,
“solapamiento staged/unstaged”).

### Additional rules

- **HIGH + Clase `risk`:** default `manual`, unless the fix is trivial and local (≈1–3 lines, no
  control-flow change). Cleanup findings follow the table above.
- A review/pre-apply MCQ that **explicitly includes** a specific risk fix authorizes that item
  (still run Gates B/C; Gate A net-reduction does not block it).
- **MM** on the target file: never final `auto-safe` if the fix depends on a dirty working tree →
  `needs-confirm` or `manual` (“solapamiento staged/unstaged”).
- User pre-approval of a specific fix in this conversation satisfies the manual-review ask for that
  finding (still run Gates A/B for cleanup; Gate A waived for authorized risk as above).

### Deletion rules

| Situation | Final tag |
| --- | --- |
| Clearly dead file, zero consumers, outside protected paths | may be `auto-safe` after search |
| Doubt, `@use`/`@forward`, or unknown consumers | `needs-confirm` (one shared manifest) |
| Protected / governance / SQL / env | `manual` |

Collect all `needs-confirm` deletions into **one** manifest for a single pre-apply MCQ. Do not
interleave per-file delete prompts.

## Verify

| Change                       | Command                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| TypeScript                   | `pnpm type-check` (or project equivalent)                                      |
| Lint / SCSS                  | `pnpm lint` / style lint scripts                                               |
| Mixed / deletions            | `pnpm build` when appropriate                                                  |
| Content schema               | `pnpm ops validate-schema` when available                                      |
| Touched `.agent/` or `docs/` | Doc integrity: escaped backticks, broken fences, truncated operational phrases |

Triage: fix regressions in files you modified; do not refactor untouched files for complex
pre-existing lint. Trivial one-line pre-existing lint may be fixed; complex issues → Manual/Omitido.

## Report template

```md
# Apply result

**Veredicto:** <A> aplicados · <S> omitidos · <M> manual · ~<L> líneas · verify PASS|FAIL
**Scope:** <what the user authorized / default auto-safe>

## Manual

### <Short symptom>

`<path>:<line>`

**Motivo:** ...
**Sugerencia:** ...

## Aplicado

| Archivo | Cambio | ~líneas |
| --- | --- | --- |
| `<path>:<line>` | <short description> | <n> |

## Omitido

- `<path>:<line>` — <human-readable reason>

## Decisión

<CTA or one a/b/c MCQ — see rules>

## Verify

- <command> — PASS|FAIL
- Stash: <name or "skipped — stash not authorized">
```

`~L` = sum of lines actually removed/simplified in Aplicado (risk fixes authorized by MCQ may
contribute 0 or add lines; state that in the row if net is not a reduction). Omit empty sections.

### Pre-apply MCQ (only if `needs-confirm` and no equivalent review choice)

```md
## Decisión

Hay <N> borrados que requieren confirmación (manifest arriba).

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Auto-safe + borrar manifest confirmado**
  - **Objetivo:** Aplicar limpiezas seguras y proceder con el borrado del manifest.
  - **Pasos / Ej.:** Eliminar `_legacy-badge.scss` huérfano.

- **b)** **Solo auto-safe**
  - **Objetivo:** Aplicar limpiezas seguras dejando el borrado de archivos a intervención manual.
  - **Pasos / Ej.:** Limpiar imports y dejar el archivo `.scss`.

- **c)** **No aplicar cambios**
  - **Objetivo:** Cancelar la aplicación.
  - **Pasos / Ej.:** No modificar nada.
```

### Post-apply Decision

| Situation | Decision |
| --- | --- |
| Verify PASS, dirty tree, no new blockers | CTA: user stages when ready, then `commit-planner`; or MCQ if material Manual remains |
| Verify FAIL | CTA/MCQ for triage; never put destructive reset or agent stage/unstage in `a` |
| Nothing applied / all manual | CTA: resolve Manual or re-run review |

**Decision rules:**

- Honor prior review MCQ scope; do not re-ask the same choice.
- Pre-apply MCQ only when final `needs-confirm` remains unbound.
- Post-apply: Decision **after** Manual / Aplicado / Omitido; MCQ copy per contract.
- Manual section before Applied lists.
- Never instruct the agent to stage/unstage; remind that index updates are user-owned.
