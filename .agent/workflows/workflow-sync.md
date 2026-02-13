---
description: Workflow maintenance and drift detection following the sync framework pattern.
---

# 💎 Workflow: Workflow Sync & Maintenance

**Framework**: Follows the universal sync pattern from `.agent/workflows/docs/sync-framework.md`

---

## Phase 0: SCAN - Inventory Current State

**Purpose**: Create comprehensive inventory of all workflows

**Steps:**

1. **List all workflow files**

    ```bash
    # Active workflows
    find .agent/workflows -name "*.md" | grep -v archive | sort

    # Archived workflows
    find .agent/workflows/archive -name "*.md" | sort
    ```

2. **Extract metadata**
    - File name and path
    - Last modified date
    - Description (from frontmatter)
    - Dependencies/references to other files
    - Categorization tags (if present)

3. **Categorize workflows**
    - **Execution**: Task-specific (`gerardo-technical-audit`, `gerardo-remediation`)
    - **Gatekeeper**: Quality assurance (gatekeeper-commit)
    - **Asset/Design**: Visual consistency (theme-architecture-governance)
    - **Sync/Support**: Maintenance workflows (workflow-sync, skills-sync, docs-audit,
      docs-remediation, prompt-to-workflow)
    - **Documentation**: Content generation (docs-content-collections, landing-page-maintenance)
    - **Archived**: Completed or obsolete (check archive/ folder)

---

## Phase 1: CROSS-REFERENCE - Identify Drift

**Purpose**: Compare workflows against sources of truth

**Source of Truth:**

- `.agent/GATEKEEPER_RULES.md` - Operational constraints
- `.agent/PROJECT_CONVENTIONS.md` - Naming and style conventions
- `docs/ARCHITECTURE.md` - Architectural patterns
- `docs/PREMIUM_UX_VISION.md` - Design direction

**Drift Checks:**

1. **Link Integrity**
    - Verify all `docs/` references exist
    - No `file://` protocol (use repo-relative `./name.md` or `./docs/name.md`)
    - Links to archived workflows should be updated or removed

2. **Convention Compliance**
    - Terminology: Enforce ADU, Jewelry Box, Hacienda, Asset Registry
    - File naming: kebab-case for workflow files
    - Frontmatter: Required `description` field

3. **Ability Integration**
    - Cross-reference with `.agent/skills/` (accessibility, animation-motion, etc.)
    - Ensure workflows use correct skill references

4. **Obsolete Detection**
    - Check for workflows referencing archived docs
    - Identify duplicates with >70% overlap
    - Flag workflows >3 months without execution
    - Archive task workflows in the next sync cycle when closure evidence exists in
      `docs/implementation-log.md` (status complete/deployed/executed)

---

## Phase 2: CATEGORIZE - Assign Severity Levels

**Severity Matrix:**

| Level    | Icon | Criteria                 | Examples                                 |
| -------- | ---- | ------------------------ | ---------------------------------------- |
| Critical | 🔴   | Breaking/blocking issues | Broken links preventing execution        |
| High     | 🟠   | Significant impact       | Obsolete workflows, outdated conventions |
| Medium   | 🟡   | Should fix               | Formatting, minor inconsistencies        |
| Synced   | 🟢   | Verified alignment       | Workflow matches all conventions         |

**Categorization Rules:**

- **🔴 Critical**: Setup/execution instructions lead to errors
- **🟠 High**: References to archived/deleted files, major convention violations
- **🟡 Medium**: Style inconsistencies, missing metadata, redundant instructions
- **🟢 Synced**: All checks pass, follows current conventions

---

## Phase 3: REPORT - Document Findings

**Required Output:**

1. **Executive Summary**
    - Total workflows audited (active + archived)
    - Count by severity level
    - Overall health score

2. **Detailed Findings**
    - Workflow-by-workflow assessment
    - Specific drift descriptions with file paths
    - Recommended actions

3. **Remediation Plan**
    - Priority 1 (Week 1): Critical issues
    - Priority 2 (Week 2): High priority issues
    - Priority 3 (Ongoing): Medium issues

**Report Template:**

```markdown
# Workflow Sync Report - YYYY-MM-DD

## Summary

- Workflows Audited: <N>
- 🔴 Critical: <N>
- 🟠 High: <N>
- 🟡 Medium: <N>
- 🟢 Synced: <N>

## Critical Findings

[Detailed list]

## Remediation Timeline

- Week 1: [Critical items]
- Week 2: [High items]
- Ongoing: [Medium items]
```

---

## Phase 4: REMEDIATE - Apply Fixes (Optional)

**When to Remediate:**

- Auto-fix: Medium severity formatting issues
- Manual fix: Critical/High severity (requires review)
- Defer: Major architectural changes (create separate workflow)

**Remediation Actions:**

1. **Link Updates**
    - Replace `file://` with relative paths
    - Update references to archived workflows
    - Fix broken documentation links

2. **Convention Enforcement**
    - Standardize terminology
    - Update frontmatter descriptions
    - Apply consistent formatting

3. **Consolidation**
    - Merge workflows with >70% overlap
    - Archive task-specific workflows after completion
    - Use `docs/implementation-log.md` as closure evidence before archiving task workflows
    - Remove redundant instructions

4. **Quality Improvements**
    - Add missing JSDoc in examples (English only)
    - Remove anti-patterns and noise
    - Verify `// turbo` placement for safe automation

**Verification:**

- After each fix, re-run relevant checks
- Update report with remediation status
- Ensure no regressions introduced

---

## Automation Opportunities

**Available Scripts** (see `scripts/`):

- **Link validation**: `scripts/check-links.sh` – scans all `.md` files for broken internal links.

    ```bash
    bash scripts/check-links.sh
    ```

- **Stale file detection**: `scripts/find-stale.sh <days>` – identifies workflow files older than
  specified days.

    ```bash
    bash scripts/find-stale.sh 180  # 6 months
    ```

- **Schema validation**: `scripts/validate-schema.js` – (for theme/workflow consistency) compares
  Zod enum variants with CSS theme selectors.

**Manual Review Required:**

- Conceptual drift (workflow purpose vs implementation)
- Architectural violations
- Best practice evolution

---

## Frequency & Integration

**Recommended Schedule:**

- **Monthly**: Quick link and convention check
- **Quarterly**: Full audit with categorization
- **Pre-release**: Verify all Critical issues resolved

**Integration Points:**

- **Before Sync**: Gatekeeper approval for workflow changes
- **After Sync**: Update DOC_STATUS.md, execute remediation workflows
- **Team Notification**: Critical issues requiring immediate attention

---

## Success Metrics

**Quantitative:**

- % of workflows synced (🟢)
- Time to remediate Critical issues
- Number of broken links (target: 0)
- Convention violation count (target: 0)

**Qualitative:**

- Developer confidence in workflow accuracy
- Setup success rate for new workflows
- Time to understand and execute workflows

// turbo

> [!IMPORTANT] Follow the sync framework pattern for consistency. Always verify Critical findings
> before remediation. Update frequency based on project velocity.
