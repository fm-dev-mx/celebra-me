---
title: Fix Demo-Content Leakage — Phase 1 (complete) + Phase 2 (dynamic locations)
status: implemented
created: 2026-06-11
updated: 2026-06-11
related_skills:
  - backend-engineering
related_docs:
  - docs/core/architecture.md
  - docs/core/content-schema.md
supersedes: []
---

# Fix Demo-Content Leakage in Real Invitations (Phase 1)

## 1. Problem Statement

The `cesar-ramses` bautizo invitation shows ceremony/parish data (e.g., "Parroquia de San José") in
the "Fecha y ubicaciones" editor section, even though this real invitation should not include
mass/ceremony information. Demo/template content is silently leaking into real invitation draft,
editorial, and publish flows. The risk extends to all sections: hero, family, gallery, countdown,
program, RSVP, gifts, sharing, music, and thank-you.

## 2. Confirmed Repository Findings

### 2a. No dedicated `cesar-ramses` demo JSON

- `src/content/event-demos/` has one bautizo entry: `demo-bautismo-angelic-presence.json`
- `cesar-ramses` is referenced in `branding-removal-rules.ts` as `bautizo/cesar-ramses` and has its
  own asset dir (`src/assets/images/events/cesar-ramses/`)
- If `cesar-ramses` was created with `baseDemoId: 'demo-bautismo-angelic-presence'`, then
  `loadDemoContent` is called with `previewSlug: 'demo-bautismo-angelic-presence'` — loading full
  demo content including "Parroquia de San José"

### 2b. The "Parroquia de San José" data source

File: `src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json`:

```json
"location": {
    "ceremony": { "venueName": "Parroquia de San José", ... },
    "reception": { "venueName": "Casa Jardín Santa Clara", ... }
}
```

### 2c. `hydrateEditableContent` — no `allowDemoFallback` awareness

File: `src/lib/intake/services/invitation-editor.service.ts:97-153`

For object sections (location, hero, family, etc.):

```typescript
// BASE: demo → overlay: published → overlay: draft
shallowMergeDefined(shallowMergeDefined(demoVal, publishedVal), draftVal);
```

**The function applies `draft > published > demo` to ALL invitations regardless of `kind`.**

### 2d. `mapDraftToPublished` — most fallbacks ignore `isDemo`

File: `src/lib/intake/mappers/draft-to-published.mapper.ts`

The function receives `isDemo` but only 3 of ~15 fallback paths use it. All field-level mappers
(`mapVenue`, `resolveIntroFields`, `mapMusicSection`, `mapGiftsSection`, `mapQuoteSection`,
`mapThankYouSection`, `mapHeroSection`, `buildEnvelopeFromDraft`, `mapRsvpSection`) and
whole-section `?? demoContent.X` fallbacks (lines 546-562) ignore `isDemo`.

### 2e. `saveInvitationEditorSection` uses hydrated content as baseline

File: `src/lib/intake/services/invitation-editor.service.ts:244-275`

```typescript
const context = await getInvitationEditorContext(invitationId);
const nextContent = applySectionValue(context.content, section, normalizedValue);
```

`context.content` is fully hydrated with demo values. Saving persists ALL demo-originated values for
untouched sections.

### 2f. `duplicateInvitationFromDemo` clones demo draft verbatim

File: `src/lib/intake/services/invitation.service.ts:226-233`

```typescript
const demoDraft = await findDraftByInvitationId(demo.id);
if (demoDraft) {
  await upsertDraft({ content: demoDraft.content });
}
```

### 2g. Test fixtures use `kind: 'client'` and expect demo fallback

File: `tests/unit/invitation-editor.service.test.ts`

The fixture at line 43 defines `kind: 'client'` yet tests verify demo fallback as expected behavior.

## 3. Root Cause

**Single fallback chain for all invitations:** `draft > published > demo`

Applied in both editor hydration and publish mapping. The `kind` field (`'demo' | 'client'`) exists
on the `Invitation` model but is not used to gate demo fallback.

### Contamination path for `cesar-ramses`

1. `baseDemoId: 'demo-bautismo-angelic-presence'` → `loadDemoContent` loads bautizo demo JSON
2. Editor hydration fills empty sections with demo data
3. `saveInvitationEditorSection` persists hydrated content (including demo ceremony) to draft
4. `publishDraft` calls `mapDraftToPublished(isDemo: false)` but most mappers ignore `isDemo` and
   fall back to demo ceremony data

