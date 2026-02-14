---
description: Base framework for all sync/audit workflows (docs, workflows, skills).
lifecycle: evergreen
domain: docs
owner: docs-governance
last_reviewed: 2026-02-14
---

# 🔄 Framework: Sync & Audit

Base pattern for synchronization and drift detection workflows.

**Used by:**

- `.agent/workflows/docs/docs-audit.md` - Documentation sync
- `workflow-sync.md` - Workflow maintenance
- `skills-sync.md` - Agent skills sync

---

## 1. Universal Pattern

All sync workflows follow this structure:

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: SCAN                                              │
│  - Identify target files                                    │
│  - Inventory current state                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: CROSS-REFERENCE                                   │
│  - Compare against source of truth                          │
│  - Identify drift                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: CATEGORIZE                                        │
│  - 🔴 Critical: Breaking/blocking                           │
│  - 🟠 High: Significant impact                              │
│  - 🟡 Medium: Should fix                                    │
│  - 🟢 Synced: Verified                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: REPORT                                            │
│  - Document findings                                        │
│  - Prioritize remediation                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: REMEDIATE (Optional)                              │
│  - Apply fixes                                              │
│  - Verify resolution                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phase Details

### Phase 0: Scan

**Purpose**: Create comprehensive inventory

**Steps:**

1. **List all target files**

    ```bash
    # Example for docs:
    find docs -name "*.md" | sort

    # Example for workflows:
    find .agent/workflows -name "*.md" | grep -v archive

    # Example for skills:
    find .agent/skills -name "*.md"
    ```

2. **Extract metadata**
    - File name
    - Last modified date
    - Description (from frontmatter)
    - Dependencies/references

3. **Categorize**
    - Core vs. Support
    - Active vs. Potentially obsolete

### Phase 1: Cross-Reference

**Purpose**: Identify drift from source of truth

**Checks:**

- Documentation vs. Implementation (`docs/` vs `src/`)
- Workflow vs. Conventions (`.agent/workflows` vs `.agent/GATEKEEPER_RULES.md`)
- Skills vs. Architecture (`.agent/skills` vs `docs/ARCHITECTURE.md`)

**Drift Types:**

- **Missing**: Documented but not implemented
- **Obsolete**: Implemented but not documented
- **Mismatched**: Both exist but don't align
- **Broken**: Links/references don't resolve

### Phase 2: Categorize

**Severity Levels:**

| Level    | Icon | Criteria                 | Example                                    |
| -------- | ---- | ------------------------ | ------------------------------------------ |
| Critical | 🔴   | Breaking/blocking issues | Schema mismatch, broken setup instructions |
| High     | 🟠   | Significant impact       | Obsolete workflows, outdated examples      |
| Medium   | 🟡   | Should fix               | Formatting, minor inconsistencies          |
| Synced   | 🟢   | Verified alignment       | Documentation matches implementation       |

### Phase 3: Report

**Required Output:**

1. **Executive Summary**
    - Total items audited
    - Count by severity
    - Overall health score

2. **Detailed Findings**
    - Item-by-item assessment
    - Specific drift descriptions
    - Recommended actions

3. **Remediation Plan**
    - Prioritized task list
    - Estimated effort
    - Dependencies

**Report Format:**

```markdown
# Sync Report - YYYY-MM-DD

## Summary

- Items Audited: <N>
- 🔴 Critical: <N>
- 🟠 High: <N>
- 🟡 Medium: <N>
- 🟢 Synced: <N>

## Critical Findings

[Detailed list]

## Remediation

- Week 1: [Critical items]
- Week 2: [High items]
- Ongoing: [Medium items]
```

### Phase 4: Remediate (Optional)

Some sync workflows include remediation, others defer to separate workflows.

**If including remediation:**

1. Follow severity order (Critical → High → Medium)
2. Apply fixes incrementally
3. Verify each fix before proceeding
4. Update report with status

**If deferring:**

1. Reference remediation workflow
2. Provide specific guidance
3. Create actionable checklists

---

## 3. Customization by Target

### Documentation Sync (`docs-audit.md`)

**Additional Checks:**

- Schema validation (Zod ↔ CSS)
- Architecture compliance (presets)
- Link integrity
- Code example validity

**Source of Truth:**

- `src/` (implementation)
- `docs/ARCHITECTURE.md` (patterns)

### Workflow Sync (`workflow-sync.md`)

**Additional Checks:**

- Obsolete workflow detection
- Duplicate identification
- Categorization accuracy
- Cross-references valid

**Source of Truth:**

- `.agent/GATEKEEPER_RULES.md`
- `.agent/PROJECT_CONVENTIONS.md`

### Skills Sync (`skills-sync.md`)

**Additional Checks:**

- Skill coverage gaps
- Outdated patterns
- Missing abilities
- Implementation alignment

**Source of Truth:**

- `docs/ARCHITECTURE.md`
- `docs/PREMIUM_UX_VISION.md`
- `src/` (actual implementation)

---

## 4. Automation Opportunities

### High-Value Automation

**Link Checking:**

```bash
# Find broken internal links
grep -r "file://" docs/ .agent/
grep -r "\[.*\](.*\.md)" docs/ | while read link; do verify_exists "$link"; done
```

**Schema Validation:**

```typescript
// Compare Zod schema with CSS variants
const cssVariants = extractVariantsFromCSS();
const zodVariants = extractVariantsFromSchema();
const mismatches = findDifferences(cssVariants, zodVariants);
```

**Stale Detection:**

```bash
# Find workflows not modified in 6 months
find .agent/workflows -name "*.md" -mtime +180
```

### Manual Review Required

- Conceptual drift (meaning changed but not docs)
- Architecture violations (requires human judgment)
- Best practice evolution (subjective)

---

## 5. Frequency Recommendations

| Target        | Frequency   | Trigger                    |
| ------------- | ----------- | -------------------------- |
| Documentation | Monthly     | After major features       |
| Workflows     | Quarterly   | When adding new workflows  |
| Skills        | Quarterly   | After architecture changes |
| Full Audit    | Pre-release | Before major releases      |

---

## 6. Integration Points

### Before Sync

- Gatekeeper approval (for workflow changes)
- Feature completion (for docs)
- Architecture decisions (for skills)

### After Sync

- Remediation workflow execution
- Status dashboard update
- Team notification (if critical issues)

---

## 7. Anti-Patterns to Avoid

**Don't:**

- ❌ Auto-remediate without review (Critical/High)
- ❌ Delete without verifying references
- ❌ Report without specific file paths
- ❌ Sync without updating status dashboard

**Do:**

- ✅ Categorize objectively
- ✅ Provide specific remediation steps
- ✅ Verify before marking synced
- ✅ Archive (don't delete) obsolete items

---

## 8. Success Metrics

**Quantitative:**

- % of items synced (🟢)
- Time to remediate Critical issues
- Number of broken links (target: 0)
- Schema mismatch count (target: 0)

**Qualitative:**

- Developer confidence in docs
- Setup success rate for new developers
- Time to onboard new team members

// turbo

> [!IMPORTANT] This is a base framework. Extend with target-specific checks. Always verify Critical
> findings manually. Update frequency based on project velocity.
