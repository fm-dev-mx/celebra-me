# Graphify pilot audit 03 — RSVP orphan / safe-deletion candidates

**Audit date:** 2026-07-28  
**Status:** point-in-time evidence; not architecture authority  
**Scope:** read-only usefulness test of Graphify RSVP operational + cleanup views for deletion
candidates  
**Code changes:** none (recommended deletions deferred)

## Scope and method

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| HEAD             | `f71ddafa4695c3e481ad581de0077914f0416aab`                                 |
| Graph sourceHead | same (fresh snapshot from pilot baseline)                                  |
| Primary inputs   | `graphify-out/operational/domain-rsvp.md` / `.json`, `cleanup-report.json` |
| Corroboration    | `rg` for symbol/path imports; `git log -1 --follow` for recency            |
| Filter           | Prefer `src/` over `tests/`; treat Astro/dynamic loads carefully           |

## Graphify leads

### Degree-0 / cleanup `isolatedFiles`

- Domain RSVP file list: **no degree-0 files**.
- Cleanup `isolatedFiles` filtered to RSVP-ish paths: **0 hits**.
- Pure isolation metrics alone would have produced an empty candidate list.

### Low inbound / low degree (domain view)

Ranked by `targetOrientedCount` then degree among `src/` domain files:

| File                                                | degree  | sourceOriented | targetOriented | Lead                          |
| --------------------------------------------------- | ------- | -------------- | -------------- | ----------------------------- |
| `src/components/invitation/LockedRsvpPreview.astro` | 1       | 0              | 1              | Possible orphan / thin edge   |
| `src/hooks/use-guest-rsvp.ts`                       | 5       | 4              | 1              | Low inbound; may be unused    |
| Other low-inbound dashboard/API files               | ≥15 deg | —              | 1–5            | Likely still wired; secondary |

Raw edges for `use-guest-rsvp.ts`:

- `contains` self-edge (EXTRACTED) — inflates inbound metrics
- `imports` / `imports_from` → `src/lib/client/rsvp-api.ts` only

## Corroboration

| Candidate                                           | `rg` / evidence                                                                                | `git log -1`                                                                           | Classification                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/hooks/use-guest-rsvp.ts`                       | No imports of `useGuestRsvp` / `use-guest-rsvp` anywhere outside the file (including `tests/`) | `706ced3b` 2026-03-26 — `refactor(rsvp): extract reusable invitation submission hooks` | **Confirmed orphan candidate** — zero consumers                          |
| `src/components/invitation/LockedRsvpPreview.astro` | Imported by `InvitationSections.astro` when `renderMode === 'locked'`                          | `471f24e8` 2026-07-27 — reveal/intersection work                                       | **Keep** — false orphan lead (low degree from limited edges, not unused) |
| `src/lib/calendar/download-calendar-file.ts`        | Used by `AddToCalendarButton.tsx`                                                              | —                                                                                      | **Keep**                                                                 |
| `use-floating-menu.ts` / `guest-form-constants.ts`  | Used by guest dashboard components                                                             | —                                                                                      | **Keep**                                                                 |

## Findings

| ID  | Severity | Finding                                                                                                                                  |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | P3       | `src/hooks/use-guest-rsvp.ts` appears safely deletable (or should be wired); no production or test consumers found.                      |
| F2  | meta     | Degree-0 / `isolatedFiles` missed F1 because the file still has outbound edges + a self `contains` edge.                                 |
| F3  | meta     | Sorting domain files by low `targetOrientedCount` + manual `rg` found the orphan; Graphify alone was insufficient without corroboration. |

## Recommended deletion list (later authorized task only)

1. `src/hooks/use-guest-rsvp.ts` — after a final `rg` pass and confirming no dynamic import strings.

Optional follow-up (not deletion): document why `LockedRsvpPreview` has degree 1 despite being live,
if Astro component edges are under-extracted.

## Usefulness score

**Partial.**

Success criterion (≥1 path with zero consumers after corroboration): **met**
(`use-guest-rsvp.ts`).  
However, the planned “isolated / degree-0” filter would have **failed**; the hit came from
low-inbound ranking plus `rg`. Graphify narrowed the search set usefully but did not deliver a
trustworthy deletion list by itself.

## Explicit non-goals completed

- No deletes
- No RSVP behavior changes
- No Graphify predicate updates
