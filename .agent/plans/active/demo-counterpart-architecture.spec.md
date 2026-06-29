---
title: Demo Counterpart Architecture
status: active
created: 2026-06-29
updated: 2026-06-29
type: implementation
autonomy: Level 2
related_skills:
  - backend-engineering
  - theme-architecture
  - seo-metadata
related_docs:
  - docs/core/architecture.md
  - docs/core/content-schema.md
  - .agent/rules/invitation-production.md
  - .agent/rules/intake-publishing.md
  - docs/domains/tracking/commercial-attribution.md
supersedes: []
superseded_by: []
---

# Demo Counterpart Architecture

## Hardening Review (2026-06-29)

### Correction: templateId semantics

`templateId` is a **stable reusable visual template SKU**, not a foreign key to a real invitation.
Convention: `{eventType}-{themePreset}`.

### Catalog Coverage Pass Results

Completed:

- All 11 demo JSONs migrated with `templateId` (template SKU)
- All 11 demo JSONs migrated with explicit `_assetSlug`
- Strict audit test enforces all invariants (68 tests, all passing)
- Reporting script generates coverage matrix
- Two local real invitation payloads updated with `templateId`
- `demo-xv-editorial-magazine` uses `_assetSlug: "demo-xv-editorial"` as documented temporary
  fallback (no dedicated media directory for magazine)

### Remaining gaps

- 6 real invitations need DB content inspection to determine theme (no local payload file available)
- `xv-valentina-hernandez` and `xv-xareni-iyarit` have slug-specific SCSS — demos using same
  `theme.preset` are NOT visually identical without the same overrides
- `demo-xv-editorial-magazine` temporarily shares media with `demo-xv-editorial` (documented
  fallback, needs dedicated media)
- Real invitation DB rows need `templateId` added at next publish/update

---

## Objective

Prepare the Celebra-me system so that every real client invitation can have a matching demo
counterpart that is visually identical but uses separate demo data and demo media.

## Current State Summary

### Content model

- `templateId`: optional string, template SKU (`{eventType}-{themePreset}`)
- `isDemo`: boolean, distinguishes real from demo
- `_assetSlug`: explicit asset directory key for media separation
- `theme.preset`: drives visual identity

### Demo migration status

All 11 demo JSONs now carry `templateId` and `_assetSlug`:

| Demo                              | templateId                        | \_assetSlug                       |
| --------------------------------- | --------------------------------- | --------------------------------- |
| demo-baby-shower-celestial        | baby-shower-celestial-blue        | demo-baby-shower-celestial        |
| demo-bautismo-angelic-presence    | bautizo-angelic-presence          | demo-bautismo-angelic-presence    |
| demo-boda-jewelry-box-wedding     | boda-jewelry-box-wedding          | demo-boda-jewelry-box-wedding     |
| demo-cumple-luxury-hacienda       | cumple-luxury-hacienda            | demo-cumple-luxury-hacienda       |
| demo-primera-comunion-illustrated | primera-comunion-angelic-presence | demo-primera-comunion-illustrated |
| demo-xv-celestial-blue            | xv-celestial-blue                 | demo-xv-celestial-blue            |
| demo-xv-editorial                 | xv-editorial                      | demo-xv-editorial                 |
| demo-xv-editorial-magazine        | xv-editorial-magazine             | demo-xv-editorial (⚠️ fallback)   |
| demo-xv-editorial-rose            | xv-editorial-rose                 | demo-xv-editorial-rose            |
| demo-xv-enchanted-rose            | xv-enchanted-rose                 | demo-xv-enchanted-rose            |
| demo-xv-jewelry-box               | xv-jewelry-box                    | demo-xv-jewelry-box               |

### Real invitation payload updates

| Payload                                | templateId added      |
| -------------------------------------- | --------------------- |
| xv-xareni-iyarit-db-payload.json       | xv-celestial-blue     |
| xv-valentina-hernandez-db-payload.json | xv-editorial-magazine |

### RSVP/tracking safety

Confirmed intact. Demos remain fully isolated at every layer.

## Coverage Matrix

| Real Invitation                  | Event Type        | Theme Preset       | templateId            | Demo Exists                   | Payload Local | Visual Parity  | Action Needed                        |
| -------------------------------- | ----------------- | ------------------ | --------------------- | ----------------------------- | ------------- | -------------- | ------------------------------------ |
| xv-xareni-iyarit                 | xv                | celestial-blue     | xv-celestial-blue     | ✅ demo-xv-celestial-blue     | ✅ updated    | ⚠️ custom SCSS | Add templateId to DB at next publish |
| xv-valentina-hernandez           | xv                | editorial-magazine | xv-editorial-magazine | ✅ demo-xv-editorial-magazine | ✅ updated    | ⚠️ custom SCSS | Add templateId to DB at next publish |
| ana-sofia-cota-guillen           | ?                 | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |
| cesar-ramses                     | ?                 | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |
| gerardo-sesenta                  | ?                 | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |
| leah-lexa-baby-shower            | baby-shower?      | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |
| luna-y-estrella-primera-comunion | primera-comunion? | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |
| ximena-meza-trasvina             | ?                 | ?                  | ?                     | ❌                            | ❌            | ?              | Inspect DB content                   |

## Audit and Reporting

### Strict audit test: `tests/content/demo-counterpart-audit.test.ts`

