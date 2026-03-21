# 🏛️ Gatekeeper Workflow Simplification & Commit Fixes

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Eliminate overengineering in the gatekeeper commit workflow. Focus on relaxing rigid `commitlint` rules, removing brittle hardcoded context generators, and relying on standard AI diff summaries to ensure a robust, low-friction developer experience.

**Estimated Duration:** 3 phases / ~1.5 days
**Owner:** fm-dev-mx
**Created:** 2026-03-17

---

## 🎯 Scope

### In Scope

- **Commitlint Simplification:** Relaxing `header-max-length` and removing hyper-specific custom body/bullet rules from `commitlint.config.cjs` to reduce friction.
- **Removing Deterministic Hallucinations:** Stripping out the complex, hardcoded path matching in `buildFileBulletDescription` inside `commit-message-analysis.mjs`.
- **AI-Driven Diff Summaries:** Modifying `ai-title-assist.mjs` to digest raw, constrained `git diff` outputs instead of relying on broken deterministic textual prompts.
- **Workflow Cleanup:** Ensuring the end-to-end `gatekeeper-commit` workflow functions smoothly with these reduced constraints.

### Out of Scope

- Fully rewriting the `gatekeeper.mjs` AST parsing or broader architectural linting inside the inspect phase (to be addressed in a separate governance scope).
- Completely removing Husky or `commitlint` (we want them, just less strict).

---

## 🔴 Blockers & Risks

| Risk / Blocker    | Severity | Mitigation                                                                                                                                                   |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Context Overflow  | High     | Truncate raw diff inputs fed into AI prompts to prevent Node or API argument limits from crashing the workflow (e.g., maximum 2000 chars).                  |
| AI Hallucinations | Med      | Explicitly prompt the AI to only output factual bullet points based strictly on the provided git diff.                                                      |

---

## 🗺️ Phase Index

| #   | Phase                                                                          | Weight | Status    |
| --- | ------------------------------------------------------------------------------ | ------ | --------- |
| 01  | [Commitlint Rule Simplification](./phases/01-scope-and-truncation.md)          | 30%    | `COMPLETED` |
| 02  | [Removal of Hardcoded Descriptions](./phases/02-deterministic-descriptions.md) | 40%    | `COMPLETED` |
| 03  | [Validation & Workflow Cleanup](./phases/03-validation-testing.md)             | 30%    | `COMPLETED` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
