# Phase 01: Diagnostic Automation

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Create utility scripts to automate error classification and context extraction,
minimizing agent token usage and improving diagnostic accuracy.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

Currently, the `error-remediation.md` workflow requires the agent to manually parse raw terminal
output and load entire files using `view_file`.

1. **Token Waste:** Viewing an 800-line Astro component to fix a single type error consumes
   unnecessary tokens.
2. **Inconsistent RCA:** Free-form log reading leads to inconsistent Root Cause Analysis. Some
   agents correctly identify the failing line, others guess based on the file name.
3. **Missing Tooling:** The project has `.agent/scripts/remediate-history.mjs` but lacks scripts for
   daily workflow support.

This phase introduces two Node.js scripts (`.mjs`) to act as the "Diagnostic Engine" for the new
workflow.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Script 1: Error Classifier (`error-classifier.mjs`)

- [ ] Scaffold `.agent/scripts/error-classifier.mjs` (20% of Phase)
- [ ] Implement robust Regex parsers for common tool outputs:
    - [ ] TypeScript (`tsc` / `astro check`)
    - [ ] Astro Build (`astro build`)
    - [ ] Jest / Playwright
    - [ ] ESLint / Stylelint
- [ ] Design JSON output schema (`DiagnosticReport`):
    - `tool`: string
    - `type`: string (e.g., `type-error`, `hydration-mismatch`)
    - `file`: string (absolute path)
    - `line`: number
    - `column`: number
    - `message`: string
    - `snippet`: string (max 5 lines of stack trace)
- [ ] Add support for reading from `stdin` or a file path argument. (10% of Phase)

### Script 2: Context Extractor (`context-extractor.mjs`)

- [ ] Scaffold `.agent/scripts/context-extractor.mjs` (10% of Phase)
- [ ] Implement file reading with `fs` and line-number targeting.
- [ ] Add `radius` parameter (default `±10` lines). (10% of Phase)
- [ ] Format output to include line numbers for the agent (e.g., `144: const x = 1;`).
- [ ] Ensure graceful degradation if line number is out of bounds or file doesn't exist.

---

## ✅ Acceptance Criteria

- [ ] `node .agent/scripts/error-classifier.mjs` correctly parses a sample TypeScript error into the
      `DiagnosticReport` JSON format.
- [ ] `node .agent/scripts/error-classifier.mjs` correctly categorizes Astro hydration errors.
- [ ] `node .agent/scripts/context-extractor.mjs src/pages/index.astro 45` prints lines 35-55 with
      line numbers prepended.
- [ ] Both scripts handle invalid input (empty stdin, missing files) without crashing the agent
      workflow.

---

## 📎 References

- [Planning Governance Framework](../../README.md)
