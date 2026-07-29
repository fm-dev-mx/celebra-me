# Graphify utility pilot — rollup verdict

**Audit date:** 2026-07-28  
**HEAD / graph:** `f71ddafa4695c3e481ad581de0077914f0416aab` (refreshed for this pilot)  
**Status:** point-in-time verdict; not product authority  
**Code changes in pilot:** none (docs + gitignored `graphify-out/` only)

## Per-experiment scores

| Experiment                               | Score                        | Why                                                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Intake ↔ publishing coupling          | **Partial (leaning Useful)** | Risk hubs correctly elevated `draft-preview-helper` / preview; corroborated P2 misplaced helper + reverse intake→invitation coupling. Truncated `topCrossBoundaryLinks` alone was misleading (editor→schema noise). |
| 02 Blast radius (`draft-preview-helper`) | **Not useful**               | `graphify query` / `path` were noisy, wrong-anchored, and produced a false path via the test file. Exact `graph.json` neighbors matched `rg` but added no unique speed/clarity over `rg`.                           |
| 03 RSVP orphan candidates                | **Partial**                  | Found one real orphan (`src/hooks/use-guest-rsvp.ts`). Degree-0 / cleanup isolation missed it; low-inbound ranking + `rg` were required.                                                                            |

## Time vs value

| Activity                     | Approx. cost                 | Value                                                      |
| ---------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `pnpm ops graphify-refresh`  | ~30s this run (full extract) | Required for freshness; baseline tax every time HEAD moves |
| Operational MD/JSON reads    | low                          | Best part of the stack for domain hubs                     |
| NL `graphify query` / `path` | medium + high noise          | Negative ROI in this pilot                                 |
| `rg` corroboration           | low                          | Necessary for every actionable claim                       |

**Net:** occasional value for **domain risk hubs** and as a lead generator when followed by `rg`.
Not valuable as a default agent ritual or as a blast-radius oracle.

## Recommendation

**Keep Graphify as an occasional local ops tool** (manual refresh + operational views for
architecture audits).

Do **not**:

- Wire it into CI / commit gates
- Treat NL query/path as authority
- Expand agent “always check graphify-out first” ritual for invitation/visual/motion tasks

Discuss later (separate task): shrink skill/agent ritual around Graphify, or drop unused NL usage
patterns if they keep burning context.

## Future authorized work (not done here)

1. Consider relocating or splitting `src/lib/invitation/draft-preview-helper.ts` so preview/intake
   glue does not live under public invitation packaging (audit 01 F1 / audit 02 F1).
2. Review intake → invitation reverse edges (`draft-content-mapper` → `family-contract`; schemas →
   `presentation-options`).
3. Delete or re-wire unused `src/hooks/use-guest-rsvp.ts` after a final consumer check.

## Related artifacts

- [graphify-pilot-01-intake-coupling-2026-07-28.md](./graphify-pilot-01-intake-coupling-2026-07-28.md)
- [graphify-pilot-02-blast-radius-2026-07-28.md](./graphify-pilot-02-blast-radius-2026-07-28.md)
- [graphify-pilot-03-orphan-candidates-2026-07-28.md](./graphify-pilot-03-orphan-candidates-2026-07-28.md)
