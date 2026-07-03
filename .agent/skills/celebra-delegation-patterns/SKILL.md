---
name: celebra-delegation-patterns
description: |
  Practical delegate_task patterns for Celebra-me: when to delegate, templates for each role,
  required context fields, output formats, and synthesis rules. Use this skill whenever you
  need to delegate a sub-task to a temporary subagent.
domain: workflow
version: 1.2.0
when_to_use:
  - Evaluating whether to use delegate_task for a sub-task
  - Drafting context for a role-style delegation (builder, copywriter, QA, visual-direction)
  - Processing or synthesizing subagent results
  - Defining task boundaries and output expectations before delegating
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/agent-routing.md (if routing is unclear)
related_skills: []
related_docs:
  - .agent/rules/agent-routing.md
---
# Celebra-me Delegation Patterns

Practical patterns for using `delegate_task(goal=..., context=...)` in Celebra-me.
Subagents are temporary — they run once, report back, and disappear.

## When to Use `delegate_task`

Use a subagent only when the task creates ONE of these benefits:

| Benefit | Description | Example |
|---|---|---|
| **Parallel speed** | Two+ independent subtasks can run simultaneously | Copy + visual direction in parallel |
| **Quality separation** | One agent creates, another reviews. Narrow role focus (e.g. copywriter working only on copy) is a subtype of this, not an independent reason. | Builder implements, QA verifies; copywriter focuses on copy without touching code |
| **Risk reduction** | Independent verification before delivery | QA reviews production changes before publish |

## When NOT to Use `delegate_task`

- **Trivial edits** — single-line fix, typo, one-file change (<2 min)
- **Unclear tasks** — you'd need to ask clarifying questions (subagents cannot use `clarify`)
- **Insufficient context** — the subagent would need more background than you can provide in `context`
- **Tightly coupled creative decisions** — visual coordination that requires seeing intermediate results
- **High overhead-to-value ratio** — delegation costs ~2 tool calls + context setup; if the task itself is 3 tool calls, do it directly

## File-Access Hygiene

Subagents must follow strict file-access discipline to avoid slow scans, OneDrive download triggers, and unnecessary I/O:

| Rule | Detail |
|---|---|
| **No broad searches** | Do NOT run repository-wide `search_files()` or `grep`/`rg` searches. Avoid patterns that could trigger OneDrive cloud-only file downloads through `rg.exe` or similar tools. |
| **Target explicit paths** | Read only the files and directories directly relevant to the task. If the task doesn't specify paths, ask the orchestrator for them — do not scan to discover. |
| **Avoid noise directories** | Do NOT read or search inside: `node_modules/`, `.astro/`, `dist/`, `.vercel/`, `coverage/`, `screenshots/`, `logs/`, `public/assets/`, `src/assets/images/events/*/` (binary media folders), or any `.git/` directory — unless the task explicitly requires it. |
| **Prefer project entry points** | Start with known entry points (`AGENTS.md`, `.agent/index.md`, `src/data/`, `src/lib/`, `src/pages/`) rather than scanning from the root. |
| **No asset enumeration** | Do not enumerate image assets, media files, or generated content unless the task is specifically about asset management. |

## Output-Length Rules

| Rule | Detail |
|---|---|
| **Target length** | 500–1,200 words (~3,000–7,000 characters). Stay concise. |
| **Exception** | Only exceed 1,200 words when the task explicitly asks for deep analysis or multi-section output. |
| **Structure** | Lead with recommendations or verdict (first paragraph). Follow with evidence. End with open questions or risks. |
| **No padding** | Every paragraph should contain an actionable finding. Remove boilerplate, generic introductions, and restated instructions. |

## Compact-Output Guidance

For certain task types, subagents should use a compact format instead of the standard 500–1,200 word target.

| Use compact output for | Do NOT use compact output for |
|---|---|
| Technical checklists | Final client-facing copy |
| QA summaries | Premium visual direction |
| Builder implementation reports | Creative strategy |
| Diff summaries | High-risk recommendations |
| Repetitive validation tasks | Anything where nuance matters |

Compact output format:
- Verdict first (one line)
- Bullets only — no paragraphs
- No boilerplate, no restating the prompt
- Only actionable findings
- Include risks and open questions
- Target: **250–700 words** unless explicitly told otherwise

## Structured Handoffs

Use `.agent/tmp/handoffs/<task-id>/` to pass approved output between
sequential delegated tasks. This prevents context truncation and
reduces `context` string bloat.

### When to use structured handoffs

| Situation | Use handoff? |
|---|---|
| Sequential delegation (copy → builder → QA) | ✅ Yes |
| Output may be truncated | ✅ Yes |
| Subagent produces compact output but exact details are needed downstream | ✅ Yes |
| Orchestrator pre-approves intermediate output before passing to next subagent | ✅ Yes |
| Task is trivial, single delegation | ❌ No |
| Only one read-only subagent | ❌ No |
| Orchestrator can synthesize directly from the summary | ❌ No |
| Handoff file overhead exceeds the task itself | ❌ No |