68 tests enforcing:

- every demo has `isDemo: true`
- every demo has `templateId`
- every demo has `_assetSlug`
- `templateId` equals `{eventType}-{theme.preset}`
- `_assetSlug` is not a real invitation directory
- `_assetSlug` directory exists
- no duplicate `templateId` with incompatible theme presets
- no `_assetSlug` leaks to real invitation directories

Run: `npx jest tests/content/demo-counterpart-audit.test.ts`

### Coverage reporting script: `scripts/audit/demo-coverage-report.ts`

Generates human-readable matrix. Run: `npx tsx scripts/audit/demo-coverage-report.ts`

## Architectural Findings

### Content resolution flow

```
[eventType]/[slug].astro
  → resolveInvitationContent(slug, eventType)
    → DB lookup (published_invitation_content, isDemo !== true)
    → Invitation slug lookup (invitations table)
    → Static fallback (event-demos or events collections, isDemo === true required)
```

### Visual identity flow

`theme.preset` → CSS class `.theme-preset--{name}` → component variant branches

### Asset resolution flow

`data._assetSlug` → `getEventAsset(eventSlug, key)` → `EVENT_REGISTRY[slug][key]`

## RSVP / Tracking / Lead Safety

- Public RSVP: explicit `isDemo` check returns 404
- Route personalization: `routeIsDemo → allowGuestContext: false`
- Engagement tracking: requires `inviteId` (guest context) — demos have none
- Commercial attribution: explicitly excludes demo routes
- No changes made to any of these guards

## SEO / Open Graph / WhatsApp

- Each demo has its own `sharing` block with safe demo data
- OG images resolve from the demo's asset directory (not real invitation)
- WhatsApp templates use generic demo copy
- No `noindex` directive currently — user decision needed

## Implementation Phases

### Phase 1 (completed)

1. Schema addition: `templateId` field in `shared.schema.ts`
2. First demo migration: `demo-xv-celestial-blue` linked to `xv-celestial-blue`
3. Initial audit test created

### Phase 2 — Catalog Coverage (completed this pass)

1. All 10 remaining demos migrated with `templateId` and `_assetSlug`
2. Strict audit test updated (68 passing tests)
3. Coverage reporting script (`scripts/audit/demo-coverage-report.ts`)
4. Real payloads updated with `templateId`
5. Visual parity risks documented
6. Coverage matrix produced

### Phase 3 (Future)

- Add `templateId` to production DB content for published real invitations
- Create dedicated demo counterparts for real invitations with custom SCSS
- Create dedicated asset directories for `demo-xv-editorial-magazine`
- Replace temporary demo media with AI-generated assets
- Decide on `noindex` policy for demo pages
- Add demo-specific SEO metadata for each template

## Acceptance Criteria

1. ✅ `templateId` field exists in schema as template SKU
2. ✅ All 11 demos have correct `templateId = {eventType}-{themePreset}`
3. ✅ All 11 demos have explicit `_assetSlug`
4. ✅ Local real payloads have `templateId` (xareni + valentina)
5. ✅ Build passes
6. ✅ RSVP/tracking safety intact
7. ✅ No duplicated images, SCSS, or components
8. ✅ Strict audit test passes (68/68)
9. ✅ Coverage reporting script produces matrix

## Rollback Notes

Revert all changed files:

- `src/lib/schemas/content/shared.schema.ts` — remove `templateId`
- All 11 demo JSONs — remove `templateId` and `_assetSlug`
- `tests/content/demo-counterpart-audit.test.ts` — delete
- `scripts/audit/demo-coverage-report.ts` — delete
- `.agent/plans/active/*-db-payload.json` — remove `templateId`

## Manual DB Content Update Instructions

For each real invitation published in production `published_invitation_content`, add `templateId` to
the JSON content blob:

```sql
-- Example: update published_invitation_content.content -> 'templateId'
-- for xv-xareni-iyarit
UPDATE published_invitation_content
SET content = content || '{"templateId": "xv-celestial-blue"}'::jsonb
WHERE event_type = 'xv' AND slug = 'xv-xareni-iyarit'
  AND content->>'templateId' IS NULL;
```

Repeat for each real invitation. The `templateId` value must match `{eventType}-{themePreset}` from
the published content's `theme.preset`.

## Risks and Mitigations

| Risk                                                     | Likelihood                         | Mitigation |
| -------------------------------------------------------- | ---------------------------------- | ---------- |
| Schema addition doesn't affect existing content          | None — optional field              |
| Demo \_assetSlug mismatch                                | Low — strict audit test catches it |
| Visual parity for customized invites                     | Medium — documented as known risk  |
| templateId mismatch in production DB                     | Low — manual SQL patch needed      |
| audit test can't validate theme for unknown real invites | Known — needs DB inspection        |

## Manual Review Checklist

- [ ] Confirm all demo data is commercially acceptable
- [ ] Decide whether demo pages should be `noindex`
- [ ] Decide whether RSVP should be active/disabled/simulated for demo routes
- [ ] Replace `demo-xv-editorial-magazine` temporary media fallback with dedicated assets
- [ ] Add `templateId` to production DB content for published real invitations
- [ ] Create dedicated demo counterparts for highly customized invitations
- [ ] Replace temporary demo photos with AI-generated assets
- [ ] Verify Vercel production build after merge
