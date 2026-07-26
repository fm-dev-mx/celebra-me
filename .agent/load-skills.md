# Skill Loading Protocol

This file defines how any compatible runtime loads and uses repository skills.

## Prerequisites

Before loading a skill, read [`AGENTS.md`](../AGENTS.md) and the base rules it requires. Consult
`.agent/index.md` only when discovery is needed to identify the relevant skill or workflow.
Prerequisites already loaded in the current task must not be reread.

## Loading Protocol

1. Treat `.agent/skills/*/SKILL.md` as the tracked canonical source.
2. Load only skills relevant to the current task; never preload the full directory.
3. Treat skill `preconditions` as required state, not repeated read instructions when already
   satisfied in the current task.
4. Follow `related_skills` only when the task needs the additional context.
5. Respect the frontmatter schema in `.agent/skills/SCHEMA.md`.
6. If the runtime requires local installation, copy or link the required skill into its supported
   local location without changing the canonical source.

## External Tool Protocols (not repo skills)

These are runtime capabilities, not tracked Celebra-me skills under `.agent/skills/`:

- **Context7 / docs MCP** — optional lookup for current third-party library docs. Integrate by thin
  references inside framework skills (`astro-patterns`, `backend-engineering`, `supabase`,
  `testing`). Never install a duplicate `.agent/skills/context7/`.
- **Impeccable.style** — do not install as a parallel design SSOT (root PRODUCT/DESIGN markdown
  files are forbidden). Anti-slop and polish/critique ideas belong inside `frontend-design` and
  visual-director templates only.
- **Global Hermes (or other host) skills** — may exist outside the repository for cross-project
  tooling. They never override `.agent/skills/`. See External Runtime Discovery below. Do **not**
  dump the host catalog into this repo. Do **promote** Celebra product workflows (for example staged
  review, branch lane / release prep, stash cleanup) into `.agent/skills/` when they are part of
  this product's operating contract, then point the host at `.agent/skills` via `external_dirs`.

## Constraints

- Do not require global skills, provider-specific configuration, remote lock files, or remote
  loaders.
- `.agents/` is gitignored local installation state and is never an authority source.
- Do not treat a local or global skill with the same name as overriding `.agent/skills/`.
- Do not assume a specific provider, model, tool name, or subagent invocation API.
- If a skill contradicts the live codebase, the live codebase wins.

## External Runtime Discovery (Hermes and similar)

Provider-neutral rule: runtimes may discover this repository's skills, but the repo remains the
canonical source.

- Do **not** create `HERMES.md`, `.hermes.md`, or other provider-specific entry files. `AGENTS.md`
  is the only project entry point.
- Do **not** copy the host's global skill catalog into `.agent/skills/` as a dump or mirror.
- Do **promote** Celebra-owned workflows into `.agent/skills/` (SCHEMA-compliant, provider-neutral)
  when they belong to this product; after promotion, host copies should stub/redirect here so
  `.agent/skills/` remains the single authority.
- Do **not** re-host ComfyUI / multi-brand creative infrastructure inside this product repo.
- Local/host config (gitignored, e.g. Hermes `skills.external_dirs`) may point at this repo's
  `.agent/skills/` path so the host can load Celebra-me skills without forking them.
- Creative brand contracts for Celebra-me stay in `.agent/briefs/`, `.agent/templates/`, and role
  YAML under `.agent/agents/`.

### Host discovery verification (Hermes)

Expected host setup for this repo (configure outside git; do not commit host config):

- Include the absolute path to this checkout's `.agent/skills` directory in Hermes
  `skills.external_dirs` (example on this machine: `D:\code\celebra-me\.agent\skills`).
- Keep any cross-project creative skills (e.g. a separate `creative-ops` skills dir) in their own
  external dir; do not merge them into Celebra-me's `.agent/skills/`.
- If Celebra-me repo skills are missing from Hermes discovery, fix the host `external_dirs` entry —
  do not duplicate skills into the Hermes global tree.

### Hermes categories vs Celebra-me skills (inventory)

Hermes global categories (host-local, non-authoritative) typically include areas such as creative,
software-development, database, media, git, research, and computer-use. Those stay on the host.

Celebra-me tracked skills (canonical) cover product contracts only, for example: `astro-patterns`,
`backend-engineering`, `frontend-design`, `theme-architecture`, `supabase`, `supabase-postgres`,
`testing`, `copywriting-es`, `commit-planner`, `staged-code-review`, `staged-code-review-apply`,
`branch-lane`, `release-prepare` (deprecated stub), `git-stash-branch-cleanup`,
`client-invitation-audit`, `production-sql-patches`, `demo-content-consistency`,
`documentation-governance`, and related domain skills listed in `.agent/index.md`.

**Rule:** Hermes provides tooling discovery; `.agent/` provides Celebra-me authority. Overlap in
names never overrides `.agent/skills/`.
