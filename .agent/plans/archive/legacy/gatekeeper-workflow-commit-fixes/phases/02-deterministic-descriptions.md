# Phase 02: Removal of Hardcoded Logic (AI Diff Integration)

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Eliminate the brittle, hardcoded `buildFileBulletDescription` switch statements and instead pass clean, truncated git diffs to the AI payload.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

- **Brittle Determinism:** `commit-message-analysis.mjs` attempts to guess file changes based merely on file paths (e.g. matching `src/lib/presenters/`). This causes hallucinated commit messages.
- **Better Alternative:** Standard LLM AI tools excel at reading `git diff` outputs. We just need to feed the AI the real diff, capped to a safe length.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### 1. Simplify Deterministic Fallback

- [x] Rip out the path-based deterministic descriptions (`buildFileBulletDescription` and associated logic) inside `commit-message-analysis.mjs`. (20% of Phase)
- [x] **[ADDED]** Replace the ripped out logic with a tiny, 3-line generic fallback switch (status based, e.g., `add [file] implementation`, `modify [file] settings`) to prevent undefined errors when AI is disconnected. (10% of Phase)

### 2. Diff Extraction & AI Prompting

- [x] Implement a function to extract the actual `git diff --cached` string for the staged changes within the gatekeeper workflow. (30% of Phase)
- [x] Truncate this diff string to a safe limit (e.g., 2000-3000 chars) and securely serialize it to prevent JSON/API breakage from special characters or backticks. (20% of Phase)
- [x] Update `ai-title-assist.mjs` or the prompt payload template to instruct the AI to read the raw diff and generate accurate, concise bullet points natively. (20% of Phase)

---

## ✅ Acceptance Criteria

- [x] Hallucinated path-based descriptions are completely removed from the workflow script.
- [x] The underlying AI prompt uses actual source-code differences to generate commit recommendations.
- [x] Large commits do not crash the script due to unbound `git diff` sizes.

---

## 📎 References

- [{commit-message-analysis.mjs}](../../governance/bin/commit-message-analysis.mjs)
- [{ai-title-assist.mjs}](../../governance/bin/ai-title-assist.mjs)
