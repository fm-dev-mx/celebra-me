# Phase 02: Deterministic Scaffold and AI Title Assist

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Refactor scaffold generation around shared deterministic analysis and add optional AI
subject assist without changing CLI surface or validation ownership.

**Weight:** 35% of total plan

---

## 🎯 Analysis / Findings [STATUS: PENDING]

- Deterministic body generation must remain exact-per-file and status-aware for added, modified,
  renamed, and deleted paths.
- AI must only see structured summaries plus clipped diff snippets, not become the source of truth
  for commit coverage or validation.
- The workflow needs observable metadata such as `titleSource`, `baseSubject`, and `finalSubject`
  without breaking existing command usage.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Shared Analysis

- [ ] Add shared commit-message analysis helpers for file facts, dominant-change ranking, and deterministic subject generation (35% of Phase)
- [ ] Refactor workflow scaffold generation to use exact per-file bullets and status-aware descriptions (30% of Phase)

### Optional AI Assist

- [ ] Add provider-agnostic AI title assist with policy and env gating, structured payloads, and hard timeouts (20% of Phase)
- [ ] Ensure invalid AI output falls back to the deterministic subject before commitlint validation (15% of Phase)

---

## ✅ Acceptance Criteria

- [ ] The workflow produces exact per-file bullets for required bodies.
- [ ] Renamed and deleted files are represented with the correct path semantics.
- [ ] The workflow functions fully with zero AI configuration.
- [ ] AI assist can refine only the subject fragment and records whether the final title was deterministic or AI-assisted.

---

## 📎 References

- [.agent/governance/bin/gatekeeper-workflow.mjs](../../../governance/bin/gatekeeper-workflow.mjs)
- [.agent/governance/config/policy.json](../../../governance/config/policy.json)
- [scripts/validate-commits.mjs](../../../../scripts/validate-commits.mjs)
