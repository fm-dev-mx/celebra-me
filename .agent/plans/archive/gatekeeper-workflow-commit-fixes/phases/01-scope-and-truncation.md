# Phase 01: Commitlint Rule Simplification

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Reduce friction and overengineering by relaxing strict commitlint length rules and removing excessively rigid custom body rules, solving the truncation and scope-length errors natively.

**Weight:** 30% of total plan

---

## 🎯 Analysis / Findings

- **Overengineered Rules:** `commitlint.config.cjs` enforces a massive amount of highly specific custom rules (`body-file-path-bullets`, `subject-dominant-change-match`, `body-bullet-group-coverage`).
- **Length Constraints:** The 100 character `header-max-length` clashes directly with the long domain scopes (e.g., `gov-plans-gatekeeper-commit-message-hardening`).
- **Friction over Functionality:** Attempting to dynamically truncate strings to appease these rules causes more bugs than it prevents.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### 1. Relax Length Constraints

- [x] Modify `commitlint.config.cjs` to increase `header-max-length` to `120` or `130` characters, eliminating the need to aggressively truncate long scope names. (30% of Phase)
- [x] Ensure `scope-enum` continues to correctly map to `domain-map.json` without fighting length issues. (20% of Phase)

### 2. Purge Hyper-Specific Custom Rules

- [x] Remove or disable the excessively strict custom body-bullet rules in `commitlint.config.cjs` (e.g., `body-file-path-bullets`, `body-no-ellipsis-paths`, `subject-dominant-change-match`, `body-bullet-description-quality`, `body-bullet-group-coverage`). (40% of Phase)
- [x] **[ADDED]** Remove dead environment variables (e.g., `COMMITLINT_FILE_GROUPS_JSON`, `COMMITLINT_DOMINANT_CHANGE_KIND`) injected by `scripts/validate-commits.mjs` that fed the now-deleted custom rules. (10% of Phase)

---

## ✅ Acceptance Criteria

- [x] Long scope domains can safely be committed without triggering the 100-character truncation errors.
- [x] Developers are no longer forced to strictly format every single un-staged bullet accurately down to the relative path string matching.
- [x] `commitlint` continues verifying basic branch conventions securely.

---

## 📎 References

- [{commitlint.config.cjs}](../../../commitlint.config.cjs)
