---
description:
    Comprehensive audit and standardization of Husky Git hooks to enforce high architectural and
    code quality standards.
---

# 💎 Workflow: Husky & Git Hooks Standardization

This workflow guides the Senior Engineer in establishing a robust Git hook strategy to prevent
architectural drift and ensure that only high-quality, linted, and tested code enters the
repository.

## 🎯 Objective

Transform the current basic Husky setup into a production-grade gatekeeper system using `husky`,
`lint-staged`, and standard verification scripts.

## 🛠️ Execution Steps

### 1. Contextual Audit & Ground Truth

- Inspect `.husky/` directory for existing hooks.
- Identify core quality scripts in `package.json` (`lint`, `format`, `test`, `type-check`).
- **Goal**: Identify what is strictly necessary to run before a commit without killing developer
  velocity.

### 2. Dependency Injection (If needed)

// turbo

- Ensure `lint-staged` is installed: `pnpm add -D lint-staged`.
- (Optional) Install `commitlint` if conventional commits are required.

### 3. Strategy Configuration

- Define `lint-staged` rules in `package.json`:

    ```json
    "lint-staged": {
      "*.{js,ts,tsx,astro}": [
        "eslint --fix",
        "prettier --write"
      ],
      "*.{scss,css}": [
        "prettier --write"
      ]
    }
    ```

- **Architectural Check**: Decide if `astro check` or `npm test` should run on `pre-commit` (global)
  or if they should be deferred to CI. _Recommendation_: Run `pnpm lint-staged` on pre-commit and
  keep heavy checks for CI or a specific `pre-push` hook.

### 4. Hook Implementation

- Update `.husky/pre-commit`:

    ```bash
    npx lint-staged
    ```

- (Optional) Create `.husky/commit-msg` for `commitlint`.

### 5. Verification & QA

- **Positive Test**: Make a small valid change and attempt to commit.
- **Negative Test**: Introduce a linting error and verify the commit is blocked.
- **Visual QA**: Ensure the output in the terminal is clean and informative.

## 📝 Critical Reflection (Architect's Perspective)

- **Performance**: Does this add more than 5 seconds to the commit process? If so, optimize.
- **Friction**: Ensure devs know how to use `--no-verify` for emergencies, but discourage its
  routine use.
- **Compatibility**: Ensure hooks work across Windows (PowerShell/CMD) and Unix environments.

## 🏁 Deployment

- Move this workflow to `archive/` once the system is stable if this was a one-time task, or keep as
  **Evergreen** if it serves as the project's Hook Standard.
