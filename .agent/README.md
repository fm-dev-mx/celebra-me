# Agent Compatibility Pointer

The canonical agent entry point is [`../AGENTS.md`](../AGENTS.md).

Read `../AGENTS.md` first, then use `.agent/index.md` and `.agent/load-skills.md` for the active
discovery map and skill-loading protocol.

## Canonical Repository Surface

- `.agent/rules/` contains active agent rules.
- `.agent/agents/` contains provider-neutral role documentation contracts, not executable config.
- `.agent/skills/` contains the tracked canonical skills and repeatable procedures.
- `.agent/plans/` contains active and archived operational plans (Task Contract / Goal / Handoff
  semantics in `plans/README.md`).
- `../docs/invitations/` contains invitation-specific records and operational evidence.
- `../docs/archive/reports/` contains historical reports; reports are not policy.

The root `.agents/` directory is gitignored local installation state. A runtime may copy or install
skills there for local discovery, but `.agents/` never overrides or replaces `.agent/skills/`.

External hosts may configure local discovery of `.agent/skills/` without copying those skills into
the host's global skill tree. See `.agent/load-skills.md` → External Runtime Discovery. Do not add
provider-specific entry files; `AGENTS.md` is the only project entry point.
