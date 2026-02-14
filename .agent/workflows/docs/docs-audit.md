---
description:
    Documentation ecosystem governance with validation, drift detection, and remediation guidance.
lifecycle: evergreen
domain: docs
owner: docs-governance
last_reviewed: 2026-02-14
---

# 📚 Workflow: Documentation Audit & Governance

**Framework**: Follows the universal sync pattern from `.agent/workflows/docs/sync-framework.md`

## 1. Scope & Authority

**Source of Truth Hierarchy:**

1. `src/` - Implementation (Ground Truth)
2. `.agent/` - Agent rules & conventions
3. `docs/` - Architecture & technical documentation
4. `README.md` - Project overview

**Documents Under Audit:**

- **Critical**: `README.md`, `docs/PREMIUM_UX_VISION.md`, `docs/ARCHITECTURE.md`
- **System**: `docs/THEME_SYSTEM.md`, `docs/STABILITY.md`
- **Assets**: `docs/ASSET_REGISTRY_GUIDE.md`, `docs/ASSET_MANAGEMENT.md`
- **Implementation**: `docs/implementation-log.md`
- **Workflows**: `.agent/workflows/*.md`
- **Skills**: `.agent/skills/**/*.md`

---

## 2. Automated Validation Checks

### 2.1 Schema Synchronization

**Check**: Content collection schema matches CSS implementation

- [ ] Verify all CSS variants exist in `src/content/config.ts` Zod enums
- [ ] Ensure `sectionStyles` variants match available theme variants
- [ ] Validate discriminated unions (gifts, locations) are complete

**Files to Cross-Reference:**

- `src/content/config.ts` ↔️ `src/styles/themes/sections/*.scss`
- `src/styles/themes/presets/*.scss` ↔️ Theme variant implementations

### 2.2 Architecture Compliance

**Check**: Preset files follow isolation law

- [ ] Verify `src/styles/themes/presets/*.scss` contain ONLY CSS variables
- [ ] NO direct CSS rules, selectors (`.card`), or styles in preset files
- [ ] All visual styles must be in `src/styles/themes/sections/*.scss`

### 2.3 Code Example Validation

**Check**: Documentation examples are syntactically current

- [ ] JSON examples match current schema structure
- [ ] SCSS examples use `@use` not `@import`
- [ ] TypeScript examples match current interfaces
- [ ] Component prop examples match current API

### 2.4 Link Integrity

**Check**: All internal references are valid

- [ ] Markdown links point to existing files
- [ ] No `file://` protocol (use relative paths `./`)
- [ ] No references to archived workflows

### 2.5 Automation Scripts

**Available automation** (see `scripts/`):

- **Link validation**: `scripts/check-links.sh` – scans all `.md` files for broken internal links.
    ```bash
    bash scripts/check-links.sh
    ```
- **Stale file detection**: `scripts/find-stale.sh <days>` – identifies documentation files older
  than specified days.
    ```bash
    bash scripts/find-stale.sh 30
    ```
- **Schema validation**: `scripts/validate-schema.js` – compares Zod enum variants with CSS theme
  selectors.
    ```bash
    node scripts/validate-schema.js
    ```

**Usage in audit**:

1. Run link validation to identify broken references.
2. Run schema validation to detect CSS/Zod mismatches.
3. Run stale detection to flag outdated documentation.
4. Integrate findings into audit report.

---

## 3. Drift Detection Matrix

### 🔴 Critical (Block Release)

- Setup/architecture instructions lead to broken builds
- Schema mismatch between docs and implementation
- Missing critical documentation (e.g., no content collections guide)
- Preset files violating isolation law (direct CSS in presets)
- Broken internal links preventing navigation

### 🟠 High (Must Fix Soon)

- Outdated workflow references (pointing to archived files)
- Obsolete code examples (syntax/API drift > 1 month)
- Documentation claims features not yet implemented
- Workflow overlaps not consolidated

### 🟡 Medium (Should Fix)

- Minor formatting inconsistencies
- Examples using deprecated patterns (still work but not best practice)
- Missing TSDoc in complex examples
- Style inconsistencies across docs

### 🟢 Synced (Verified)

- Documentation matches implementation exactly
- All examples compile/test successfully
- Links verified functional

---

## 4. Remediation Guidance

**For each 🔴/🟠/🟡 finding, provide:**

### 4.1 Specific Fix Instructions

- Exact file paths to modify
- Code snippets showing required changes
- Line numbers for quick reference

### 4.2 Remediation Workflow Reference

- Point to specific remediation workflow if exists:
    - Theme issues → `theme-architecture-governance.md`
    - Code examples → Update docs directly
    - Schema mismatch → Update `src/content/config.ts` or CSS

### 4.3 Checklist for Developer

```markdown
- [ ] Fix identified in: `<file-path>`
- [ ] Updated: `<doc-file>`
- [ ] Verified with: `pnpm check` / `pnpm build`
- [ ] Tested: [manual/component test]
```

---

## 5. Lifecycle Management

### 5.1 Documentation Lifecycle

**Active**: Current, maintained, referenced by workflows

- Update in place for minor changes
- Version bump for major structural changes

**Archive**: Completed, obsolete, or superseded

- Move to `docs/archive/` after 6 months of inactivity
- Add header: `# ARCHIVED - <reason>`

**Delete**: Duplicated or fully deprecated

- Remove if completely superseded
- Update all references before deletion

### 5.2 Workflow Lifecycle

**Monitor for Obsolescence:**

- Workflows referencing archived docs
- Task workflows > 3 months without execution
- Duplicates identified during audit

**Consolidation Rules:**

- Merge workflows with >70% overlap
- Archive task-specific workflows after completion
- Update categorization tags

---

## 6. Reporting

### 6.1 Audit Report Generation

Create: `docs/audit/audit-report-YYYY-MM-DD.md`

**Structure:**

```markdown
# Documentation Audit Report - YYYY-MM-DD

## Executive Summary

- Total Documents Audited: <N>
- Critical Issues: <N> 🔴
- High Issues: <N> 🟠
- Medium Issues: <N> 🟡
- Synced: <N> 🟢

## Findings by Category

[Detailed list]

## Remediation Plan

- Priority 1 (Week 1): [🔴 items]
- Priority 2 (Week 2): [🟠 items]
- Priority 3 (Ongoing): [🟡 items]

## Workflow Status

- Active: <list>
- To Consolidate: <list>
- To Archive: <list>
```

### 6.2 Quick Status Dashboard

Append to `docs/STABILITY.md` or create `docs/DOC_STATUS.md`:

```markdown
## Documentation Health

| Document               | Status     | Last Verified |
| ---------------------- | ---------- | ------------- |
| PREMIUM_UX_VISION.md   | 🟢         | 2026-02-XX    |
| THEME_SYSTEM.md        | 🟡         | 2026-02-XX    |
| CONTENT_COLLECTIONS.md | 🔴 MISSING | -             |
```

---

## 7. Execution Steps

1. **Inventory**: List all docs/workflows under audit
2. **Validate**: Run automated checks (schema, links, examples)
3. **Detect**: Manual review for conceptual drift
4. **Categorize**: Assign 🔴🟠🟡🟢 ratings
5. **Report**: Generate audit report
6. **Remediate**: Follow `docs-remediation.md` for fixes
7. **Verify**: Re-run checks after remediation
8. **Close**: Update status dashboard

// turbo

> [!IMPORTANT] Run this audit: After major refactors, monthly during active development, or when
> adding new event types. Always verify Critical (🔴) findings before release.
