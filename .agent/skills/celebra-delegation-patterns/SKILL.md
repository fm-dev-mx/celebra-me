---
name: celebra-delegation-patterns
description: |
  Provider-neutral subagent patterns for Celebra-me: routing criteria, role handoffs, required
  context, output formats, and synthesis rules.
domain: workflow
version: 1.2.0
when_to_use:
  - Evaluating whether to use a temporary subagent for a sub-task
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

Practical patterns for provider-neutral temporary-subagent handoffs in Celebra-me. The active
runtime owns invocation syntax, model selection, concurrency, and mechanical capability controls.

## When to Use a Subagent

Use a subagent only when the task creates ONE of these benefits:

| Benefit                | Description                                                                                                                                   | Example                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Parallel speed**     | Two+ independent subtasks can run simultaneously                                                                                              | Copy + visual direction in parallel                                               |
| **Quality separation** | One agent creates, another reviews. Narrow role focus (e.g. copywriter working only on copy) is a subtype of this, not an independent reason. | Builder implements, QA verifies; copywriter focuses on copy without touching code |
| **Risk reduction**     | Independent verification before delivery                                                                                                      | QA reviews production changes before publish                                      |

## When NOT to Use a Subagent

- **Small bounded edits** — single-line fixes, typos, and focused changes the orchestrator can
  complete with less overhead than a handoff
- **Unclear tasks** — you'd need to ask clarifying questions (subagents cannot use `clarify`)
- **Insufficient context** — the subagent would need more background than the handoff can provide
- **Tightly coupled creative decisions** — visual coordination that requires seeing intermediate
  results
- **High overhead-to-value ratio** — if preparing and verifying the handoff costs as much as the
  task, do it directly

## Visual Work Zones

For reference-driven design work, parallelize only when both file ownership and design decisions are
independent.

| Safe to run in parallel                                 | Keep sequential                                                |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| Copy exploration + visual-reference research            | Two tasks editing the same preset or section variant           |
| Asset classification + read-only component audit        | Visual direction + implementation before direction is approved |
| Separate QA passes after implementation is complete     | Layout and motion changes on the same component                |
| Independent surfaces with disjoint files and acceptance | Lane A and Lane B work sharing a theme contract or resolver    |

Every parallel handoff must name its allowed files or zones. If two tasks share a route, preset,
layout contract, section variant, or file, keep them sequential. Runtime model/provider selection is
never encoded in repository handoffs.

## File-Access Hygiene

Subagents must follow strict file-access discipline to avoid slow scans, OneDrive download triggers,
and unnecessary I/O:

| Rule                            | Detail                                                                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No broad searches**           | Do NOT run repository-wide `search_files()` or `grep`/`rg` searches. Avoid patterns that could trigger OneDrive cloud-only file downloads through `rg.exe` or similar tools.                                                                                    |
| **Target explicit paths**       | Read only the files and directories directly relevant to the task. If the task doesn't specify paths, ask the orchestrator for them — do not scan to discover.                                                                                                  |
| **Avoid noise directories**     | Do NOT read or search inside: `node_modules/`, `.astro/`, `dist/`, `.vercel/`, `coverage/`, `screenshots/`, `logs/`, `public/assets/`, `src/assets/images/events/*/` (binary media folders), or any `.git/` directory — unless the task explicitly requires it. |
| **Prefer project entry points** | Start with known entry points (`AGENTS.md`, `.agent/index.md`, `src/data/`, `src/lib/`, `src/pages/`) rather than scanning from the root.                                                                                                                       |
| **No asset enumeration**        | Do not enumerate image assets, media files, or generated content unless the task is specifically about asset management.                                                                                                                                        |

## Output-Length Rules

| Rule              | Detail                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Target length** | 500–1,200 words (~3,000–7,000 characters). Stay concise.                                                                    |
| **Exception**     | Only exceed 1,200 words when the task explicitly asks for deep analysis or multi-section output.                            |
| **Structure**     | Lead with recommendations or verdict (first paragraph). Follow with evidence. End with open questions or risks.             |
| **No padding**    | Every paragraph should contain an actionable finding. Remove boilerplate, generic introductions, and restated instructions. |

