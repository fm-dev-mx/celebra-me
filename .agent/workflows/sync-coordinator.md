---
description:
    Coordinates all sync workflows (documentation, workflows, skills) following the sync framework
    pattern.
---

# 🔄 Master Sync Coordinator

**Purpose**: Coordinate and sequence all sync workflows to maintain comprehensive system alignment.

**Based On**: Universal sync pattern from `.agent/workflows/docs/sync-framework.md`

---

## 1. Sync Ecosystem Overview

### Three Synchronization Domains

| Domain            | Workflow             | Frequency | Owner              |
| ----------------- | -------------------- | --------- | ------------------ |
| **Documentation** | `docs/docs-audit.md` | Monthly   | Documentation Lead |
| **Workflows**     | `workflow-sync.md`   | Quarterly | Workflow Architect |
| **Skills**        | `skills-sync.md`     | Quarterly | Skills Manager     |

### Dependencies

- Documentation sync provides foundation for other syncs
- Workflow sync depends on current documentation
- Skills sync depends on both architecture and workflows

---

## 2. Coordination Strategy

### Sequential Execution Order

```text
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Documentation Sync                                 │
│  - Establishes source of truth                              │
│  - Updates DOC_STATUS.md                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Workflow Sync                                      │
│  - Uses updated documentation                               │
│  - Aligns workflows with current conventions                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Skills Sync                                        │
│  - Uses updated architecture and workflows                  │
│  - Ensures agent capabilities match current state           │
└───────────────────────────────────────────────────────────┘
```

### Parallel Execution (When Independent)

- Schema validation (documentation ↔ implementation)
- Link checking (all domains)
- Stale file detection (all domains)

---

## 3. Execution Protocol

### Pre-Sync Checklist

- [ ] All three sync workflows updated to current framework version
- [ ] Source of truth documents stable (no pending major changes)
- [ ] Team notified of sync window (if critical issues expected)
- [ ] Backup current status reports

### Sync Execution

```bash
# Phase 1: Documentation Sync
./.agent/workflows/docs/docs-audit.md

# Phase 2: Workflow Sync
./.agent/workflows/workflow-sync.md

# Phase 3: Skills Sync
./.agent/workflows/skills-sync.md
```

### Post-Sync Verification

- [ ] All individual sync reports generated
- [ ] Combined report created (this workflow)
- [ ] Status dashboards updated
- [ ] Team notified of results
- [ ] Critical issues assigned for remediation

---

## 4. Combined Reporting

### Report Structure

```markdown
# Combined Sync Report - YYYY-MM-DD

## Executive Summary

- Total Items Audited: <N> (docs + workflows + skills)
- Overall Health: <percentage>%
- Critical Issues: <N> 🔴
- High Issues: <N> 🟠
- Medium Issues: <N> 🟡

## Domain Summary

### Documentation

- Audited: <N> documents
- Status: <summary>
- Critical Issues: <list>

### Workflows

- Audited: <N> workflows
- Status: <summary>
- Critical Issues: <list>

### Skills

- Audited: <N> skills
- Status: <summary>
- Critical Issues: <list>

## Cross-Domain Findings

[Issues that span multiple domains]

## Integrated Remediation Plan

- Week 1: Cross-domain critical issues
- Week 2: Domain-specific high priority
- Month 1: Medium priority consolidation

## Next Sync Scheduled: YYYY-MM-DD
```

### Report Location

- `docs/audit/combined-sync-report-YYYY-MM-DD.md`
- Summary appended to `docs/DOC_STATUS.md`
- Critical issues added to `docs/STABILITY.md`

---

## 5. Automation & Tooling

### Shared Automation

```bash
# Link checking across all domains
./scripts/check-links.sh

# Stale file detection
./scripts/find-stale.sh 180  # 180 days = 6 months

# Schema validation
./scripts/validate-schema.js
```

### Runner Script

A convenience wrapper `scripts/sync-runner.sh` can execute the three validation scripts in sequence
with configurable options:

```bash
# Run all sync validations (default)
bash scripts/sync-runner.sh

# Run only documentation checks
bash scripts/sync-runner.sh --only-docs

# Run with custom stale threshold
bash scripts/sync-runner.sh --stale-days 30
```

### Monitoring

- Weekly: Quick link check
- Monthly: Documentation sync trigger
- Quarterly: Full three-domain sync
- Pre-release: Mandatory full sync

---

## 6. Exception Handling

### When to Pause Sync

- Major architecture changes in progress
- Critical production issues being addressed
- Team capacity constraints

### When to Accelerate Sync

- After major refactoring
- Before important releases
- When drift indicators appear (frequent errors)

### Partial Syncs

- Can run individual domain syncs independently
- Must update combined report with partial status
- Note which domains were skipped

---

## 7. Success Metrics

### System-Level Metrics

- Time from code change to documentation update
- Percentage of system in sync (all domains)
- Reduction in "documentation drift" issues
- Team confidence in system accuracy

### Operational Metrics

- Sync execution time
- Auto-remediation rate
- Manual intervention required
- Report clarity and actionability

---

## 8. Evolution & Improvement

### Quarterly Review

- Evaluate sync effectiveness
- Update framework based on learnings
- Adjust frequencies based on project velocity
- Incorporate new automation opportunities

### Feedback Loop

- Gather team feedback on sync results
- Measure impact on development velocity
- Adjust based on changing project needs

---

## 9. Integration with Development Cycle

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
on:
    schedule:
        - cron: '0 0 1 * *' # Monthly documentation sync
        - cron: '0 0 1 */3 *' # Quarterly full sync

    workflow_dispatch: # Manual trigger
```

### Gatekeeper Integration

- Sync status checked before major commits
- Critical sync failures block releases
- Sync requirements part of definition of done

---

## 10. Templates & Artifacts

### Available Templates

- Individual sync report template
- Combined report template
- Remediation task template
- Status update template

### Artifact Storage

- All reports in `docs/audit/`
- Raw data in `docs/audit/data/` (if needed)
- Historical trends in `docs/audit/trends/`

// turbo

> [!IMPORTANT] The sync coordinator ensures holistic system alignment. Individual domain syncs can
> run independently, but combined syncs provide maximum consistency.
