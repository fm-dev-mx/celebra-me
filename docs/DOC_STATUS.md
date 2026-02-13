# Documentation Status Dashboard

**Last Updated:** 2026-02-12 **Next Review:** 2026-03-12 **Maintainer:** Automated Documentation
Audit System

---

## Quick Stats

| Metric                 | Count                     | Status |
| ---------------------- | ------------------------- | ------ |
| **Total Documents**    | 52                        | 🟢     |
| **Core Documentation** | 8                         | 🟢     |
| **Workflows**          | 15 (7 active, 7 archived) | 🟢     |
| **Issues Critical**    | 0                         | 🟢     |
| **Issues High**        | 0                         | 🟢     |
| **Issues Medium**      | 9                         | 🟡     |

**Overall Health:** 85% 🟢

---

## Core Documentation Status

| Document                                             | Status     | Last Verified | Notes                |
| ---------------------------------------------------- | ---------- | ------------- | -------------------- |
| [README.md](../README.md)                            | 🟢 Synced  | 2026-02-12    | Current              |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                 | 🟢 Synced  | 2026-02-12    | Links updated        |
| [PREMIUM_UX_VISION.md](./PREMIUM_UX_VISION.md)       | 🟢 Synced  | 2026-02-12    | Links updated        |
| [CONTENT_COLLECTIONS.md](./CONTENT_COLLECTIONS.md)   | 🟢 New     | 2026-02-12    | **Created today**    |
| [THEME_SYSTEM.md](./THEME_SYSTEM.md)                 | 🟡 Partial | 2026-02-12    | Needs variant update |
| [STABILITY.md](./STABILITY.md)                       | 🟢 Synced  | 2026-02-12    | Updated today        |
| [ASSET_REGISTRY_GUIDE.md](./ASSET_REGISTRY_GUIDE.md) | 🟢 Synced  | 2026-02-12    | Current              |
| [ASSET_MANAGEMENT.md](./ASSET_MANAGEMENT.md)         | 🟢 Synced  | 2026-02-12    | Current              |

---

## Workflow Organization

### Active Workflows (7)

**Documentation Workflows** (`.agent/workflows/docs/`):

| Workflow                                                                            | Purpose                          | Status    |
| ----------------------------------------------------------------------------------- | -------------------------------- | --------- | --- |
| [docs-audit.md](../.agent/workflows/docs/docs-audit.md)                             | Documentation audit & governance | 🟢 Active |     |
| [docs-remediation.md](../.agent/workflows/docs/docs-remediation.md)                 | Fix documentation drift          | 🟢 Active |     |
| [docs-content-collections.md](../.agent/workflows/docs/docs-content-collections.md) | Generate content docs            | 🟢 Active |     |
| [gatekeeper-commit.md](../.agent/workflows/docs/gatekeeper-commit.md)               | Unified commit gatekeeper        | 🟢 Active |     |
| [landing-page-maintenance.md](../.agent/workflows/docs/landing-page-maintenance.md) | Landing page fixes               | 🟢 Active |     |
| [sync-framework.md](../.agent/workflows/docs/sync-framework.md)                     | Base sync pattern                | 🟢 Active |     |
| [README.md](../.agent/workflows/docs/README.md)                                     | Docs workflows guide             | 🟢 Active |

**Other Active Workflows**:

| Workflow                                                                                   | Purpose              | Status    |
| ------------------------------------------------------------------------------------------ | -------------------- | --------- |
| [align-gerardo-styles.md](../.agent/workflows/align-gerardo-styles.md)                     | Gerardo 60 theme     | 🟢 Active |
| [jewelry-box-remediation.md](../.agent/workflows/jewelry-box-remediation.md)               | Jewelry Box fixes    | 🟢 Active |
| [landing-page-theme-abstraction.md](../.agent/workflows/landing-page-theme-abstraction.md) | Landing theme work   | 🟢 Active |
| [theme-architecture-governance.md](../.agent/workflows/theme-architecture-governance.md)   | Theme governance     | 🟢 Active |
| [workflow-sync.md](../.agent/workflows/workflow-sync.md)                                   | Workflow maintenance | 🟢 Active |
| [skills-sync.md](../.agent/workflows/skills-sync.md)                                       | Skills maintenance   | 🟢 Active |
| [error-remediation.md](../.agent/workflows/error-remediation.md)                           | Error fixes          | 🟢 Active |
| [prompt-to-workflow.md](../.agent/workflows/prompt-to-workflow.md)                         | Workflow creation    | 🟢 Active |

### Archived Workflows (7)

All archived workflows are in `.agent/workflows/archive/`:

