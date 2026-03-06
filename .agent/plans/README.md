# 🏛️ Planning Governance Framework

> **Source of Truth** for creating, executing, tracking, and archiving plans within the Celebra-me
> project. Both human collaborators and automated agents must follow these rules without exception.

**Last Updated:** 2026-03-06 **Authority:** `.agent/README.md` § Authority & Precedence **Scope:**
All directories and files under `.agent/plans/`

---

## Table of Contents

1. [Core Principles](#-core-principles)
2. [Mandatory Plan Structure](#-mandatory-plan-structure)
3. [Execution Indicators & Metrics](#-execution-indicators--metrics)
4. [Manifest Schema (`manifest.json`)](#-manifest-schema-manifestjson)
5. [Archiving Protocol](#-archiving-protocol)
6. [Post-Mortem Document](#-post-mortem-document-optional)
7. [Templates](#-standardized-templates)
8. [Rules of Engagement Summary](#-rules-of-engagement-summary)

---

## 🎯 Core Principles

| Principle                 | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| **Deterministic Scope**   | Every plan must define a clear, bounded scope before execution begins.    |
| **Phase Isolation**       | Each phase is a self-contained unit with its own acceptance criteria.     |
| **Audit-First Tracking**  | All deviations, pivots, and completions are logged with timestamps.       |
| **Machine Readability**   | Every plan includes a `manifest.json` for programmatic status assessment. |
| **Archival Immutability** | Archived plans are read-only. They are never modified after archiving.    |
| **Owner Approval Gate**   | No phase may be committed without explicit approval from the plan owner.  |

---

## 📁 Mandatory Plan Structure

Every new plan **must** reside in a **kebab-case** directory directly under `.agent/plans/`:

```
.agent/plans/{plan-name}/
├── README.md          # Executive Summary & Phase Index
├── CHANGELOG.md       # Audit trail with timestamps
├── manifest.json      # Machine-readable status descriptor
├── phases/            # One file per phase
│   ├── 01-{phase-name}.md
│   ├── 02-{phase-name}.md
│   └── ...
└── post-mortem.md     # (Optional) Lessons learned on completion
```

### File Descriptions

| File             | Purpose                                                                           | Required |
| ---------------- | --------------------------------------------------------------------------------- | -------- |
| `README.md`      | High-level objectives, duration estimate, blockers, risk matrix, and Phase Index. | ✅ Yes   |
| `CHANGELOG.md`   | Chronological audit trail of all milestones, deviations, and pivots.              | ✅ Yes   |
| `manifest.json`  | Machine-readable metadata for automated health checks.                            | ✅ Yes   |
| `phases/`        | Directory containing one Markdown file per execution phase.                       | ✅ Yes   |
| `post-mortem.md` | Closing analysis: lessons learned, debt created, recommendations.                 | ⬜ No    |

### Naming Rules

- **Plan directory**: `kebab-case`, descriptive, optionally suffixed with year/quarter (e.g.,
  `auth-refactor-2026`, `pricing-update-q1`).
- **Phase files**: Zero-padded numeric prefix + kebab-case name (e.g., `01-analysis.md`,
  `02-implementation.md`, `03-validation.md`).
- **No spaces, no camelCase, no PascalCase** — enforced by Gatekeeper.

---

## 📊 Execution Indicators & Metrics

Every trackable file (README, phase documents) **must** include the following indicators to enable
both human scanning and machine parsing.

### 1. Progress Header

The **first metadata line** of every README and phase file must include a completion indicator:

```markdown
**Completion:** `0%` | **Status:** `PENDING`
```

Valid status values:

| Status        | Meaning                                      |
| ------------- | -------------------------------------------- |
| `PENDING`     | Not yet started.                             |
| `IN-PROGRESS` | Actively being worked on.                    |
| `BLOCKED`     | Cannot proceed — blocker must be documented. |
| `COMPLETED`   | All acceptance criteria passed.              |
| `ARCHIVED`    | Moved to `.agent/plans/archive/`. Read-only. |

### 2. Task Granularity (GFM Checkboxes)

Use GitHub Flavored Markdown checkboxes for every atomic task:

```markdown
- [ ] Pending task description
- [x] Completed task description (Completed: 2026-03-06 10:30)
```

### 3. Timestamping

Every completed task **must** include a parenthetical timestamp in `YYYY-MM-DD HH:MM` format:

```markdown
- [x] Migrate fetch calls to API client (Completed: 2026-03-04 14:22)
- [x] Remove inline styles from ErrorBoundary (Completed: 2026-03-04 16:45)
```

### 4. Task Weighting

For complex tasks that represent a significant portion of a phase, include a weight percentage:

```markdown
- [x] Component refactor — ErrorBoundary, ClaimCodes, EventsAdmin (40% of Phase) (Completed:
      2026-03-04 16:45)
- [ ] Audit remaining inline styles across dashboard (25% of Phase)
- [x] Create SCSS utility classes in \_common.scss (20% of Phase) (Completed: 2026-03-04 15:10)
- [ ] Validation and type-check pass (15% of Phase)
```

### 5. Section Status Badges

Major sections within any plan document must include a status badge:

```markdown
## 🛠️ API Migration [STATUS: COMPLETED]

## 🎨 Style Governance [STATUS: IN-PROGRESS]

## 🧪 Test Coverage [STATUS: BLOCKED]

> **Blocker:** Playwright config requires update for new route structure.
```

### 6. Blocker Documentation

Any `BLOCKED` status must be immediately followed by a blockquote documenting:

- **What** is blocked
- **Why** it is blocked
- **Who/What** can unblock it

```markdown
## 🔐 Auth Refactor [STATUS: BLOCKED]

> **Blocker:** Supabase RLS policies require production admin approval. **Unblock condition:** Admin
> grants column-level SELECT on `events` table. **Escalated:** 2026-03-06 09:15
```

---

## 🤖 Manifest Schema (`manifest.json`)

Every plan directory **must** include a `manifest.json` file. This file enables agents to
programmatically assess the health, status, and composition of all active plans.

### Schema Definition

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "title", "status", "created", "phases", "owner"],
	"properties": {
		"id": {
			"type": "string",
			"description": "Kebab-case plan identifier matching the directory name.",
			"pattern": "^[a-z0-9]+(-[a-z0-9]+)*$"
		},
		"title": {
			"type": "string",
			"description": "Human-readable plan title."
		},
		"status": {
			"type": "string",
			"enum": ["PENDING", "IN-PROGRESS", "BLOCKED", "COMPLETED", "ARCHIVED"],
			"description": "Current overall status of the plan."
		},
		"completion": {
			"type": "integer",
			"minimum": 0,
			"maximum": 100,
			"description": "Overall completion percentage."
		},
		"created": {
			"type": "string",
			"format": "date",
			"description": "Plan creation date (YYYY-MM-DD)."
		},
		"updated": {
			"type": "string",
			"format": "date",
			"description": "Last modification date (YYYY-MM-DD)."
		},
		"estimatedDuration": {
			"type": "string",
			"description": "Human-readable duration estimate (e.g., '3 phases / ~2 days')."
		},
		"owner": {
			"type": "string",
			"description": "Primary owner or responsible party."
		},
		"blockers": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["description", "since"],
				"properties": {
					"description": { "type": "string" },
					"since": { "type": "string", "format": "date" },
					"escalatedTo": { "type": "string" }
				}
			},
			"description": "Active blockers preventing progress."
		},
		"phases": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["id", "title", "file", "status", "completion"],
				"properties": {
					"id": {
						"type": "string",
						"description": "Phase identifier (e.g., '01-analysis')."
					},
					"title": {
						"type": "string",
						"description": "Human-readable phase title."
					},
					"file": {
						"type": "string",
						"description": "Relative path to the phase document."
					},
					"status": {
						"type": "string",
						"enum": ["PENDING", "IN-PROGRESS", "BLOCKED", "COMPLETED"]
					},
					"completion": {
						"type": "integer",
						"minimum": 0,
						"maximum": 100
					},
					"weight": {
						"type": "integer",
						"minimum": 1,
						"maximum": 100,
						"description": "Percentage weight of this phase relative to the total plan."
					}
				}
			}
		},
		"tags": {
			"type": "array",
			"items": { "type": "string" },
			"description": "Categorical tags (e.g., 'architecture', 'styling', 'security')."
		},
		"archivedAt": {
			"type": "string",
			"format": "date",
			"description": "Date when the plan was archived. Present only if status is ARCHIVED."
		}
	}
}
```

### Example `manifest.json`

```json
{
	"id": "system-health-audit",
	"title": "System Health Audit & Architecture Master Plan",
	"status": "COMPLETED",
	"completion": 100,
	"created": "2026-03-04",
	"updated": "2026-03-05",
	"estimatedDuration": "4 phases / ~2 days",
	"owner": "fm-dev-mx",
	"blockers": [],
	"phases": [
		{
			"id": "01-cleanup-and-references",
			"title": "Cleanup & References",
			"file": "phases/01-cleanup-and-references.md",
			"status": "COMPLETED",
			"completion": 100,
			"weight": 20
		},
		{
			"id": "02-kebab-case-governance",
			"title": "Kebab-case Governance",
			"file": "phases/02-kebab-case-governance.md",
			"status": "COMPLETED",
			"completion": 100,
			"weight": 30
		},
		{
			"id": "03-bff-decoupling",
			"title": "BFF Decoupling",
			"file": "phases/03-bff-decoupling.md",
			"status": "COMPLETED",
			"completion": 100,
			"weight": 30
		},
		{
			"id": "04-jewelry-box-styling",
			"title": "Jewelry Box Styling",
			"file": "phases/04-jewelry-box-styling.md",
			"status": "COMPLETED",
			"completion": 100,
			"weight": 20
		}
	],
	"tags": ["architecture", "technical-debt", "governance"]
}
```

---

## 📦 Archiving Protocol

When a plan reaches **100% completion** and all acceptance criteria are met, the following archiving
protocol is executed:

### Pre-Archive Checklist

1. **All phases** must have `status: COMPLETED` in `manifest.json`.
2. **CHANGELOG.md** must contain a final entry documenting the closure.
3. **manifest.json** must be updated:
    - `status` → `"ARCHIVED"`
    - `archivedAt` → current date (`YYYY-MM-DD`)
4. **(Optional)** `post-mortem.md` is created if technical debt was introduced or significant
   lessons were learned.

### Archive Procedure

```
# 1. Move the entire plan directory to archive
.agent/plans/{plan-name}/  →  .agent/plans/archive/{plan-name}/

# 2. The archive directory is read-only by convention
#    No modifications are permitted after archiving.

# 3. Commit with a descriptive message
git add .agent/plans/archive/{plan-name}/
git commit -m "docs(plans): archive completed plan '{plan-name}'"
```

### Post-Archive Rules

- **No modifications** to archived plans. If a follow-up is needed, create a new plan with a
  reference to the archived one.
- **Cross-referencing**: New plans may link to archived plans for historical context:
    ```markdown
    > **Predecessor:** [System Health Audit](../archive/system-health-audit/README.md)
    ```
- **Retention**: Archived plans are retained indefinitely for audit purposes.

---

## 📝 Post-Mortem Document (Optional)

When a plan reaches 100%, a `post-mortem.md` **should** be created if any of the following
conditions are true:

- Technical debt was intentionally introduced during execution.
- Significant deviations from the original scope occurred.
- Unexpected blockers delayed the plan by more than one phase.
- The plan produced architectural insights worth preserving.

### Post-Mortem Structure

```markdown
# Post-Mortem: {Plan Title}

**Plan ID:** `{plan-id}` **Duration:** {start-date} → {end-date} **Final Status:** `COMPLETED` |
`COMPLETED WITH EXCEPTIONS`

---

## Summary

{2-3 sentence summary of what the plan accomplished.}

## Key Metrics

| Metric                    | Value   |
| ------------------------- | ------- |
| Phases Completed          | X / Y   |
| Total Tasks               | XX      |
| Tasks Completed On-Time   | XX      |
| Deviations Logged         | X       |
| Technical Debt Introduced | X items |

## Deviations from Original Scope

- {Description of deviation and rationale.}

## Technical Debt Created

- [ ] {Debt item — link to follow-up plan or issue if applicable.}

## Lessons Learned

1. {Lesson with actionable takeaway.}
2. {Lesson with actionable takeaway.}

## Recommendations for Future Plans

- {Recommendation.}
```

---

## 📋 Standardized Templates

The following templates serve as scaffolding when creating a new plan. Copy the relevant sections
and fill in the placeholders marked with `{...}`.

---

### Template A: Plan README

```markdown
# {Icon} {Plan Title}

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** {1-2 sentence high-level objective.}

**Estimated Duration:** {Number of phases / time estimate} **Owner:** {Primary responsible party}
**Created:** {YYYY-MM-DD}

---

## 🎯 Scope

### In Scope

- {Item 1}
- {Item 2}

### Out of Scope

- {Item 1}
- {Item 2}

---

## 🔴 Blockers & Risks

| Risk / Blocker     | Severity | Mitigation            |
| ------------------ | -------- | --------------------- |
| {Risk description} | High     | {Mitigation strategy} |
| {Risk description} | Medium   | {Mitigation strategy} |

---

## 🗺️ Phase Index

| #   | Phase                                        | Weight | Status    |
| --- | -------------------------------------------- | ------ | --------- |
| 01  | [{Phase Title}](./phases/01-{phase-name}.md) | {XX}%  | `PENDING` |
| 02  | [{Phase Title}](./phases/02-{phase-name}.md) | {XX}%  | `PENDING` |
| 03  | [{Phase Title}](./phases/03-{phase-name}.md) | {XX}%  | `PENDING` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
```

---

### Template B: Phase Document

```markdown
# Phase {NN}: {Phase Title}

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** {1-2 sentence phase-specific objective.}

**Weight:** {XX}% of total plan

---

## 🎯 Analysis / Findings

{Describe the current state, audit findings, or analysis that informs this phase.}

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### {Task Group 1 Title}

- [ ] {Task description} ({XX}% of Phase)
- [ ] {Task description} ({XX}% of Phase)

### {Task Group 2 Title}

- [ ] {Task description} ({XX}% of Phase)
- [ ] {Task description} ({XX}% of Phase)

---

## ✅ Acceptance Criteria

- [ ] {Criterion 1 — specific, measurable, verifiable.}
- [ ] {Criterion 2 — specific, measurable, verifiable.}
- [ ] {Criterion 3 — specific, measurable, verifiable.}

---

## 📎 References

- [{Related document}]({relative-path})
- [{Related document}]({relative-path})
```

---

### Template C: `manifest.json`

```json
{
	"id": "{plan-id}",
	"title": "{Plan Title}",
	"status": "PENDING",
	"completion": 0,
	"created": "{YYYY-MM-DD}",
	"updated": "{YYYY-MM-DD}",
	"estimatedDuration": "{N phases / ~N days}",
	"owner": "{owner-id}",
	"blockers": [],
	"phases": [
		{
			"id": "01-{phase-name}",
			"title": "{Phase Title}",
			"file": "phases/01-{phase-name}.md",
			"status": "PENDING",
			"completion": 0,
			"weight": 0
		}
	],
	"tags": []
}
```

---

### Template D: CHANGELOG

```markdown
# 📝 Changelog: {Plan Title}

Deterministic audit trail for `{plan-id}`.

---

## [Unreleased]

### Phase {NN}: {Phase Title}

_No entries yet._

---

> Entries follow reverse-chronological order within each phase. Format:
> `**{Action}:** {Description} (Completed: YYYY-MM-DD HH:MM)`
```

---

## ⚡ Rules of Engagement Summary

### For Agents

1. **Before creating a plan**, read this document in full.
2. **Scaffold** using the templates above — do not invent new structures.
3. **Update `manifest.json`** after every phase status change.
4. **Log every action** in `CHANGELOG.md` with a timestamp.
5. **Never skip** the progress header or status badges.
6. **Never modify** archived plans.
7. **Never commit** a phase without explicit owner approval.
8. **Report blockers immediately** — do not silently work around them.

### For Human Collaborators

1. **Review phase PRs** before approving commits.
2. **Validate `manifest.json`** reflects reality before archiving.
3. **Request a post-mortem** if technical debt was introduced.
4. **Use the archive protocol** — do not delete completed plans.

### Directory Hygiene

```
.agent/plans/
├── README.md              ← This file (governance rules)
├── {active-plan-1}/       ← Active plans live here
├── {active-plan-2}/
└── archive/               ← Completed plans are moved here
    ├── {completed-plan-1}/
    └── {completed-plan-2}/
```

- Only **active plans** reside at the top level of `.agent/plans/`.
- Only **completed, archived plans** reside in `.agent/plans/archive/`.
- This `README.md` is the **only** file at the root level of `.agent/plans/` (besides plan
  directories and the `archive/` folder).

---

> **Precedence:** This document operates under the authority of `.agent/README.md`. In case of
> conflict between this framework and the root agent README, the root agent README takes precedence.
