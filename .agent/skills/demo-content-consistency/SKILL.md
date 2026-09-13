---
name: demo-content-consistency
description: |
  Keep demo/preview invitation content internally consistent when transforming dates or other
  display fields. Apply transforms at the data/adapter layer, never via client JS overrides.
domain: content
version: 1.0.0
when_to_use:
  - Demo dates disagree across hero, countdown, envelope, or itinerary
  - Fixing flicker or Math.random demo date hacks in client scripts
  - Adding or reviewing demo-only data transforms
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills:
  - client-invitation-audit
  - astro-patterns
  - testing
related_docs:
  - docs/domains/content/collections.md
  - docs/domains/content/event-governance.md
---

# Demo Content Consistency

**Cardinal rule:** transform demo data at the adapter/data layer before any section reads it. Do not
patch UI (client JS / CSS hacks) for values that SSR already owns.

```
Wrong: JSON → Adapter → SSR → Client JS override
Right: JSON → Adapter (shift) → SSR (all shifted) → Client JS (tick only)
```

## Symptoms of UI-layer patching

- Flicker (original value before JS)
- Different dates in hero vs countdown within one demo
- Values change on refresh (`Math.random`)

## Current date contract

`adaptEvent` in `src/lib/adapters/event.ts` uses configured content dates; countdown target
resolution belongs to `src/lib/time/event-time.ts`. There is no automatic per-slug date-shift
helper. Preserve configured dates unless a date change is explicitly requested. If a demo-only
transform is required, derive all affected fields consistently on the server from deterministic
inputs and leave real invitations unchanged. Do not introduce client `isDemo` date overrides in
`CountdownTimer` or siblings.

## Fields to cover

When shifting dates, update every date-carrying field the UI shows for that item, typically:

| Area               | Fields                                          |
| ------------------ | ----------------------------------------------- |
| Hero / envelope    | `hero.date`                                     |
| Countdown          | `eventTiming.startsAtUtc` / derived `targetIso` |
| Itinerary / venues | venue / ceremony / reception dates              |

## Verification

- [ ] All date-visible sections agree within one demo
- [ ] Configured dates are preserved unless the requested change explicitly transforms them
- [ ] Refresh is stable (no randomness)
- [ ] Real invitations unchanged
- [ ] No client `isDemo` date override; no flicker

## Hard constraints

- Do not “fix” consistency only in countdown client JS.
- Preserve Astro server/client boundaries.
- Pair behavior changes with tests when the transform lives in shared adapters.
