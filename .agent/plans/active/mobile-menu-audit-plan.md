---
title: Mobile Menu Residual Work
status: active
created: 2026-08-21
updated: 2026-08-21
type: implementation
related_docs:
  - .agent/plans/archived/mobile-menu-audit-plan.md
---

# Mobile Menu Residual Work

## Objective

Close the remaining mobile-drawer token work without reopening the completed base architecture.

## Scope

The plan covers the landing header token mapping and a deferred Sacred Keepsake alignment; it does
not reopen the base drawer architecture.

## Phase 2 — `--mobile-drawer-*`

- `_home-header.scss`: add `#home-header` to `--mobile-drawer-*` mappings
- Verify landing preset drawer values now cascade correctly

## Phase 7 — Sacred Keepsake

- Only after base system is stable and validated
- Refactor to use `--mobile-drawer-*` contract

## Verification

- Confirm the landing preset drawer values cascade correctly after the Phase 2 change.
- Keep the Phase 7 refactor deferred until the base system has current validation evidence.
