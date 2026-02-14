---
description: Workflow artifact
lifecycle: evergreen
domain: docs
owner: docs-governance
last_reviewed: 2026-02-14
---

# 📚 Documentation Workflows

This folder contains specialized workflows for documentation governance and maintenance.

## Workflows Overview

### Core Governance

| Workflow                        | Purpose                               | When to Use                               |
| ------------------------------- | ------------------------------------- | ----------------------------------------- |
| **docs-audit.md**               | Comprehensive documentation audit     | Monthly, after major changes, pre-release |
| **docs-remediation.md**         | Execute fixes for audit findings      | After audit identifies issues             |
| **docs-content-collections.md** | Create missing critical documentation | When adding new schemas/features          |

### Consolidated Workflows

| Workflow                        | Replaces                                                              | Purpose                                                     |
| ------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| **gatekeeper-commit.md**        | `atomic-ui-commit.md` + `safe-commit.md`                              | Unified commit gatekeeping (strict/minimal modes)           |
| **landing-page-maintenance.md** | `landing-page-remediation.md` + `landing-page-regression-recovery.md` | Landing page fixes (recovery/remediation/maintenance modes) |

### Framework

| Workflow              | Purpose                                    |
| --------------------- | ------------------------------------------ |
| **sync-framework.md** | Base pattern for all sync/audit operations |

---

## Quick Start

### 1. Run Documentation Audit

```bash
# Use this workflow: docs-audit.md
# Generates: docs/audit/audit-report-YYYY-MM-DD.md
```

**What it does:**

- Validates schema synchronization (Zod ↔ CSS)
- Checks architecture compliance
- Verifies link integrity
- Detects drift between docs and implementation
- Generates categorized report (🔴🟠🟡🟢)

### 2. Execute Remediation

```bash
# Use this workflow: docs-remediation.md
# Input: Audit report findings
```

**What it does:**

- Fixes Critical (🔴) issues first
- Provides specific fix instructions
- Handles schema mismatches
- Consolidates workflows
- Archives obsolete files

### 3. Create Missing Documentation

```bash
# Use this workflow: docs-content-collections.md
# Creates: docs/CONTENT_COLLECTIONS.md
```

**What it does:**

- Generates comprehensive documentation from schema
- Includes all event types and variants
- Provides working examples
- Documents AssetRegistry integration

---

## Workflow Relationships

```
┌─────────────────────────────────────────────────────┐
│  docs-audit.md                                      │
│  └─> Generates findings (🔴🟠🟡)                   │
│      └─> docs-remediation.md                        │
│          └─> Fixes applied                          │
│              └─> Re-audit to verify                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  docs-content-collections.md                        │
│  └─> Creates missing documentation                  │
│      └─> Next audit will verify integration         │
└─────────────────────────────────────────────────────┘
```

---

## Usage Guide

### Monthly Maintenance

1. Run `docs-audit.md`
2. Review findings report
3. Execute `docs-remediation.md` for 🔴 issues
4. Update `docs/STABILITY.md` status

### After Major Features

1. Run `docs-content-collections.md` if schema changed
2. Run `docs-audit.md` to verify consistency
3. Fix any 🔴 drift immediately

### Pre-Release Checklist

- [ ] `docs-audit.md` executed
- [ ] No 🔴 Critical findings
- [ ] `docs/STABILITY.md` updated
- [ ] New features documented

---

## Consolidation Notes

### Replaced Workflows

These workflows have been consolidated. Update your references:

**Gatekeeper:**

- ~~`atomic-ui-commit.md`~~ → `gatekeeper-commit.md` (--strict mode)
- ~~`safe-commit.md`~~ → `gatekeeper-commit.md` (--minimal mode)

**Landing Page:**

- ~~`landing-page-remediation.md`~~ → `landing-page-maintenance.md` (--remediation mode)
- ~~`landing-page-regression-recovery.md`~~ → `landing-page-maintenance.md` (--recovery mode)

### Archive Process

Old workflows should be archived:

1. Move to `.agent/workflows/archive/`
2. Add header noting replacement
3. Update all references

---

## Key Principles

1. **Audit before Remediation**: Never fix without identifying the problem first
2. **Severity-Based**: Fix 🔴 Critical before 🟠 High before 🟡 Medium
3. **Verify After**: Always re-audit after remediation
4. **Document Status**: Keep `docs/STABILITY.md` current
5. **Archive, Don't Delete**: Preserve history by archiving obsolete workflows

---

## Troubleshooting

### Audit finds too many issues

- Focus on 🔴 Critical first
- Create tickets for 🟠 High
- Address 🟡 Medium during maintenance windows

### Schema mismatch

- Check `src/content/config.ts` vs CSS variants
- Use `docs-remediation.md` Phase 2.1
- Verify with `pnpm check`

### Broken links

- Search for `file://` protocol
- Replace with relative paths `./`
- Run link checker after fixes

---

## Related Documentation

- `docs/ARCHITECTURE.md` - System architecture
- `docs/STABILITY.md` - Current system status
- `docs/PREMIUM_UX_VISION.md` - Design vision
- `.agent/GATEKEEPER_RULES.md` - Commit standards

---

## Maintenance

**Last Updated**: 2026-02-13 **Version**: 1.0 **Next Review**: 2026-03-13

// turbo
