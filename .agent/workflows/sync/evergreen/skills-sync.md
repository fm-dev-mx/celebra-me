---
description:
    Audits and synchronizes agent skills with the project's current state following the sync
    framework pattern.
lifecycle: evergreen
domain: sync
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 💎 Workflow: Skills Sync & Alignment

**Framework**: Follows the universal sync pattern from `.agent/workflows/docs/sync-framework.md`

---

## Phase 0: SCAN - Inventory Current Skills

**Purpose**: Create comprehensive inventory of all agent skills

**Steps:**

1. **List all skill files**

    ```bash
    find .agent/skills -name "*.md" -type f | sort
    ```

2. **Extract metadata**
    - Skill name (from frontmatter `name` field)
    - Description (from frontmatter `description` field)
    - Last modified date
    - Dependencies and related skills
    - File structure and organization

3. **Categorize skills**
    - **Design**: frontend-design, animation-motion, accessibility
    - **Development**: astro-patterns, testing
    - **Content**: copywriting-es, seo-metadata
    - **Cross-cutting**: accessibility (applies to all categories)

---

## Phase 1: CROSS-REFERENCE - Identify Drift

**Purpose**: Compare skills against architectural sources of truth

**Source of Truth:**

- `docs/ARCHITECTURE.md` - Architectural patterns and constraints
- `docs/PREMIUM_UX_VISION.md` - Design direction and premium standards
- `docs/THEME_SYSTEM.md` - Theme architecture and token system
- `src/content/config.ts` - Actual schema implementation

**Drift Checks:**

1. **Structural Validation**
    - Verify YAML frontmatter has required fields: `name`, `description`
    - Check for absolute vs relative links (prefer relative)
    - Validate skill references to other skills use correct paths

2. **Technical Alignment**
    - **Color Architecture**: Enforce 3-Layer Architecture (tokens → semantic → component)
    - **Motion Patterns**: Enforce Jewelry Box patterns (`premiumFadeUp`, consistent easing)
    - **SCSS Standards**: Prioritize design tokens over hex values
    - **Component Patterns**: Align with current Astro/React component patterns

3. **Coverage Gaps**
    - Identify missing skills for current architecture
    - Check for outdated patterns no longer in use
    - Verify skill abilities match current implementation needs

4. **Implementation Consistency**
    - Compare skill instructions with actual code in `src/`
    - Ensure examples match current APIs and interfaces
    - Validate code snippets compile with current tooling

---

## Phase 2: CATEGORIZE - Assign Severity Levels

**Severity Matrix:**

| Level    | Icon | Criteria                 | Examples                                          |
| -------- | ---- | ------------------------ | ------------------------------------------------- |
| Critical | 🔴   | Breaking/blocking issues | Skill leads to broken builds, schema mismatch     |
| High     | 🟠   | Significant impact       | Outdated patterns, missing critical abilities     |
| Medium   | 🟡   | Should fix               | Formatting, minor inconsistencies, stale examples |
| Synced   | 🟢   | Verified alignment       | Skill matches all architecture and implementation |

**Categorization Rules:**

- **🔴 Critical**: Skill instructions cause build/test failures, major schema mismatches
- **🟠 High**: References deprecated patterns, missing abilities needed for current work
- **🟡 Medium**: Style inconsistencies, minor example drift, formatting issues
- **🟢 Synced**: All checks pass, follows current architecture and patterns

---

## Phase 3: REPORT - Document Findings

**Required Output:**

1. **Executive Summary**
    - Total skills audited
    - Count by severity level
    - Overall architecture alignment score

2. **Detailed Findings**
    - Skill-by-skill assessment
    - Specific drift descriptions with code examples
    - Recommended updates with **Architect's Rationale**

3. **Remediation Plan**
    - Priority 1: Critical schema/architecture mismatches
    - Priority 2: High impact pattern updates
    - Priority 3: Medium consistency improvements

**Report Template:**

```markdown
# Skills Sync Report - YYYY-MM-DD

## Summary

- Skills Audited: <N>
- 🔴 Critical: <N>
- 🟠 High: <N>
- 🟡 Medium: <N>
- 🟢 Synced: <N>

## Architecture Alignment

[Assessment of each skill against current architecture]

## Critical Findings

[Detailed list with code examples]

## Remediation Timeline

- Week 1: Critical schema/architecture fixes
- Week 2: High priority pattern updates
- Ongoing: Medium consistency improvements
```

---

## Phase 4: REMEDIATE - Apply Fixes (Optional)

**When to Remediate:**

- Auto-fix: Medium severity formatting, link updates
- Manual fix: Critical/High severity (requires architectural review)
- Defer: Major skill redesigns (create enhancement workflow)

**Remediation Actions:**

1. **Frontmatter & Structure**
    - Fix YAML frontmatter formatting
    - Update absolute/relative links
    - Add missing required fields

2. **Technical Updates**
    - Update color architecture references to 3-Layer model
    - Align motion patterns with Jewelry Box standards
    - Replace hex values with design tokens
    - Update code examples to current APIs

3. **Content Cleanup**
    - Remove redundant or obsolete instructions
    - Consolidate overlapping guidance
    - Add missing cross-references to related skills

4. **Architecture Alignment**
    - Ensure skill follows current architectural decisions
    - Update references to changed patterns
    - Verify examples work with current toolchain

**Verification:**

- Run build/lint checks if scripts or schemas changed
- Test updated code examples
- Validate skill still achieves its intended purpose
- Update report with remediation status

---

## Automation Opportunities

**Available Scripts** (see `scripts/`):

- **Link validation**: `scripts/check-links.sh` – scans all `.md` files for broken internal links
  (including skills).

    ```bash
    bash scripts/check-links.sh
    ```

- **Stale file detection**: `scripts/find-stale.sh <days>` – identifies skill files older than
  specified days.

    ```bash
    bash scripts/find-stale.sh 90  # 3 months
    ```

- **Schema validation**: `scripts/validate-schema.js` – ensures theme variants align with Zod schema
  (for skills referencing theme system).

**High-Value Automation (Ad‑hoc):**

```bash
# Validate frontmatter structure
find .agent/skills -name "*.md" -exec grep -l "---" {} \; | while read f; do validate_frontmatter "$f"; done

# Check for absolute links
grep -r "http://\|https://" .agent/skills/ --include="*.md" | grep -v "example.com\|transparenttextures.com"

# Find hex color values that should be tokens
grep -r "#[0-9a-fA-F]\{6\}\|#[0-9a-fA-F]\{3\}" .agent/skills/ --include="*.md" | grep -v "example"
```

**Manual Review Required:**

- Architectural pattern compliance
- Conceptual accuracy of skill guidance
- Judgment on pattern evolution
- Integration with other skills

---

## Frequency & Integration

**Recommended Schedule:**

- **Quarterly**: Full architecture alignment audit
- **After major changes**: When architecture or patterns evolve significantly
- **Pre-release**: Verify critical skills are current

**Integration Points:**

- **Before Sync**: Architecture decisions documented and stable
- **After Sync**: Update skill documentation, notify dependent workflows
- **Team Coordination**: Critical findings may impact multiple team members

---

## Success Metrics

**Quantitative:**

- % of skills synced (🟢)
- Time to update skills after architecture changes
- Number of broken examples (target: 0)
- Token vs hex usage ratio

**Qualitative:**

- Agent effectiveness using updated skills
- Consistency across skill implementations
- Architecture comprehension through skills

// turbo

> [!IMPORTANT] Skills define agent capabilities - keep them aligned with current architecture.
> Always verify Critical findings with architectural review.
