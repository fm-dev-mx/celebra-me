---
description:
    Remediation execution for the 'Gerardo' Event Location section based on discovery report
    findings (2026-02-13).
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 🛠️ Workflow: Event Location Remediation

## Objective

Address findings from `docs/audit/discovery-event-2026-02-13.md` to fix icon semantics and hardcoded
aesthetic values.

## Proposed Changes

### 1. Fix Icon Mapping Semantics

- **Problem**: `dress -> Hat`, `gift -> Boot`.
- **Action**: Update `iconMap` in `EventLocation.astro` (lines 60-66) to use correct semantic names
  that match the `Icon` library.

### 2. Tokenize Hardcoded Colors

- **Problem**: Hardcoded `hsl` values in `_event-location.scss`.
- **Action**: Replace hardcoded HSL values for card titles and shadow effects with token-based
  variables (e.g., `tokens.$color-action-accent`).

### 3. Improve Entrance Animations

- **Action**: Refactor the hardcoded delays to a more flexible stagger system if the number of venue
  cards increases.

## Verification Plan

1. **Icon Check**: Ensure all "Indicaciones" have the correct visually representative icon.
2. **Thematic Verification**: Ensure rivets and frames align perfectly on all screen sizes.

// turbo
