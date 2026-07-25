# Skill Loading Protocol

This file defines how any compatible runtime loads and uses repository skills.

## Prerequisites

Before loading skills, read:

- [`AGENTS.md`](../AGENTS.md) — entry point
- `.agent/index.md` — discovery map for all skills and workflows

## Loading Protocol

1. Treat `.agent/skills/*/SKILL.md` as the tracked canonical source.
2. Load only skills relevant to the current task; never preload the full directory.
3. Follow `related_skills` only when the task needs the additional context.
4. Respect the frontmatter schema in `.agent/skills/SCHEMA.md`.
5. If the runtime requires local installation, copy or link the required skill into its supported
   local location without changing the canonical source.

## External Tool Protocols (not repo skills)

These are runtime capabilities, not tracked Celebra-me skills under `.agent/skills/`:

- **Context7 / docs MCP** — optional lookup for current third-party library docs. Integrate by thin
  references inside framework skills (`astro-patterns`, `backend-engineering`, `supabase`,
  `testing`). Never install a duplicate `.agent/skills/context7/`.
- **Impeccable.style** — do not install as a parallel design SSOT (`PRODUCT.md` / `DESIGN.md` at
  repo root are forbidden). Anti-slop and polish/critique ideas belong inside `frontend-design` and
  visual-director templates only.
- **Global Hermes (or other host) skills** — may exist outside the repository for cross-project
  tooling. They never override `.agent/skills/`. See External Runtime Discovery below.

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
- Do **not** copy global host skills into `.agent/skills/`.
- Do **not** re-host ComfyUI / multi-brand creative infrastructure inside this product repo.
- Local/host config (gitignored, e.g. Hermes `skills.external_dirs`) may point at this repo's
  `.agent/skills/` path so the host can load Celebra-me skills without forking them.
- Creative brand contracts for Celebra-me stay in `.agent/briefs/`, `.agent/templates/`, and role
  YAML under `.agent/agents/`.
