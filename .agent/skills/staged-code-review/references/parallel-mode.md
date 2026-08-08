# Staged Code Review — Parallel Mode

Load only when the staged diff exceeds the sequential thresholds in `SKILL.md`. Prefer sequential
otherwise. Follow [`celebra-delegation-patterns`](../../celebra-delegation-patterns/SKILL.md) when
the runtime supports subagents; otherwise analyze sequential per-file. Do not assume provider-specific
delegation APIs.

## Thresholds

| Condition               | Mode                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| ≤20 files AND ≤25K diff | Sequential (one agent) — do not use this reference                               |
| >20 files OR >25K diff  | Parallel groups if the runtime supports subagents; otherwise sequential per-file |

## Independent groups (same wave when parallel)

| Group                             | File types                                                         | Focus                                                                                |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| A — Components, styles, templates | `.astro`, `.tsx`, `.jsx`, `.scss`, `.css`, layouts, theme partials | Prop surface, SSR/CSR consistency, import hygiene, selector vs template, token drift |
| B — Scripts, utilities, tests     | tooling `.ts`/`.js`, configs, `*.test.ts`, `*.spec.ts`             | Over-engineering, brittle tests, hardcoded paths, redundant abstractions             |
| C — Content data                  | content JSON, YAML/TOML config                                     | Duplicate keys, dead fields, format inconsistencies                                  |

Keep co-dependent pairs (e.g. a component and its SCSS) in the same agent when practical so
CSS↔template cross-checks stay intact.

## After groups finish

- Dedupe findings across groups.
- Re-prioritize globally; assign apply-tags consistently.
- Cross-check content fields against adapters/viewmodels when group C ran.
- Run **cleanup uplift** (material dead export/import/type or orphan file → HIGH `Clase: cleanup`).
- **Tag honesty (mandatory before final report):** downgrade any `auto-safe` that fails the
  allowlist / deny list in `SKILL.md` (API surface, spy lifecycle, non-staged neighbors, etc.).
- If ≥10 findings, a dedupe / false-positive pass is **mandatory** (includes tag honesty above).
- Recompute `~N` from cleanup-class HIGH+MEDIUM only after honesty.
