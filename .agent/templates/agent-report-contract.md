---
template: agent-report-contract
purpose: Shared human-facing report hierarchy and Decision/MCQ rules for agent skills
version: 1.2.0
applies_to:
  - .agent/workflows/error-remediation.md
  - .agent/skills/staged-code-review
  - .agent/skills/staged-code-review-apply
  - .agent/skills/commit-planner
---

# Agent Report Contract

Normative layout for user-facing reports from the skills/workflows listed in frontmatter. Does not
change gate semantics, git authorization, or when those skills run.

## Report order (required)

1. **Verdict** (≤3 lines): status counts or atomicity + the single most important fact.
2. **Body**: findings, commits, or diagnostic detail (priority / commit order).
3. **Decision** (required close): one-line CTA when no choice is needed, or one MCQ (rules below).
4. **Ops footer** (only if relevant): verify results, stash name, cycle counter.

## Typography (markdown-only)

| Level | Use |
| --- | --- |
| `#` | Report title (once) |
| `##` | Major sections (priority bands, Decision, manual blockers) |
| `###` | One finding, one commit unit, or one error |
| **Bold** | Field labels and the verdict line only |
| Meta line | `path:line · impact · type` — not in the `###` title when avoidable |

LOW findings and routine “Applied” lists MAY be compact bullets or tables. HIGH findings, manual
blockers, and each proposed commit MUST be full cards with separate labeled lines.

## Expanded card fields

- **What** (symptom or intent) — short `###` title
- **Why** — one short block (matters / boundary)
- **Fix** / message / next action — concrete
- Optional meta: `~N` lines, staging command, verify evidence

Do not cram Issue / Why / Fix into one paragraph.

## Decision prompts (MCQ)

- At most **one** MCQ block per response; place it only under **Decision**.
- Use an MCQ **only if** at least one holds:
  - real trade-off the agent must not assume
  - irreversible or high-risk next step
  - user must choose scope
  - remediation exhausted (cycle 3) or overlapping / ambiguous worktree
  - git recovery that could destroy work
  - commit plan **ambiguous**
- Otherwise use a single CTA (proceed / stop) or no question when nothing is asked of the user.
- When an MCQ is used, it **must** have exactly **three** options — `a`, `b`, `c` — mutually
  exclusive, ordered by relevance (`a` most relevant / recommended → `c` least / safest stop).
- **`a` is always the recommended default**, labeled `**(recomendado)**` (or equivalent in the
  user’s language).
- Never put the destructive or policy-violating option in `a`. Prefer `c` for stop / pause / do
  nothing when that is the conservative choice and not the recommendation.
- Ambiguous affirmatives (“sí”, “ok”, “adelante”) mean **`a`** when an MCQ was shown.
- Do not MCQ between commits of an already approved plan; do not ask cosmetic / feedback questions.

### Option copy (required)

Each option is one line (two max): **action + scope + brief example**. Concrete and aesthetic — not
saturated. No gate jargon, no path dumps, no restating the full verdict. Prefer a short name or type
(`guests.ts`, “partial SCSS”) over long paths. `c` may omit the example when it is simply stop/pause.

### MCQ shape (always three options)

```md
## Decisión

<one sentence: why a choice is required>

**¿Cómo quiere proceder?**

a) <acción y alcance>. Ej.: <caso corto> **(recomendado)**
b) <acción y alcance>. Ej.: <caso corto>
c) <alcance más estrecho, pausa o stop>
```

## Language

Match the user’s language for report prose. Commit subjects and code identifiers follow existing
repository rules (unchanged by this contract).

## Samples

See [`agent-report-samples.md`](./agent-report-samples.md).
