---
description: Remediation execution for documentation drift and inconsistencies.
---

# 🔧 Workflow: Documentation Remediation

Use this workflow AFTER `docs-audit.md` has identified drift. Do not remediate without audit
findings.

---

## 1. Pre-Remediation Setup

### 1.1 Input Requirements

Before starting, you MUST have:

- [ ] Audit report with specific findings (`docs/audit/audit-report-*.md`)
- [ ] Categorized issues (🔴🟠🟡)
- [ ] Affected file paths clearly identified
- [ ] Remediation scope agreed upon

### 1.2 Safety Protocol

- [ ] Create feature branch: `git checkout -b docs/remediation-YYYY-MM-DD`
- [ ] Run baseline checks: `pnpm check` (document current state)
- [ ] Backup critical docs if major rewrites expected

---

## 2. Critical Issues (🔴) - Fix First

### 2.1 Schema Mismatch Resolution

**Problem**: CSS variant exists but not in Zod schema

**Steps:**

1. Identify missing variant in `src/content/config.ts`
2. Add to appropriate enum:
    ```typescript
    variant: z.enum(['existing', 'NEW_VARIANT', 'others']);
    ```
3. Update discriminated union if needed
4. Run `pnpm check` to verify
5. Update `docs/THEME_SYSTEM.md` variant table

**Example:**

```typescript
// In src/content/config.ts
quote: z.object({
	variant: z.enum(['elegant', 'modern', 'minimal', 'floral', 'jewelry-box', 'luxury-hacienda']), // Add missing
	// ...
});
```

### 2.2 Preset Isolation Violation

**Problem**: Preset file contains direct CSS styles

**Steps:**

1. Move styles FROM: `src/styles/themes/presets/_<preset>.scss`
2. Move styles TO: `src/styles/themes/sections/_<section>-theme.scss`
3. Use `[data-variant="<name>"]` selectors in sections
4. Keep ONLY CSS variables in preset file
5. Test both presets for regression

**Migration Pattern:**

```scss
// FROM (preset) - REMOVE:
.theme-preset--luxury-hacienda {
	h1 {
		font-family: tokens.$font-heading-hacienda;
	} // ❌
}

// TO (section) - ADD:
.section[data-variant='luxury-hacienda'] {
	h1 {
		font-family: var(--font-heading);
	} // ✅
}
```

### 2.3 Missing Critical Documentation

**Problem**: Core system has no documentation

**Priority Creation Order:**

1. Content Collections (core business logic)
2. Theme System variants (if incomplete)
3. Asset Registry usage patterns

**Use**: `docs-content-collections.md` workflow for #1

---

## 3. High Issues (🟠) - Fix Next

### 3.1 Broken Internal Links

**Detection**: `grep -r "file://" docs/ .agent/workflows/`

**Remediation:**

```bash
# Find all file:// links
find docs .agent/workflows -name "*.md" -exec grep -l "file://" {} \;

# Replace with relative paths
# Before: [Link](file:///c:/Code/celebra-me/docs/file.md)
# After:  [Link](./file.md)
```

### 3.2 Obsolete Workflow References

**Detection**: References to `archive/` or deleted workflows

**Remediation:**

1. Identify references: `grep -r "archive/" .agent/workflows/*.md`
2. Update to current workflow OR remove reference
3. If workflow archived, update to successor workflow
4. If workflow deleted, remove reference entirely

### 3.3 Outdated Code Examples

**Common Issues:**

- Using `@import` instead of `@use` in SCSS
- Old JSON schema structure
- Deprecated component props

**Fix Pattern:**

1. Locate outdated example in doc
2. Find current implementation in `src/`
3. Copy actual working code
4. Update doc with current syntax
5. Verify example compiles/runs

---

## 4. Medium Issues (🟡) - Polish

### 4.1 Formatting Consistency

- Standardize on kebab-case for filenames
- Consistent heading levels (# for title, ## for sections)
- Standardize code block languages (typescript, scss, json)

### 4.2 Example Improvements

- Add TSDoc to complex TypeScript examples
- Ensure SCSS examples use semantic tokens
- JSON examples should be copy-paste ready

---

## 5. Workflow Consolidation

### 5.1 Identify Duplicates

Look for workflows with:

- Same target (landing page, theme, etc.)
- Similar steps (Phase 0 audit, Phase 1 fix)
- Overlapping responsibilities

### 5.2 Merge Strategy

1. Compare workflows side-by-side
2. Create consolidated version with all unique steps
3. Use flags for different modes (strict/minimal)
4. Update references in other docs
5. Archive old workflows with reference to new one

**Example Merge:**

```markdown
# gatekeeper-commit.md (merged)

## Modes

- `--strict`: Full Atomic UI Commit checks
- `--minimal`: Staged-only safe commit
```

### 5.3 Archive Process

For obsolete workflows:

1. Move to `.agent/workflows/archive/`
2. Add header:

    ```markdown
    ---
    description: ARCHIVED - Merged into <new-workflow>.md
    archived: YYYY-MM-DD
    ---

    # [ARCHIVED] Old Workflow Name

    > This workflow has been archived. Use `<new-workflow>.md` instead.
    ```

3. Update all references pointing to archived workflow

---

## 6. Verification Protocol

### 6.1 Post-Remediation Checks

After each fix category:

**For Schema Fixes:**

```bash
pnpm check
pnpm build 2>&1 | head -50
```

**For Link Fixes:**

```bash
# Verify no file:// remain
grep -r "file://" docs/ .agent/workflows/ || echo "✅ No file:// links found"
```

**For Code Examples:**

- Copy example from docs
- Paste into test file
- Verify compiles without errors

### 6.2 Regression Testing

**Theme Changes:**

1. Test affected preset across multiple events
2. Verify no style bleeding between presets
3. Check both desktop and mobile views

**Documentation Changes:**

1. Read through updated docs
2. Follow setup instructions as written
3. Verify all links work

---

## 7. Finalization

### 7.1 Update Status

- [ ] Update audit report with remediation status
- [ ] Update `docs/STABILITY.md` or `docs/DOC_STATUS.md`
- [ ] Mark fixed issues as resolved (🟢)

### 7.2 Commit Changes

```bash
# Group related changes
git add docs/
git commit -m "docs: Remediate schema mismatches and broken links

- Fix luxury-hacienda variant missing from quote schema
- Replace file:// links with relative paths
- Archive obsolete workflows

Refs: audit-report-YYYY-MM-DD.md"
```

### 7.3 Cleanup

- [ ] Delete feature branch after merge
- [ ] Remove backup files
- [ ] Update project changelog if significant

// turbo

> [!IMPORTANT] Never remediate without audit findings. Always verify with `pnpm check` after schema
> changes. Test theme changes across multiple presets before committing.
