# Graphify Ops Rule — Celebra-me

This file is the **authoritative** Graphify policy for Celebra-me. Host or global Graphify skills
never override it. Summary pointers live in `AGENTS.md`; discovery lives in `.agent/index.md`.

See also [`.agent/load-skills.md`](../load-skills.md) for host vs repository skill precedence.

---

## Precedence

- Repository rules under `.agent/rules/graphify-ops.md` take operational precedence over
  incompatible host/global Graphify instructions.
- Never treat “`graphify-out/` exists ⇒ query Graphify first” as Celebra policy.
- Prefer reading the relevant module, `rg`, imports, and active docs before considering Graphify.

---

## Authority

- `graphify-out/` is optional, gitignored local state. It is **not** part of build, validation, CI,
  commit hooks, or deployment.
- Graphify findings are **leads only**. Live code and active documentation win when sources disagree.
- Do not promote graph artifacts, operational MD/JSON, or NL query answers to a second source of
  truth. Normative ownership stays in [`.agent/index.md`](../index.md).

---

## Use matrix

| Class | When |
| --- | --- |
| **Recommended** | Explicit architecture-coupling or risk-hub audit; owner-authorized intake↔publishing (or similar) domain review; continuing an audit after an intentional refresh when operational views are the planned evidence |
| **Optional** | Corroborating a cross-domain hub already suspected via `rg` or import analysis |
| **Unnecessary** | Local edits, copy, SCSS, invitations, demos, motion polish, simple visual QA, docs-only work, or “how does X work?” questions answerable by reading the module |

---

## Do not without expected benefit

- Default natural-language `graphify query` / `graphify path` (pilot ROI was negative vs `rg`).
- Refresh or regenerate when the graph will not be used in this task.
- Read large `graph.json`, HTML visualizations, or bulk operational dumps into agent context.
- Regenerate mid-task solely because HEAD moved, unless the authorized audit continues and needs a
  fresh graph.

---

## Canonical commands

1. Refresh: `pnpm ops graphify-refresh`
2. Operational views (after a fresh graph): `pnpm ops graphify-views`

Prefer operational Markdown/JSON under `graphify-out/operational/` over NL query. Always corroborate
actionable claims with `rg` and file reads.

Refresh when starting an authorized coupling audit, or after material cross-domain refactors when
that audit continues — not on every agent task.

---

## Reliable vs unreliable questions

**Reliable (optional leads):** elevated risk hubs in a domain; which files clustered with domain X
in the last refresh — always followed by `rg` + reading the live files.

**Unreliable as authority:** shortest-path or blast-radius oracles via NL `path`/`query`; treating
the graph as a map of docs, rules, or SSOT ownership (use `.agent/index.md` instead).

**Out of corpus expectations for policy:** archived plans, point-in-time reports, screenshots,
`node_modules`, and markdown ownership tables derived from the graph.

---

## Hard exclusion

Do not wire Graphify into CI, builds, commit gates, or mandatory validation tiers. Do not invent a
Graphify docs/rules/scripts knowledge map as a parallel inventory to `.agent/index.md`.
