---
title: Ayrin Samantha XV Invitation Plan
status: implemented
created: unknown
updated: 2026-05-31
---

# Ayrin Samantha XV Invitation Plan

## Summary

Create a real internal invitation project for "XV Años de Ayrin Samantha Lerma Castro" using the
existing intake system, based on the demo-xv-enchanted-rose template. The project should be visible
in the dashboard, have a working capture URL, pre-filled intake data, and an editable draft —
without publishing or introducing photo upload.

## Technical Scope

- No files modified in src/, only a creation script added under scripts/dev/.
- Uses direct Supabase REST API calls (service role key) to insert records into existing tables.
- Creates 4 database records: invitation_projects, intake_requests, intake_submissions,
  invitation_content_drafts.
- Pre-fills all 8 intake blocks with provided client data.
- Creates a mapped draft content record matching the DraftContent schema.
- Project stays in waiting_for_client status; nothing is published.

## Records to Create

| Table                     | Status             | Key fields                                                                                               |
| ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| invitation_projects       | waiting_for_client | title: \"XV Años de Ayrin Samantha\", base_demo_id: demo-xv-enchanted-rose, client_name: Samantha Castro |
| intake_requests           | ctive              | enabled_blocks: all 8 blocks, 30-day expiry, SHA-256 hashed token                                        |
| intake_submissions        | in_progress        | pre-filled block_data with ceremony, reception, family, gifts, messages, etc.                            |
| invitation_content_drafts | draft              | mapped DraftContent with hero, family, location, rsvp, music, gifts, quote, thankYou, photoNotes         |

## Data Sources

- Client/project metadata, main people, ceremony, reception, gifts/dress code, custom texts, and
  photo notes all from extracted source data provided in the task.
- Apple Music URL used for music block (schema requires valid URL for musicBlockSchema.url).

## Constraints

- No photo upload. No file storage. No image records.
- No automatic publishing. No published_invitation_content created.
- No modifications to existing source code or public routes.
- Only the creation script is new; it is placed under scripts/dev/.

## Files Changed

| File                                    | Action                       |
| --------------------------------------- | ---------------------------- |
| scripts/dev/create-ayrin-invitation.mjs | **CREATE** — creation script |

## Verification

Run after executing the script:

`ash pnpm type-check pnpm lint pnpm test pnpm build `

Any failure must be reported with the exact error and whether it's pre-existing or caused by this
work.

## Expected URLs (local)

| Page             | URL                                                      |
| ---------------- | -------------------------------------------------------- |
| Dashboard list   | http://localhost:4321/dashboard/invitaciones             |
| Dashboard detail | http://localhost:4321/dashboard/invitaciones/{id}        |
| Review page      | http://localhost:4321/dashboard/invitaciones/{id}/review |
| Draft page       | http://localhost:4321/dashboard/invitaciones/{id}/draft  |
| Capture form     | http://localhost:4321/captura/{token}                    |
