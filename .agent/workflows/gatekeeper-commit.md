---
description: 'Workflow for committing code with gatekeeper'
---

# 🔒 Workflow: Gatekeeper Commit

**Modes:**

- `--strict` (default): Full enforcement (Lint + Types + Forbidden Files)
- `--minimal`: Fast check (Lint + Forbidden Files only)

---

## 1. Quick Start

**Run the automated gatekeeper:**

```bash
pnpm gatekeeper
# OR
pnpm gatekeeper --mode minimal
```

---

## 2. Authority & Scope

**Source of Truth:**

- `.agent/GATEKEEPER_RULES.md`
- `scripts/gatekeeper.js`

---

## 3. Workflow Steps

### Phase 1: Stage Changes

Stage the files you intend to commit.

```bash
git add <files>
```

### Phase 2: Run Gatekeeper

**For Features / Refactors (Default):**

```bash
pnpm gatekeeper
```

**For Docs / Hotfixes:**

```bash
pnpm gatekeeper --mode minimal
```

### Phase 3: Commit

If the gatekeeper passes, commit your changes:

```bash
git commit -m "type(scope): description"
```

---

## 4. Troubleshooting

- **Lint Errors:** Fix the issues reported by ESLint/Stylelint.
- **Type Errors:** Run `pnpm type-check` locally to debug.
- **Forbidden Files:** Unstage files like `.env` or `logs/`.

// turbo

> [!IMPORTANT] Always use `pnpm gatekeeper` before committing. It automates the checks defined in
> GATEKEEPER_RULES.md.