## 4. Important: Phase 1 Scope vs Existing Contamination

**Phase 1 prevents FUTURE demo leakage.** It does not automatically clean existing data.

- If "Parroquia de San José" is already saved in `invitation_content_drafts` or
  `published_invitation_content`, it is **persisted real content**, not demo fallback.
- Phase 1 ensures new saves and publishes do not absorb demo content.
- Existing contaminated data remains until explicitly cleaned or overwritten.
- `cesar-ramses` requires a manual data audit (see section 8).

## 5. Files and Modules Involved

| File                                                                   | Lines                    | Role                                                    |
| ---------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| `src/lib/intake/services/invitation-editor.service.ts`                 | 97-153, 230-275          | `hydrateEditableContent`, `saveInvitationEditorSection` |
| `src/lib/intake/services/invitation-editor.service.ts`                 | 181-228                  | `getInvitationEditorContext`                            |
| `src/lib/intake/mappers/draft-to-published.mapper.ts`                  | 168-431, 490-571         | Field-level and whole-section fallbacks                 |
| `src/lib/intake/services/invitation.service.ts`                        | 197-236                  | `duplicateInvitationFromDemo`                           |
| `src/lib/intake/services/publishing.service.ts`                        | 322-332                  | Publishes with `isDemo: invitation.kind === 'demo'`     |
| `src/lib/intake/editor-api.ts`                                         | 30-36                    | `loadDemoContent`                                       |
| `src/lib/intake/services/draft-content-mapper.ts`                      | 211-424                  | `mapNestedToDraftContent`                               |
| `src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json` | —                        | Contains "Parroquia de San José"                        |
| `tests/unit/invitation-editor.service.test.ts`                         | 43-136, 382-423, 558-597 | Tests encoding demo fallback as expected                |
| `tests/unit/draft-to-published.mapper.test.ts`                         | —                        | Tests for publish mapper                                |

## 6. Phase 1 Implementation Steps

### Step 1 — `hydrateEditableContent`: gate demo fallback on `allowDemoFallback`

**Change:** Accept an options parameter with `allowDemoFallback`. Only populate from demo when this
flag is `true`.

```typescript
function hydrateEditableContent(
  draftContent: Record<string, unknown>,
  publishedContent: Record<string, unknown>,
  demoContent: Record<string, unknown>,
  options: { allowDemoFallback?: boolean } = {},
): { content: DraftContent; sectionStates: Record<string, SectionSource> };
```

**For object sections:** When `allowDemoFallback` is false, merge only `published → draft`. Skip
demo entirely even when no draft or published data exists. The section becomes empty.

**For scalar/array fields:** When `allowDemoFallback` is false, omit values sourced only from demo.
The field remains `undefined` (absent from result).

### Step 2 — `getInvitationEditorContext`: pass `allowDemoFallback`

```typescript
const { content, sectionStates } = hydrateEditableContent(
  draft?.content ?? {},
  published?.content ?? {},
  demoContent,
  { allowDemoFallback: invitation.kind === 'demo' },
);
```

Only demo invitations may use demo fallback. Client invitations get `allowDemoFallback: false`.

### Step 3 — `saveInvitationEditorSection`: use persisted draft as baseline

**Change:** Read the existing draft directly and apply only the changed section, instead of
re-hydrating.

```typescript
const draft = await findDraftByInvitationId(invitationId);
const currentContent = draft?.content ?? {};
const nextContent = applySectionValue(currentContent, section, normalizedValue);
```

This ensures only explicitly edited sections are saved. Demo-originated values on other sections are
never persisted.

### Step 4 — Gate all field-level mappers in `mapDraftToPublished` on `isDemo`

Pass `isDemo` through every section mapper. Skip demo fallback when `isDemo === false`:

| Function                                                      | Change                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | --- | ------------------------------------ |
| `mapVenue(draftVenue, demoVenue, isDemo)`                     | Return `undefined` (not demo) when draft is empty and `isDemo === false` |
| `resolveIntroFields(draftLocation, demoLocation, isDemo)`     | Only `                                                                   |     | demoLocation.X`when`isDemo === true` |
| `mapMusicSection(draftMusic, demoMusic, isDemo)`              | Only return demo music when `isDemo === true`                            |
| `mapGiftsSection(draftGifts, demoGifts, isDemo)`              | Only return demo gifts when `isDemo === true`                            |
| `mapQuoteSection(draftQuote, demoQuote, isDemo)`              | Only return demo quote when `isDemo === true`                            |
| `mapThankYouSection(draftThankYou, demoThankYou, isDemo)`     | Only return demo thank-you when `isDemo === true`                        |
| `mapHeroSection(draftHero, demoHero, ..., isDemo)`            | Only return full demo hero when `isDemo === true` and draft blank        |
| `buildEnvelopeFromDraft(draftEnvelope, demoEnvelope, isDemo)` | Only start from demo envelope when `isDemo === true`                     |
| `mapRsvpSection(draftRsvp, demoRsvp, isDemo)`                 | Only fall back to demo fields when `isDemo === true`                     |

