# Documentation Audit Report: Celebra-me

**Date:** 2026-03-03 **Auditor:** Antigravity Agent (Documentation Architecture Governance)

## Executive Summary

An exhaustive audit was conducted on the documentation files (`.md`) of the `celebra-me` project to
identify and mitigate "Documentation Drift". A total of approximately **78 Markdown files**
distributed throughout the project ecosystem were reviewed.

## Phase 1: Inventory and Integrity

### 1. Ghost Documents

Files referenced in some index or configuration but that **do not physically exist**:

- `src/assets/images/common` and `src/assets/icons` referenced in ASSET_MANAGEMENT.md as broken in
  previous iterations.
- `.agent/governance/config/policy.json` and `.agent/governance/config/baseline.json` (References in
  `docs/DOC_STATUS.md` to the old path still create ghosts if someone follows the documentation,
  must be updated to `.agent/governance/config/`).

### 2. Orphan Documents

Files that physically exist but are **not registered** or properly tracked in the dashboard
(`docs/DOC_STATUS.md`): _Technical and Core Docs:_

- `docs/domains/assets/management.md`
- `docs/CONTENT_COLLECTIONS.md`
- `docs/core/project-conventions.md` (Possible historical redundancy)
- `docs/core/premium-ux-vision.md`
- `docs/domains/rsvp/status.md`
- `docs/STABILITY.md`
- `docs/domains/theme/typography.md`
- `docs/domains/theme/architecture.md`

_Architecture & Security:_

- Hardening directory `docs/security-hardening/*` (11 detailed files floating without dashboard
  entry).

_Operations/Workflows:_

- `.agent/workflows/task-auth-dashboard-remediation.md` (Active workflow orphaned from dashboard).
- `.agent/workflows/archive/task-share-flow-optimization.md`
- `.agent/workflows/auto-fix.md`
- `docs/core/project-conventions.md` and `.agent/GATEKEEPER_RULES.md` (At agent root but not indexed
  anywhere, should be Core).

### 3. Obsolete Documents (Low Current Relevance)

Files linked to work sessions completed months or weeks ago (e.g., RSVP-v2 from February 2026) or
prior audits of closed features. **Files to DELETE / ARCHIVE IMMEDIATELY:**

- `docs/audit/rsvp-doc-alignment-2026-02-15.md`
- `docs/audit/rsvp-v2-gap-analysis-2026-02-15.md`
- `docs/audit/rsvp-v2-remediation-backlog-2026-02-15.md`
- `docs/audit/rsvp-v2-verification-2026-02-15.md`
- `reports/ux-audit-gerardo-2026-02-12.md`
- `reports/ux-audit-gerardo-2026-02-13.md`
- `tracking/PR1-route-gaps.md`
- `tracking/PR2-strong-session.md`
- `tracking/PR3-atomic-claim-code.md`
- `tracking/README.md`

_Removal Justification:_ The RSVP module has already reached stability
(`docs/domains/rsvp/status.md`, `docs/domains/rsvp/database.md`). Maintaining "gap-analysis" and
"remediation-backlogs" from a month ago fragments semantic search contexts for agents, increasing
hallucination about resolved issues.

---

## Phase 2: Need Analysis and Consolidation (Lifecycle Classification)

### Category: Evergreen (Immutable Core)

**System Constitution.** Documents that are core and should not be moved. Includes ARCHITECTURE.md,
GIT_GOVERNANCE.md, ASSET_MANAGEMENT.md, THEME_SYSTEM.md, and evergreen workflows (task-to-prompt,
gatekeeper, etc.). **Action:** Consolidate redundant files (core/project-conventions.md into
GIT_GOVERNANCE.md or vice versa).

### Category: Task-Active (Current Work)

Plans in .agent/plans/invitation-evolution-march-2026/\* and reports in .agent/plans/. **Action:**
Temporarily index them in the 'Tasks Open' section in DOC_STATUS.

### Category: Legacy/Archive (Historicals)

Security-hardening module. Contains plans from phase-0 to phase-5. **Action:** Freeze into a single
condensed .md (docs/domains/security/roadmap.md) or move entirely to /archive/.

### Category: Redundant (Repetition)

Files that duplicate functionality: ASSET_REGISTRY_GUIDE overlaps with ASSET_MANAGEMENT. Also
THEME_INVENTORY and TYPOGRAPHY_SYSTEM overlap with THEME_SYSTEM. Recommendation: Merge concepts and
de-duplicate.

---

## Naming Convention Drift

A serious conflict is found in the naming of root documentation files:

- **UPPER_CASE.md (Uppercase Snake Case):** Used for "Supreme Documents" (`GIT_GOVERNANCE.md`,
  `ARCHITECTURE.md`) evoking Open Source repository styles (`README.md`).
- **kebab-case.md:** Recommended form for workflows, scripts, URL pathing and internal modules
  (`rsvp-module.md`, `gatekeeper-commit.md`).

**Recommended Architectural Decision:**

1. Files in the repository root (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`) must retain
   `UPPER_CASE`.
2. **All** files inside `docs/`, `.agent/`, including "Supremes", must migrate to `kebab-case`
   (`git-governance.md`, `architecture.md`, `doc-status.md`). This avoids cross-platform violations
   (Windows/Linux OS case-insensitivity bugs) and is the NextJS/Astro standard.

---

## Phase 3: Reorganization Proposal (3-Layer Architecture)

To establish a professional taxonomy, the current flat structure must be refactored toward a
three-layer semantic tree:

### Layer 1: Core (Constitution)

Immutable cross-cutting policy documents, located in `docs/core/`:

- `docs/core/architecture.md`
- `docs/core/git-governance.md`
- `docs/core/testing-strategy.md` (rename TESTING.md)
- `docs/core/project-conventions.md` (rename and bring from `.agent/`)

### Layer 2: Features/Domains

Modular domain documentation, located in `docs/domains/`:

- `docs/domains/rsvp/` (Contains `architecture.md`, `database-schema.md`, `status.md`)
- `docs/domains/theme/` (Merges system, typography, inventory into organic sub-files)
- `docs/domains/assets/` (Merges management and registry)
- `docs/domains/security/`

### Layer 3: Operations

Workflows, scripts, and audits, located in `.agent/`:

- `.agent/workflows/` (Evergreen)
- `.agent/plans/` (Multi-phase remediation plans and dynamic audits)

This report is the basis for executing the "Doc Realignment Plan".
