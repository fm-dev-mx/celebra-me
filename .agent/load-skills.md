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
  files are forbidden; no CI `impeccable detect` gate). Selective anti-slop absorption (registers,
  structural bans, Adapt rules for cream/glass, intervention loop) lives in `frontend-design` and
  visual-director templates only. Temporary installs for audit must be uninstalled before merge.
- **Host/global skills** — may exist outside the repository for cross-project tooling. They never
  override `.agent/skills/`. See External Runtime Discovery below. Do **not** dump a host catalog
  into this repo. Do **promote** Celebra product workflows (for example staged review, branch lane /
  release prep, stash cleanup) into `.agent/skills/` when they are part of this product's operating
  contract, then point the host at `.agent/skills` via its discovery mechanism. For Graphify
  specifically, `.agent/rules/graphify-ops.md` overrides incompatible host “query first”
  instructions; operators may also disable a global Graphify skill for this repo when the host
  supports it.

## Constraints

- Do not require global skills, provider-specific configuration, remote lock files, or remote
  loaders.
- `.agents/` is gitignored local installation state and is never an authority source.
- Do not treat a local or global skill with the same name as overriding `.agent/skills/`.
- Do not assume a specific provider, model, tool name, or subagent invocation API.
- If a skill contradicts the live codebase, the live codebase wins.

## External Runtime Discovery

Provider-neutral rule: runtimes may discover this repository's skills, but the repo remains the
canonical source.

- Do **not** create provider-specific entry files (for example host-named `*.md` at the repo root).
  `AGENTS.md` is the only project entry point.
- Do **not** copy a host's global skill catalog into `.agent/skills/` as a dump or mirror.
- Do **promote** Celebra-owned workflows into `.agent/skills/` (SCHEMA-compliant, provider-neutral)
  when they belong to this product; after promotion, host copies should stub/redirect here so
  `.agent/skills/` remains the single authority.
- Do **not** re-host multi-brand creative infrastructure inside this product repo.
- Local/host config (gitignored) may point at this repo's `.agent/skills/` path so the host can load
  Celebra-me skills without forking them (for example an `external_dirs`-style discovery list).
- Creative brand contracts for Celebra-me stay in `.agent/briefs/`, `.agent/templates/`, and role
  YAML under `.agent/agents/`.

### Host discovery verification

Expected host setup for this repo (configure outside git; do not commit host config):

- Include the repository-relative path `.agent/skills` (as an absolute path from the checkout) in
  the host's external skill discovery list.
- Keep any cross-project creative skills in their own external dir; do not merge them into
  Celebra-me's `.agent/skills/`.
- If Celebra-me repo skills are missing from host discovery, fix the host discovery entry — do not
  duplicate skills into the host's global tree.

Concrete Codex / Cursor / other host setup steps are non-authoritative operator guidance under
`.agent/external/provider-integration.md`. They never override this protocol or `AGENTS.md`.

### Host catalogs vs Celebra-me skills

Host global categories (tooling discovery, non-authoritative) stay on the host.

Celebra-me tracked skills (canonical) cover product contracts only — see `.agent/index.md` and
`.agent/skills/`. Deprecated stubs (for example former `release-prepare`, absorbed into
`branch-lane`) must not be reintroduced as parallel skills.

**Rule:** Hosts provide tooling discovery; `.agent/` provides Celebra-me authority. Overlap in names
never overrides `.agent/skills/`.