### Step 5 — Gate whole-section `?? demoContent.X` fallbacks on `isDemo`

```typescript
description: str(draftContent.description) || (isDemo ? str(demoContent.description) : undefined),
sectionOrder: draftContent.sectionOrder ?? (isDemo ? demoContent.sectionOrder : undefined),
family: familySection ?? (isDemo ? demoContent.family : undefined),
location: locationSection ?? (isDemo ? demoContent.location : undefined),
gallery: draftContent.gallery ?? (isDemo ? demoContent.gallery : undefined),
itinerary: draftContent.itinerary ?? (isDemo ? demoContent.itinerary : undefined),
interludes: isDemo ? demoContent.interludes : undefined,
sectionStyles: isDemo ? demoContent.sectionStyles : undefined,
```

### Step 6 — Fix `duplicateInvitationFromDemo`: controlled seed, not full clone

The adoption flow depends on prefilled content (the user is redirected to the editor immediately
after creation and expects to see their invitation). Replace the full draft clone with a controlled
seed:

```typescript
// Seed with metadata/theme only — NOT full demo content
await upsertDraft({
  invitationId: invitation.id,
  submissionId: null,
  content: {
    title: input.title,
    description: str(demo.description) || str(input.title),
  },
});
```

This gives the user a starting point without cloning ceremony data, venue data, RSVP config, or
other section-specific content. The editor will show empty fields for all sections. The user
populates their own data.

### Step 7 — Update existing tests

**`tests/unit/invitation-editor.service.test.ts`:**

The fixture at line 43 defines `kind: 'client'`. Tests that verify demo fallback must be updated:

1. "inherits eventTiming from demo content..." → expect `undefined` for `eventTiming` (no demo
   fallback)
2. "prefers demo content when neither draft nor published have a key" → expect `undefined`/empty for
   sections missing from draft and published; states should be `'empty'`
3. "falls back to demo section copy..." → expect `undefined` for demo-originated intro fields
4. "saves only the targeted section without wiping other hydrated sections" → expect `undefined` for
   sections not in original draft
5. Existing tests for draft+published merge behavior should continue passing

Add new tests:

- `kind: 'demo'` tests that verify demo fallback still works
- Client invitation with no draft and no published content shows all sections as `'empty'`
- `saveInvitationEditorSection` with no draft baseline only saves the edited section

**`tests/unit/draft-to-published.mapper.test.ts`:**

- Update default (`isDemo: false`) tests to NOT expect demo values in output
- Add tests with `isDemo: true` to verify demo fallback still works

## 7. Validation

```bash
pnpm test tests/unit/invitation-editor.service.test.ts
pnpm test tests/unit/draft-to-published.mapper.test.ts
pnpm test tests/unit/draft-content-mapper.test.ts
pnpm tsc --noEmit
pnpm lint
pnpm build
```

## 8. Data Audit for `cesar-ramses`

### Required verifications

```sql
-- 1. Check if cesar-ramses invitation exists and its baseDemoId
SELECT id, base_demo_id, kind, slug FROM invitations WHERE slug = 'cesar-ramses';

-- 2. Check draft content for contaminated location data
SELECT id, content -> 'location' AS location FROM invitation_content_drafts
WHERE invitation_project_id IN (SELECT id FROM invitations WHERE slug = 'cesar-ramses');

-- 3. Check published content for contaminated location data
SELECT id, content -> 'location' AS location FROM published_invitation_content
WHERE slug = 'cesar-ramses' AND event_type = 'bautizo';

-- 4. Check if the draft was ever saved (could show demo contamination)
SELECT id, updated_at, status FROM invitation_content_drafts
WHERE invitation_project_id IN (SELECT id FROM invitations WHERE slug = 'cesar-ramses');
```

### If contamination exists

