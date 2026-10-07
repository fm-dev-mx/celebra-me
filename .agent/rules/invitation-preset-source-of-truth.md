# Invitation Preset Source of Truth

This rule defines where an invitation's theme comes from. Every invitation is self-sufficient: its
theme, structure, and assets come from its own records, never from a demo or a catalog entry.

## Canonical Fields

| Field                                               | Role                       | Authority                                                                                 |
| --------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| `invitations.theme_id`                              | **Canonical active theme** | Authoritative for publish and preview. Must be a valid `ThemePreset`.                     |
| `published_invitation_content.content.theme.preset` | Baked artifact             | Written from `theme_id` at publish time.                                                  |
| `invitations.base_demo_id`, `invitations.snapshot`  | Legacy columns             | Not read by publish, preview, or the editor. Scheduled for removal; do not add new reads. |

## Resolution

`resolveInvitationTheme()` in `src/lib/intake/services/invitation-preset-resolver.ts` returns
`invitations.theme_id` when it is a valid `ThemePreset` and `null` otherwise. There is no fallback.

## Publish and Preview Blocking

- `publishDraft()` and the publication preflight reject an invitation whose `theme_id` is not a
  valid `ThemePreset` (`422 config_error`).
- The dashboard preview shows an error for the same condition instead of guessing a theme.

To fix an invalid `theme_id`, correct the DB field through a reviewed, guarded workflow
(`.agent/rules/database.md`). Do not add automatic correction or a default theme.

## Key Files

| File                                                    | Role                                 |
| ------------------------------------------------------- | ------------------------------------ |
| `src/lib/intake/services/invitation-preset-resolver.ts` | Resolver: `resolveInvitationTheme()` |
| `src/pages/dashboard/invitaciones/[id]/preview.astro`   | Preview route — uses resolver        |
| `src/lib/intake/services/publishing.service.ts`         | Publish — uses resolver              |