## Compact-Output Guidance

For certain task types, subagents should use a compact format instead of the standard 500–1,200 word
target.

| Use compact output for         | Do NOT use compact output for |
| ------------------------------ | ----------------------------- |
| Technical checklists           | Final client-facing copy      |
| QA summaries                   | Premium visual direction      |
| Builder implementation reports | Creative strategy             |
| Diff summaries                 | High-risk recommendations     |
| Repetitive validation tasks    | Anything where nuance matters |

Compact output format:

- Verdict first (one line)
- Bullets only — no paragraphs
- No boilerplate, no restating the prompt
- Only actionable findings
- Include risks and open questions
- Target: **250–700 words** unless explicitly told otherwise

## Structured Handoffs

Use `.agent/tmp/handoffs/<task-id>/` to pass approved output between sequential delegated tasks.
This prevents context truncation and reduces `context` string bloat.

### When to use structured handoffs

| Situation                                                                 | Use handoff? |
| ------------------------------------------------------------------------- | ------------ |
| Sequential delegation (copy → builder → QA)                               | ✅ Yes       |
| Output may be truncated                                                   | ✅ Yes       |
| Subagent produces compact output but exact details are needed downstream  | ✅ Yes       |
| Orchestrator approves intermediate output before passing to next subagent | ✅ Yes       |
| Task is trivial, single delegation                                        | ❌ No        |
| Only one read-only subagent                                               | ❌ No        |
| Orchestrator can synthesize directly from the summary                     | ❌ No        |
| Handoff file overhead exceeds the task itself                             | ❌ No        |

### File patterns

```
.agent/tmp/handoffs/<task-id>/
├── approved-copy.json          # Copywriter output, approved by the orchestrator
├── design-reference-brief.md   # Task-scoped visual context when a sequential handoff needs it
├── visual-direction.md         # Visual direction, approved by the orchestrator
├── implementation-spec.md      # Spec for the builder subagent
└── qa-checklist.md             # Quality review expectations
```

Create only the files actually needed for the task. Use `.json` for structured data (copy fields,
config values), `.md` for narrative guidance.

### Do NOT store in handoffs

