# Invitation Preset Source of Truth

This rule defines the canonical hierarchy for theme/preset resolution and the invariants that
prevent drift between redundant theme fields.

## Canonical Fields

| Field                                               | Role                          | Authority                                                                                                 |
| --------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `invitations.theme_id`                              | **Canonical active theme**    | Authoritative at runtime. Must be a valid `ThemePreset`.                                                  |
| `invitations.base_demo_id`                          | Originating preset identifier | Points to the `DEMO_PRESET_CATALOG` entry used at creation time.                                          |
| `invitations.snapshot`                              | Frozen archival metadata      | MUST NOT override `theme_id` for runtime decisions. May be stale; the resolver always prefers `theme_id`. |
| `published_invitation_content.content.theme.preset` | Baked artifact                | Frozen at last publish time. May be stale until the next publish.                                         |
| `DEMO_PRESET_CATALOG`                               | Code-level preset definitions | Source of truth for which `themeId` a given `baseDemoId` maps to.                                         |

## Resolution Order (active theme)

All runtime theme resolution uses `resolveInvitationTheme()` from
`src/lib/intake/services/invitation-preset-resolver.ts`:

1. Use `invitations.theme_id` if it is a valid `ThemePreset`.
2. If `theme_id` is invalid, fall back to `DEMO_PRESET_CATALOG[baseDemoId].themeId`.
3. If neither works, fall back to `THEME_PRESETS[0]` (safe default).

## Required Invariants

- `invitations.theme_id` MUST be a valid `ThemePreset`.
- `invitations.snapshot.themeId` SHOULD match `theme_id`.
- `DEMO_PRESET_CATALOG[baseDemoId].themeId` SHOULD match `theme_id`.
- `published_invitation_content[].content.theme.preset` SHOULD match `theme_id` at publish time.

## Publish Blocking

`publishDraft()` calls `checkPublishGuard()` before proceeding. Publishing is blocked if:

- `theme_id` is not a valid `ThemePreset`.
- `theme_id` does not match the catalog entry's `themeId` for `baseDemoId`.

Snapshot mismatch (snapshot.themeId != theme_id) emits a warning but does NOT block publish — the
resolver uses `theme_id` for the published content.

## Duplication Behavior

`duplicateInvitationFromDemo()` no longer copies the source invitation's snapshot. Instead, it
rebuilds the snapshot from the current `DEMO_PRESET_CATALOG` using `findDemoPreset()` and a shallow
copy. This prevents stale/corrupt snapshots from propagating to new invitations.

## Drift Detection

Run `scripts/sql/audit-theme-preset-drift.sql` (read-only) in any environment to detect invitations
with mismatched theme/preset fields. The query reports:

- `MISSING_SNAPSHOT` — snapshot column is null
- `EMPTY_THEME_ID` — theme_id is empty
- `INVALID_THEME_ID` — theme_id is not a valid ThemePreset
- `SNAPSHOT_THEME_MISMATCH` — snapshot.themeId != theme_id
- `SNAPSHOT_ID_MISMATCH` — snapshot.id != base_demo_id
- `CATALOG_THEME_MISMATCH` — theme_id != catalog.themeId for the baseDemoId
- `UNKNOWN_BASE_DEMO` — base_demo_id not found in DEMO_PRESET_CATALOG

## Debugging Protocol for Theme/Preset Drift

1. Run `scripts/sql/audit-theme-preset-drift.sql` in the affected environment to identify drifted
   rows.
2. For each drifted row, determine the intended correct `theme_id`:
   - Client invitations: the theme the client/admin selected.
   - Demo invitations: the catalog entry's `themeId` for the `baseDemoId`.
3. If only `snapshot.themeId` is wrong: no emergency action; the resolver already ignores it.
4. If `theme_id` itself is wrong: manually correct the DB field with a reviewed, guarded SQL
   statement. Do not use automatic correction.
5. If publishing is blocked by the guard: resolve the inconsistency first, then retry.

## Key Files

| File                                                    | Role                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/intake/services/invitation-preset-resolver.ts` | Resolver: `resolveInvitationTheme()`, `checkPublishGuard()`            |
| `src/pages/dashboard/invitaciones/[id]/preview.astro`   | Preview route — uses resolver                                          |
| `src/lib/intake/services/publishing.service.ts`         | Publish — uses resolver + guard                                        |
| `src/lib/intake/services/invitation.service.ts`         | Duplication — uses `findDemoPreset()` to rebuild snapshot from catalog |
| `scripts/sql/audit-theme-preset-drift.sql`              | Read-only drift detection query                                        |
