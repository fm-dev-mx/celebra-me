---
title: Guest Message Sharing UX Improvement
status: active
created: 2026-06-10
updated: 2026-06-10
implemented: 2026-06-10
last_pass: 2026-06-10
related_skills:
  - supabase
  - supabase-postgres-best-practices
related_docs:
  - docs/README.md
supersedes: []
superseded_by: []
---

# Guest Message Sharing UX Improvement

## 1. Current State Summary

Four UI surfaces handle invitation message templates:

| Surface            | Location                                           | Preview   | Editable | Scope                   | Variables Listed |
| ------------------ | -------------------------------------------------- | --------- | -------- | ----------------------- | ---------------- |
| Invitation Editor  | `InvitationEditor.tsx` → "Mensajes para compartir" | None      | Yes      | Global (draft→publish)  | 3                |
| Dashboard Messages | `ShareMessagesModal.tsx` from toolbar menu         | Read-only | Yes      | Global (direct publish) | 8                |
| Share Composer     | `ShareComposer.tsx` via `ShareAction.tsx`          | Read-only | None     | Global (read-only)      | N/A              |
| Send Pending       | `SendInvitationModal.tsx`                          | **None**  | None     | Pre-rendered DTO        | N/A              |

## 2. Approach

- P1: Add message preview + temporary editing to `SendInvitationModal`. Fix CTA hierarchy. No
  backend changes.
- P2: Rename labels, align variables, add chips, add editor preview, improve reset, add
  `ogDescription` to modal, microcopy, mobile polish.
- P3: Deferred.

All edits in send/share flows are local state only. No global template mutation from send flows.

## 3. Product Decision: Direct-Published Write

`ShareMessagesModal` writes directly to published content. Edits go live immediately. The editor
uses draft→publish. This is intentional — P2 adds microcopy to clarify it.