### File patterns

```
.agent/tmp/handoffs/<task-id>/
├── approved-copy.json          # Copywriter output, approved by Jeremías
├── visual-direction.md         # Visual direction, approved by Jeremías
├── implementation-spec.md      # Spec for the builder subagent
└── qa-checklist.md             # Quality review expectations
```

Create only the files actually needed for the task. Use `.json` for
structured data (copy fields, config values), `.md` for narrative guidance.

### Do NOT store in handoffs

- Secrets, credentials, API keys
- Private client data (PII, full names beyond what's needed)
- Large assets, generated images, screenshots
- Full subagent transcripts (Hermes cache handles these)
- Anything that should be version-controlled

### Cleanup

Delete `handoffs/<task-id>/` after the task is complete and verified.
Only delete files under the current task's handoff directory — never
run broad delete commands. If preserving for reference, report the path
and reason to the user.

## Required Context Fields (Always Include)

Every `context` string must contain:

1. **Role identity** — e.g. "Act as the Celebra-me QA reviewer"
2. **Task scope** — what files, components, or areas the subagent should touch
3. **Hard constraints** — what the subagent MUST NOT do
4. **Project rules reminder** — gatekeeper, git-safety, AGENTS.md conventions
5. **Validation commands** — what to run after making changes
6. **Output format** — what the summary must include

## Delegation Templates

### Template: Builder (Implementation)

```python
delegate_task(
    goal="Implement [specific feature/fix/component] for Celebra-me",
    context="""
Role: Celebra-me builder (implementation).

Task: <describe exactly what to build or fix, in which files>

Scope:
- Files to modify: <list>
- Files to create: <list>
- Do NOT touch: <list>

Constraints:
- Follow AGENTS.md: @/* imports, Spanish UI text, English identifiers/technical comments
- No Tailwind — use SCSS
- No new `any` — prefer unknown + narrowing
- No server-only code in client components
- Bound by .agent/rules/git-safety.md — do NOT stage or commit
- Bound by .agent/rules/gatekeeper.md — review rules before changing files

Validation:
- Run `pnpm type-check` after TypeScript changes
- Run `pnpm lint` after code changes
- Report any pre-existing lint errors separately

Output format:
1. Files created or modified (absolute paths)
2. Key design decisions (one sentence each)
3. Validation results (pass/fail per command)
4. Any pre-existing issues discovered
5. Target: 500–1,200 words unless the task requires more

Self-check before responding:
1. Role: did I stay within the assigned builder role?
2. Scope: did I modify only the scoped files?
3. Safety: did I avoid staging, commits, config changes, dependency changes, and unrelated refactors?
4. Evidence: did I run validation (or explain why not)?
5. Output: is the report in the requested format and length?
6. Risks: did I state any assumptions or remaining risks?
"""
)
```

### Template: Copywriter (Spanish Copy)

```python
delegate_task(
    goal="Write invitation copy for [event type] — [event name]",
    context="""
Role: Celebra-me copywriter (Spanish copy).

Task: <describe what copy is needed and for which sections>

Event context:
- Type: <XV / wedding / baby shower / baptism / birthday>
- Honoree(s): <names>
- Tone: formal but warm
- Sections needed: <hero, family, love-story, schedule, etc.>

Constraints:
- All copy in Spanish — formal "usted" register for guests
- No English in invitation copy
- Do NOT invent client details — use only provided data
- Do NOT assume religious content unless specified
- Follow brand voice in .agent/briefs/celebra-me.md
- Keep code/identifiers/comments in English if touching any code files

Output format:
1. Copy per section (in JSON or markdown ready for content schema)
2. Notes on tone adjustments per section
3. Any missing context that would improve the copy

Self-check before responding:
1. Is the copy natural Spanish and aligned with Celebra-me brand voice?
2. Did I avoid generic invitation clichés ("momentos inolvidables", etc.)?
3. Did I preserve names, event type, dates, and sensitive details exactly?
4. Role: did I stay within the copywriter role (no code or layout suggestions)?
5. Safety: did I avoid modifying any files?
6. Risks: did I state any uncertainty about tone or details?
"""
)
```

### Template: QA (Quality Review)

```python
delegate_task(
    goal="Run QA review on [page/component]: mobile-first visual check, proofreading, links",
    context="""
Role: Celebra-me QA reviewer.

Task: <describe what to review — specific pages, components, or routes>

Scope:
- Pages/routes to check: <list>
- Viewport priority: mobile-first (375px), then tablet (768px), then desktop (1280px)
- Use data-attribute selectors for screenshots, not fragile CSS selectors

Constraints:
- READ-ONLY — do NOT modify any file
- Do NOT run git operations
- Document every issue with: file path, line number, severity, evidence

Required checks:
1. Visual consistency (05-shot sequence: closed page, closed reveal, card, open reveal, hero-to-footer)
2. Copy proofreading (Spanish spelling, register, brand compliance)
3. Link verification (all links resolve, no broken anchors)
4. Accessibility (alt text, labels, button types, contrast)
5. Server/client boundary (no server-only imports in client components)

Output format:
1. Pass/fail per check area
2. For each issue: file, line, severity (high/medium/low), description
3. Screenshot evidence paths
4. Overall verdict: PASS / BLOCKING ISSUES / RECOMMENDED FIXES

Self-check before responding:
1. Did I verify each claim instead of assuming?
2. Did I check mobile-first behavior, copy accuracy, CTAs, layout, and regressions?
3. Did I clearly distinguish pass, pass-with-notes, and fail for each area?
4. Role: did I stay within QA reviewer role (no code fixes)?
5. Safety: did I avoid modifying any files or running git operations?
6. Evidence: did I use data-attribute selectors for screenshots (not CSS text)?
"""
)
```

### Template: Visual Direction (Image Prompts)

```python
delegate_task(
    goal="Create image prompts and visual direction for [event type] — [event name]",
    context="""
Role: Celebra-me visual director.

Task: <describe what visual content is needed>

Event context:
- Type: <XV / wedding / baby shower / baptism / birthday>
- Theme preset: <if known>
- Palette: <if known>
- Subjects: <honorees, family members, setting>

Constraints:
- READ-ONLY — do NOT modify code files
- Image gen params: Juggernaut XL v9 for photorealism, Flux Dev fp8 for general
- ComfyUI: CFG 4.5, sampler dpmpp_2m_sde+karras, steps 35
- Avoid: plastic skin, oversaturated colors, cartoon styles
- Preferred: warm lighting, natural skin texture, elegant composition
- Prompts should use Spanish event vocabulary for subjects

Output format:
1. Per-image: prompt (English for technical parameters, Spanish for subject context),
   negative prompt, model suggestion, CFG, sampler, steps, aspect ratio
2. Palette recommendation (hex codes)
3. Theme preset recommendation with rationale

Self-check before responding:
1. Does the direction feel premium and differentiated from generic templates?
2. Are recommendations practical for the existing Celebra-me design system?
3. Did I avoid unnecessary image generation or asset enumeration?
4. Role: did I stay within visual director role (no code or copy changes)?
5. Safety: did I avoid modifying any files?
6. Risks: did I state any uncertainty about model suitability or palette fit?
"""
)
```

## Forbidden Actions for ALL Subagents

Regardless of role, subagents must NOT:

- Stage or commit files (`git add`, `git commit`, etc.)
- Run production database commands
- Modify `config.yaml`, `.env`, or Hermes configuration
- Modify project configuration files (`astro.config.mjs`, `tsconfig.json`, `package.json`) unless explicitly directed
- Install packages or modify dependencies without explicit instruction
- Run destructive commands (`rm -rf`, `git reset --hard`, etc.)
- Access or expose secrets (API keys, tokens, passwords)

## Synthesis Rules for Jeremías

After a subagent completes, the orchestrator MUST:

1. **Read the summary before acting** — don't auto-approve subagent work
2. **Check for truncation** — if the summary appears cut off (starts mid-sentence, ends abruptly, or has a "TRUNCATED" marker), do NOT assume the missing content. Either ask for a concise re-summary or inspect the saved output only if a reliable cache path is provided.
3. **Verify file changes** — cross-check claimed file modifications with `read_file` or `git status`. Subagent outputs are self-reported.
4. **Re-run validation** — subagent-reported test/lint results are self-reported; run `pnpm type-check` and `pnpm lint` yourself after synthesis.
5. **Check for conflicts between subagents** — when merging outputs from multiple subagents, explicitly verify they don't contradict each other (e.g., copywriter proposed different text than what builder already changed, or visual director selected a different palette than what's in the theme).
6. **Report to user** — include subagent findings, your synthesis, any conflicts found, and remaining risks.
7. **Clean up handoffs** — after the task is complete, delete `.agent/tmp/handoffs/<task-id>/`. Preserve only if the user explicitly asks to keep it for reference, and report the path and reason.

### Parallel Batch Pattern

For truly independent work, dispatch multiple subagents in one batch:

```python
from hermes_tools import terminal

tasks = [
    {
        "goal": "Write invitation copy for Valentina XV",
        "context": "Role: copywriter. ... (full context per template above)",
    },
    {
        "goal": "Create image prompts for Valentina XV hero and interludes",
        "context": "Role: visual director. ... (full context per template above)",
    },
]
# Max 3 concurrent children. If more than 3, split into batches.
delegate_task(tasks=tasks)
```

### Sequential Dependency Pattern

When one subagent's output feeds another, run sequentially:

```python
# Step 1: Builder creates the component
result1 = delegate_task(goal="Build the RSVP form component", context="...")

# Step 2: QA reviews the built component
result2 = delegate_task(
    goal="QA review the RSVP form component",
    context="... Previous build created these files: <files from result1>"
)
```

---

_This skill is a living document. Update it as new delegation patterns emerge or
as Hermes adds system-level tool gating for subagents._