- Secrets, credentials, API keys
- Private client data (PII, full names beyond what's needed)
- Large assets, generated images, screenshots
- Full subagent transcripts (use runtime-managed transcript storage)
- Anything that should be version-controlled

### Cleanup

Delete `handoffs/<task-id>/` after the task is complete and verified. Only delete files under the
current task's handoff directory — never run broad delete commands. If preserving for reference,
report the path and reason to the user.

## Required Handoff Fields (Always Include)

Every subagent request must contain:

1. **Role identity** — e.g. "Act as the Celebra-me QA reviewer"
2. **Task scope** — what files, components, or areas the subagent should touch
3. **Hard constraints** — what the subagent MUST NOT do
4. **Project rules reminder** — gatekeeper, git-safety, AGENTS.md conventions
5. **Validation commands** — what to run after making changes
6. **Output format** — what the summary must include

## Subagent Request Templates

### Template: Builder (Implementation)

```text
Subagent request
Goal: Implement [specific feature/fix/component] for Celebra-me
Instructions:
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
- Select the proportional tier from `.agent/rules/gatekeeper.md`
- Use `pnpm validate:changed` when the working tree matches task scope; otherwise validate only the
  explicit task files
- Add `pnpm type-check` only when TS/Astro contracts, types, schemas, adapters, render assembly, or
  routing can change
- Do not repeat related Jest, global lint, or type-check commands already covered by the selected tier
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
```

### Template: Copywriter (Spanish Copy)

```text
Subagent request
Goal: Write invitation copy for [event type] — [event name]
Instructions:
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
```

### Template: QA (Quality Review)

```text
Subagent request
Goal: Run QA review on [page/component]: mobile-first visual check, proofreading, links
Instructions:
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
```

### Template: Visual Direction (Image Prompts)

```text
Subagent request
Goal: Create image prompts and visual direction for [event type] — [event name]
Instructions:
Role: Celebra-me visual director.

Task: <describe what visual content is needed>

Event context:
- Type: <XV / wedding / baby shower / baptism / birthday>
- Theme preset: <if known>
- Palette: <if known>
- Subjects: <honorees, family members, setting>

Constraints:
- READ-ONLY — do NOT modify code files
- Use image-generation capabilities only when the task explicitly requests them
- Do not assume a provider, model, sampler, or runtime; record applicable parameters
- Avoid: plastic skin, oversaturated colors, cartoon styles
- Preferred: warm lighting, natural skin texture, elegant composition
- Prompts should use Spanish event vocabulary for subjects

Output format:
1. Per-image: prompt (English for technical parameters, Spanish for subject context),
   negative prompt, capability requirements, and reproducibility parameters when applicable
2. Palette recommendation (hex codes)
3. Theme preset recommendation with rationale

Self-check before responding:
1. Does the direction feel premium and differentiated from generic templates?
2. Are recommendations practical for the existing Celebra-me design system?
3. Did I avoid unnecessary image generation or asset enumeration?
4. Role: did I stay within visual director role (no code or copy changes)?
5. Safety: did I avoid modifying any files?
6. Risks: did I state any uncertainty about capability availability or palette fit?
```

## Forbidden Actions for ALL Subagents

Regardless of role, subagents must NOT:

- Stage or commit files (`git add`, `git commit`, etc.)
- Run production database commands
- Modify provider configuration, `.env`, or runtime settings
- Modify project configuration files (`astro.config.mjs`, `tsconfig.json`, `package.json`) unless
  explicitly directed
- Install packages or modify dependencies without explicit instruction
- Run destructive commands (`rm -rf`, `git reset --hard`, etc.)
- Access or expose secrets (API keys, tokens, passwords)

## Orchestrator Synthesis Rules

After a subagent completes, the orchestrator MUST:

1. **Read the summary before acting** — don't auto-approve subagent work
2. **Check for truncation** — if the summary appears cut off (starts mid-sentence, ends abruptly, or
   has a "TRUNCATED" marker), do NOT assume the missing content. Either ask for a concise re-summary
   or inspect the saved output only if a reliable cache path is provided.
3. **Verify file changes** — cross-check claimed modifications with repository reads and
   `git status`. Subagent outputs are self-reported.
4. **Verify proportionally once** — subagent-reported validation is self-reported; run the selected
   Gatekeeper tier against the synthesized working tree. Do not automatically repeat global lint,
   type-check, or related Jest when the selected tier does not require it.
5. **Check for conflicts between subagents** — when merging outputs from multiple subagents,
   explicitly verify they don't contradict each other (e.g., copywriter proposed different text than
   what builder already changed, or visual director selected a different palette than what's in the
   theme).
6. **Report to user** — include subagent findings, your synthesis, any conflicts found, and
   remaining risks.
7. **Clean up handoffs** — after the task is complete, delete `.agent/tmp/handoffs/<task-id>/`.
   Preserve only if the user explicitly asks to keep it for reference, and report the path and
   reason.

### Parallel Batch Pattern

For truly independent work, dispatch multiple subagents in one batch:

```text
Parallel batch:
- Role: copywriter
  Goal: Write invitation copy for Valentina XV
  Instructions: <full request fields above>
- Role: visual director
  Goal: Create image prompts for Valentina XV hero and interludes
  Instructions: <full request fields above>

Invoke together only if the runtime supports parallel subagents and the requests are independent.
```

### Sequential Dependency Pattern

When one subagent's output feeds another, run sequentially:

```text
Step 1 — builder:
Goal: Build the RSVP form component
Output: changed paths, decisions, and validation evidence

Step 2 — QA:
Goal: Review the RSVP form component
Input: only the verified changed paths and outcomes from Step 1
```

---

_This skill is a living document. Keep it independent of provider-specific invocation APIs, models,
and configuration._