- Phase 1 prevents NEW leakage but does not clean persisted data.
- If the location section in `invitation_content_drafts` contains demo ceremony data and the user
  never intended it:
  - **Draft:** The user can clear the fields and re-save, or a migration script can strip `location`
    from the draft JSONB.
  - **Published:** Re-publishing after Phase 1 produces clean output. If immediate cleanup is
    needed, a migration can strip `location` from `published_invitation_content`.
- **Do not run production SQL without explicit authorization.**

### Regression discovered: `cesar-ramses` gallery was real content, not demo

**Context:** The cleanup incorrectly removed `content.gallery` from both draft and published content
for `cesar-ramses`. The gallery was real content — 6 items with unique captions and focal points
that differ from `demo-bautismo-angelic-presence`.

**Fix applied locally:** `scripts/sql/restore-gallery-cesar-ramses.sql` restores the gallery in BOTH
`invitation_content_drafts` and `published_invitation_content` using a transaction.

**Lesson:** The `gallery` section is not always demo-originated. Cleanup logic must verify content
origin — check captions, focal points, and item count — before deleting. Production cleanup MUST NOT
delete `gallery` for `cesar-ramses`. If production already lacks gallery data, apply the same
restore SQL (after review).

## 9. Risks and Trade-offs

| Risk                                                                                                     | Impact                                   | Mitigation                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Existing contaminated draft/published data is NOT cleaned by Phase 1                                     | Medium                                   | Explicitly documented; requires separate audit/cleanup                                                                         |
| Users opening existing drafts where location was filled by demo may see empty fields after hydration fix | High (if demo data was the only content) | This is correct — data that was never user-entered should not display as real. The editor shows "Sin datos" for empty sections |
| Save no longer persists untouched sections; user must explicitly enter each section                      | Medium                                   | Controlled seed for duplication provides minimal starting content. New creation flow starts empty                              |
| Adoption flow redirects user to editor with only title/description seeded                                | Medium                                   | Acceptable trade-off; user chose to duplicate and must now customize                                                           |
| Tests encode the buggy behavior; updating them is sensitive                                              | Medium                                   | Do not delete tests — change expectations to reflect correct behavior. Add `kind: 'demo'` variants                             |
| Existing published content with demo fallback will still be served until re-published                    | Low                                      | Re-publish after Phase 1 generates clean output                                                                                |

## 10. Open Questions

1. **Is `cesar-ramses` a `bautizo` without ceremony?** The branding-removal-rules file lists it as
   `bautizo/cesar-ramses`. If it is a baptism invitation that should not include a church ceremony,
   the current demo preset (`demo-bautismo-angelic-presence`) is inappropriate for it. A dedicated
   preset without ceremony data may be needed.

2. **Should `createInvitation` also seed a minimal draft?** Currently `createInvitation` creates
   only the invitation record (no draft). The editor loads via
   `hydrateEditableContent(draft={}, published={}, demoContent)`. After the fix with
   `allowDemoFallback: false`, the editor shows all empty sections. This is a significant UX change
   — the user chose a demo theme but sees blank content. Consider seeding a minimal draft (title
   only) in a follow-up.

3. **Does the preview renderer (`draft-preview-helper.ts`) also need the `isDemo` gate?** The
   preview calls `mapDraftToPublished({ isDemo: false })` and uses `demoContent` for asset
   resolution. The preview is an internal tool; showing demo content there is less critical. The
   `isDemo` gate in `mapDraftToPublished` will handle this automatically.

4. **What about `interludes` and `sectionStyles` from demo?** These are currently sourced entirely
   from `demoContent`. For client invitations, `interludes` and `sectionStyles` should be
   `undefined` (omitted from published output) unless the draft explicitly defines them. The
   whole-section gating in Step 5 handles this.

## 11. Follow-Up: Client Seed Strategy (Not in Phase 1 Scope)

Phase 1 introduces a UX regression: new client invitations now start with blank editors after the
user selects a demo theme. This is acceptable for data correctness but needs a follow-up task:

**Options for future implementation:**

1. **Safe client seed:** Seed `createInvitation` with a minimal draft containing title only (same
   approach as the duplication fix).
2. **Non-persistent placeholders:** Show demo content in the editor UI as grey/italic placeholder
   text without ever saving it to the draft.
3. **Explicit intent flow:** Add a prompt like "¿Quieres usar el contenido del demo como punto de
   partida?" when the editor first opens, giving the user explicit choice.

**This is NOT blocking Phase 1 merge.** The current behavior is correct: only user-authored data
persists. The blank-start UX is documented as an acceptable trade-off.