| Workflow                            | Archived Date | Replacement                      |
| ----------------------------------- | ------------- | -------------------------------- |
| atomic-ui-commit.md                 | 2026-02-12    | gatekeeper-commit.md (--strict)  |
| safe-commit.md                      | 2026-02-12    | gatekeeper-commit.md (--minimal) |
| landing-page-remediation.md         | 2026-02-12    | landing-page-maintenance.md      |
| landing-page-regression-recovery.md | 2026-02-12    | landing-page-maintenance.md      |
| docs-audit.md (old)                 | 2026-02-12    | docs/docs-audit.md               |
| invitation-execution.md             | 2026-02-12    | N/A (completed)                  |
| invitation-verification.md          | 2026-02-12    | N/A (integrated)                 |

---

## Recent Changes

### 2026-02-12 - Documentation Governance Phase

**Critical Fixes:**

- ✅ Added 'luxury-hacienda' to Quote variant schema
- ✅ Fixed preset isolation violation (moved styles to sections)
- ✅ Created CONTENT_COLLECTIONS.md

**High Priority:**

- ✅ Replaced all file:// links with relative paths (11 links)
- ✅ Archived 7 duplicate workflows
- ✅ Added type safety to family/gifts/gallery/thankYou variants
- ✅ Consolidated gatekeepers into gatekeeper-commit.md

**Medium Priority:**

- ✅ Fixed test schema (added 'cumple' to eventType enum)
- ✅ Created DOC_STATUS.md (this file)

---

## Known Issues

### Medium Priority (9 remaining)

1. **MED-001**: Hardcoded color values in theme files
    - Files: `_quote-theme.scss`, `_countdown-theme.scss`, `_location-theme.scss`
    - Impact: Technical debt
    - Action: Replace with semantic tokens

2. **MED-003**: Missing cross-references between docs
    - Impact: Navigation difficulty
    - Action: Add "See Also" sections

3. **MED-004**: Implementation log outdated
    - File: `docs/implementation-log.md`
    - Action: Update with recent changes

4. **MED-005**: No automated link checking
    - Impact: Broken links go undetected
    - Action: Add CI check

5. **MED-006**: Workflow categorization inconsistent
    - Impact: Confusion
    - Action: Standardize tags

6. **MED-007**: Missing TSDoc in examples
    - Impact: Poor DX
    - Action: Add documentation

7. **MED-009**: Plan documents need archiving
    - Location: `docs/plan/`
    - Action: Move completed plans to archive

8. **MED-010**: Inconsistent filename conventions
    - Impact: Navigation
    - Action: Standardize on kebab-case

9. **MED-011**: No review dates on docs
    - Impact: Staleness
    - Action: Add "Last Reviewed" headers

10. **MED-012**: Dependencies not documented
    - Impact: Maintainability
    - Action: Add dependency graph

---

## Maintenance Schedule

### Monthly (Automated)

- [ ] Run `docs-audit.md` workflow
- [ ] Check for broken links
- [ ] Verify schema synchronization
- [ ] Update this dashboard

### Quarterly (Manual)

- [ ] Review all Medium priority issues
- [ ] Archive obsolete documentation
- [ ] Update skill documentation
- [ ] Review workflow effectiveness

### Per Release

- [ ] Verify all 🔴 Critical issues resolved
- [ ] Update CHANGELOG.md
- [ ] Review and update all docs
- [ ] Run full documentation audit

---

## Quick Links

### Critical Documentation

- [Architecture](./ARCHITECTURE.md)
- [Content Collections](./CONTENT_COLLECTIONS.md)
- [Premium UX Vision](./PREMIUM_UX_VISION.md)
- [Theme System](./THEME_SYSTEM.md)

### Guides

- [Asset Registry Guide](./ASSET_REGISTRY_GUIDE.md)
- [Testing Guide](./TESTING.md)
- [Stability Report](./STABILITY.md)

### Workflow Documentation

- [Docs Workflows](../.agent/workflows/docs/README.md)
- [Audit Report](./audit/audit-report-2026-02-12.md)

---

## How to Use This Dashboard

1. **For New Team Members**: Start with Core Documentation Status
2. **For Maintenance**: Check Recent Changes and Known Issues
3. **For Planning**: Review Maintenance Schedule
4. **For Questions**: See Quick Links

---

## Contributing

To update this dashboard:

1. Run `docs-audit.md` workflow
2. Update the relevant sections
3. Update "Last Updated" date
4. Commit with message: `docs: Update DOC_STATUS.md`

---

**Next Actions:**

- [ ] Address remaining Medium priority issues
- [ ] Set up automated link checking (MED-005)
- [ ] Archive completed plan documents (MED-009)
- [ ] Add review dates to all docs (MED-011)

---

_This dashboard is automatically updated by the documentation audit system._
