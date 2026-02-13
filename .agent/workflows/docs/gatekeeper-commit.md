---
description: Unified commit gatekeeper with strict and minimal modes.
---

# 🔒 Workflow: Gatekeeper Commit

**Modes:**

- `--strict` (default): Full Atomic Deployable Unit enforcement
- `--minimal`: Staged-only quick check

---

## 1. Authority & Scope

**Source of Truth:**

- `.agent/GATEKEEPER_RULES.md`
- `.agent/PROJECT_CONVENTIONS.md`
- `docs/ARCHITECTURE.md`

**Scope Definition:**

- `--strict`: Staged + unstaged changes (comprehensive)
- `--minimal`: `git diff --cached` only (staged only)

---

## 2. Universal Guards (All Modes)

### 2.1 Blockers (Never Bypass)

These prevent commit regardless of mode:

- [ ] **Repo must stay deployable** - No breaking changes
- [ ] **No inline styles** - No `style="..."` attributes
- [ ] **No utility CSS** - No Tailwind classes
- [ ] **Astro boundaries respected** - Server/client separation
- [ ] **Linux/Vercel casing** - Correct path casing
- [ ] **Logs only in `logs/`** - No console.log in production code
- [ ] **No secrets in code** - Env vars for sensitive data

### 2.2 Quality Gates

- [ ] **JSDoc/TSDoc**: English for complex logic
- [ ] **Conventional Commits**: Format + descriptive "why"
- [ ] **Anti-noise**: No trivial comments
- [ ] **SCSS BEM**: Proper naming, max 3 nesting levels
- [ ] **TypeScript**: No `any` without justification

---

## 3. Mode: Strict (Default)

Use for: Feature development, refactors, significant changes

### Phase 0: Comprehensive Scope

1. **Scan all changes**

    ```bash
    git status
    git diff --name-status
    ```

2. **Classify changes**
    - Docs only → Fast track (minimal checks)
    - Code/Config → Full validation
    - Mixed → Split into separate commits if possible

3. **Detect mixed intents**
    - One logical change per commit
    - Split if unrelated files grouped

### Phase 1: Decompose into ADUs

**Atomic Deployable Unit (ADU):** A single coherent change that:

- Can be deployed independently
- Doesn't break the build
- Can be reverted cleanly

**Rules:**

- 1 ADU = 1 commit
- ADUs are independent
- Sequence matters if dependencies exist

**Example ADUs:**

```text
ADU 1: Add new theme variant CSS
ADU 2: Update component to use variant
ADU 3: Update schema to support variant
ADU 4: Update documentation
```

### Phase 2: Execute per ADU

For each ADU:

1. **Isolate**: Stage only ADU files

    ```bash
    git add <adu-files>
    ```

2. **Auto-fix** (if approved):
    - Lint fixes
    - Formatting
    - Import ordering

3. **Validate**:

    ```bash
    pnpm lint
    pnpm check
    pnpm test  # if tests exist for changed code
    ```

4. **Propose commit**:

    ```text
    type(scope): Description in imperative mood

    - What changed (brief)
    - Why it changed (context)
    - Impact (if breaking)

    ADU: <name>
    ```

5. **Confirm & commit** after approval

### Phase 3: Verification

- [ ] All ADUs committed
- [ ] `git status` clean (or intentional leftovers)
- [ ] Build passes: `pnpm build`

---

## 4. Mode: Minimal

Use for: Hotfixes, documentation updates, trivial changes

### Phase 0: Staged Scope Lock

1. **Check staged files only**

    ```bash
    git diff --name-status --cached
    ```

2. **If empty**: STOP - nothing to commit

3. **Classify**:
    - Docs only → Skip code checks
    - Code → Run essential checks only

### Phase 1: Quick Diagnose

**Findings severity:**

- **Blocker**: Must fix before commit
- **Should**: Should fix but can proceed
- **FYI**: Informational

**Check for:**

- Inline styles (`style=`)
- Utility CSS classes
- Logging outside `logs/`
- Missing TSDoc on complex functions
- SCSS anti-patterns (`!important`, deep nesting)
- Hardcoded values instead of tokens

### Phase 2: Minimal Fix (Optional)

- Propose fixes for blockers only
- Apply only if explicitly approved
- Re-stage after fixes: `git add <files>`

### Phase 3: Ready to Commit

- Propose Conventional Commit message
- Summarize what & why
- Confirm before executing

---

## 5. Decision Matrix

| Scenario            | Recommended Mode        |
| ------------------- | ----------------------- |
| Documentation only  | `--minimal`             |
| One-liner fix       | `--minimal`             |
| New feature         | `--strict`              |
| Refactoring         | `--strict`              |
| Theme/Style changes | `--strict`              |
| Schema changes      | `--strict`              |
| Hotfix (urgent)     | `--minimal`             |
| Mixed changes       | `--strict` + split ADUs |

---

## 6. Common Patterns

### 6.1 Documentation Update

```bash
# Mode: --minimal
git add docs/
# Check: Links, formatting
# Commit: docs: Update X documentation
```

### 6.2 New Component

```bash
# Mode: --strict
# ADU 1: Component implementation
# ADU 2: Styles
# ADU 3: Tests
# ADU 4: Documentation
```

### 6.3 Theme Variant

```bash
# Mode: --strict
# ADU 1: CSS variant
# ADU 2: Schema update
# ADU 3: Example usage
# ADU 4: Documentation
```

---

## 7. Migration from Old Workflows

**Replacing `atomic-ui-commit.md`:**

- Use `--strict` mode
- All phases identical
- Same ADU approach

**Replacing `safe-commit.md`:**

- Use `--minimal` mode
- Faster, staged-only
- Same safety checks

**Archive Note:** The old workflows are superseded by this unified version. Update any references:

- `atomic-ui-commit.md` → `gatekeeper-commit.md` (--strict)
- `safe-commit.md` → `gatekeeper-commit.md` (--minimal)

---

## 8. Troubleshooting

### Too Many ADUs

If strict mode creates >5 ADUs:

- Consider splitting into multiple PRs
- Group related ADUs if truly atomic
- Use feature branch workflow

### Blockers in Minimal Mode

If minimal mode finds blockers:

- Switch to strict mode for proper ADU decomposition
- Or fix blockers and retry minimal

### Mixed Changes Confusion

When docs + code mixed:

- Default to strict mode
- Create separate ADU for docs
- Ensures clean history

// turbo

> [!IMPORTANT] Start with --minimal for docs/quick fixes. Use --strict for all code changes. When in
> doubt, use --strict - it prevents technical debt.
