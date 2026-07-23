# Managed Invitation Lifecycle Workflow — Celebra-me

This document is the authoritative, versioned workflow for any repository agent creating, testing, previewing, approving, publishing, and updating managed digital invitations across Local, Preview, and Production targets.

---

## 17-Step Canonical Lifecycle Workflow

1. **Repository & Environment Preflight**: Verify branch, working tree state, and target environment credentials (Local: `127.0.0.1:54322`, Preview: `iwipdvisoyerfdytuhwi`, Production: cloud host).
2. **Requirement Intake**: Gather client facts (names, date, event type, theme, photos, registry, venues). Do not infer missing client facts.
3. **Identity & Owner Resolution**: Determine invitation slug, event type, and target owner (`created_by` UUID). Require explicit `--owner-user-id` for new hosted invitations.
4. **Theme, Profile & Section Selection**: Select theme preset (`enchanted-rose`, `editorial-magazine`, etc.), visual profile, and included/omitted sections.
5. **Content & Asset Preparation**: Place source images in asset directory. Run MIME detection (`detectFileMimeType`) and Sharp optimization.
6. **Local Validation & Immutable Plan Creation**: Build normalized release (`buildNormalizedInvitationRelease`) and validate against canonical `eventContentSchema`. Generate `OperationalPlan`.
7. **Local Apply**: Run `pnpm invitation:update --slug <slug> --targets local --apply`. Verify atomic database and storage writes.
8. **Local Visual & Functional Verification**: Test public route `/<eventType>/<slug>` locally. Verify hero, section rendering, accessibility, and responsiveness.
9. **Preview Package & Plan**: Export release package (`pnpm invitation:update --slug <slug> --targets preview --dry-run`).
10. **Preview Apply & Verification**: Apply release to Preview target (`pnpm invitation:update --slug <slug> --targets preview --apply`).
11. **Human Preview Approval**: Operator inspects Preview deployment and generates signed Preview approval artifact in `.agent/tmp/approvals/`.
12. **Production Preflight**: Verify Preview approval artifact validity, package hash matching, and Production target credentials.
13. **Explicit Production Authorization**: Require explicit human confirmation (`requireProductionConfirmation`) with hostname and package hash.
14. **Production Execution**: Promote approved package to Production target using `runImportEngine`.
15. **Public Verification**: Verify production public URL rendering and post-publication database state.
16. **Recovery or Roll-Forward**: If any failure occurs, record execution status (`CAMBIOS APLICADOS`, `ERROR — CAMBIOS REVERTIDOS`, `ERROR — REQUIERE REVISIÓN`) and execute compensating restoration if needed.
17. **Subsequent Managed Updates**: For updates, re-run from Step 6 using the immutable semantic plan with drift protection.

---

## Mandatory Agent Rules

* **No Unasked Commits**: Do not stage or commit files unless explicitly instructed by the user.
* **No Unapproved Production Mutation**: Production mutation requires explicit human authorization.
* **Fail-Closed Safety**: Any validation error, missing asset, or credential mismatch must block pipeline execution immediately.
