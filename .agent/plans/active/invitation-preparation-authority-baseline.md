---
title: Invitation Preparation — Authority Baseline & Recurrent-Failure Diagnosis (Goal 1)
status: active
created: 2026-07-31
updated: 2026-07-31
related_skills:
  - client-invitation-audit
related_docs:
  - docs/core/invitation-preparation-contract.md
  - docs/core/invitation-creation-contract.md
  - .agent/workflows/invitation-preparation.md
  - .agent/skills/client-invitation-audit/SKILL.md
  - src/lib/invitation-preparation/
  - docs/invitations/alba-rosa-quinonez.md
  - docs/invitations/abril-michelle-becerra-rea.md
  - docs/invitations/valentina-hernandez.md
  - .agent/plans/active/invitation-preparation-goal2-handoff.md
supersedes: []
superseded_by: []
---

# Invitation Preparation — Authority Baseline & Recurrent-Failure Diagnosis

**Goal 1 only.** Diagnosis and handoff. Do **not** remediate skill/workflow/contracts here (Goal 2)
or add helpers/tests here (Goal 3).

Retrospective corpus (most recent invites with durable friction):

1. `alba-rosa-quinonez` (2026-07-28…31) — richest prep + asset + identity trail
2. `abril-michelle-becerra-rea` (2026-07-24…26) — Lane A/B, provisional photos, ambiguous facts
3. `valentina-hernandez` — WhatsApp-compressed assets as production blocker; demo counterpart pattern

Supporting commit signatures: `3943d611` (prep system intro), `f2da2daa` / `51983d74` (Alba +
slug spelling rekey), `dd6ed573` (double-encode), `0985c08e` (Abril face-safe / asset roles).

---

## Live dependency direction (as designed)

```text
routing-matrix (invitation_preparation)
  → workflow: .agent/workflows/invitation-preparation.md          [orchestration]
  → skill:    .agent/skills/client-invitation-audit               [analysis procedure]
  → contract: docs/core/invitation-preparation-contract.md        [semantics SSOT]
  → exec:     src/lib/invitation-preparation/                     [deterministic eval]
  → state:    docs/invitations/<slug>.md                          [durable per-invite]
  → post-prep identity/publication:
        invitation-creation-contract → production-flow →
        managed-invitation-lifecycle → invitation-production rule → live CLI
```

`ownership.yaml` agrees: preparation **semantics** → contract; **procedure** → workflow;
**executable completeness/readiness** → `src/lib/invitation-preparation/`.

Conceptual lifecycle (all layers agree):

```text
Preparation → Implementation → Managed lifecycle / publication
```

---

## 1. Authority matrix

| Semantic concern | SSOT path | Duplicates / conflicts | Recommended owner layer |
| ---------------- | --------- | ---------------------- | ----------------------- |
| Classification vocabulary (`verified`…`requires_owner_decision`) | `docs/core/invitation-preparation-contract.md` §2 + `classification.ts` | Restated in skill P0 + WhatsApp ref + template | **Contract** prose; **lib** types; skill links only |
| WhatsApp vs authoritative photos | Contract §1 + `references/whatsapp-intake-contract.md` | Skill pitfalls restated | **Contract** policy; skill ref = procedure detail |
| Event-type completeness fields | `event-completeness.ts` | Contract §3 summarizes maturity; skill P1 narrates | **Lib** SSOT; contract describes maturity only |
| Placeholder tokens / blocking | `placeholders.ts` + contract §6 | Skill P4 restates | **Lib** + contract |
| Preparation readiness states | `readiness.ts` + contract §9 | Skill hard-stop restates; **Markdown often set by hand** (see backlog) | **Lib** evaluation; Markdown must mirror helper |
| Technical Local/Preview/Prod readiness | `invitation-readiness.ts` / `pnpm invitation:update --status` | Name collision with preparation readiness — prose separates, agents still confuse | Keep separate; prep docs must never claim env readiness |
| Asset inventory / quality labels | Skill `asset-preparation-protocol` + `image-optimization.ts` targets | Contract §7 duplicates steps; Abril/Valentina companion asset reports outside schema | **Protocol + lib targets**; inventory rows live in `<slug>.md` |
| Demo counterpart invariants (`templateId`, `_assetSlug`, `isDemo`) | Skill “Content profiles” | Creation contract has `baseDemoId` / identity; demo-content-consistency skill adjacent | **Prep skill** for prep-time invariants; creation contract for identity fields |
| Lane A vs Lane B | Skill refs `two-lane-spec-structure.md` | Abril/Alba docs invent ad-hoc Lane tables; frontend-design hero contract also teaches face-safe | **Skill** for invite audit; theme docs for reusable theme |
| Identity fields (slug, hostLoginAlias, themeId, …) | `invitation-creation-contract.md` | Prep completeness XV fields overlap identity; template points at creation contract for alias | **Creation contract** post-prep; prep only marks completeness |
| Publication / apply / merge conflicts | `production-flow.md` + managed lifecycle + `invitation-production.md` | Alba `*-merge-conflicts.md` is ops evidence — not prep SSOT | **Publication** chain — not prep skill |
| Dashboard intake status machine | `intake-publishing.md` + `src/lib/intake/` | **Misrouted:** `routing-matrix` loads this rule for `invitation_preparation` | Remove from prep route; belongs to intake/editor |
| Per-invite durable state schema | Contract §4 + `.agent/templates/invitation/preparation-state.md` | Historical companion files (`*-asset-report.md`, copy audits) still used | **Template + contract**; companions are evidence only |
| Agent safety (no Preview/Prod without auth; no secret/PII exposure) | `invitation-production.md` | branch-lane / celebra-delegation also say “no PII” | **invitation-production** for invite work; keep cross-links |

### Ownership drift / inverted dependencies

| Issue | Evidence | Severity |
| ----- | -------- | -------- |
| Skill preconditions force `invitation-creation-contract` + `invitation-production` **before** prep analysis | `client-invitation-audit/SKILL.md` preconditions | Inverted cognitive order — boundary awareness OK; must not become prep procedure |
| Routing attaches `intake-publishing.md` to `invitation_preparation` | `.agent/routing-matrix.yaml` | **Misplaced** — wrong state machine |
| Workflow cites skill “Phase P0–P6”; skill has P0–P5 then implementation Phase 1–5 | workflow step 4 vs skill headings | Drift / duplicated phase numbering |
| Skill owns both **preparation** and **implementation audit** | SKILL procedure | Acceptable as one skill, but blurs workflow “does not own publication/theme” vs audit Lane B |
| Helpers exist but are **not** called by any `package.json` validate/CLI gate | grep: only lib + unit tests | Semantics SSOT is executable, enforcement is prose-only |
| Canonical Markdown readiness can diverge from `evaluatePreparationReadiness` | Alba: `READY_FOR_IMPLEMENTATION` while inventory still `provisional-whatsapp` | **Inverted practice** — Markdown treated as authority over lib |

---

## 2. Recurrent-failure backlog

Classifications: `covered` | `partial` | `absent` | `misplaced` | `info-leak-risk`.

| ID | Finding | Evidence | Classification | Priority | Failed layer | Suggested control |
| -- | ------- | -------- | -------------- | -------- | ------------ | ----------------- |
| F01 | **Readiness label ignores provisional assets** — Markdown advanced to `READY_FOR_IMPLEMENTATION` while photos remain `provisional-whatsapp` / non-production | Alba §Photograph Inventory + readiness history; contradicts `readiness.ts` (`onlyNonProductionImages` ⇒ `READY_WITH_PLACEHOLDERS`) | `partial` (helper correct; process bypassed) | **P0** | Process / skill enforcement | Goal 2: hard rule “Markdown readiness must match helper”; Goal 3: validate Markdown ↔ `evaluatePreparationReadiness` |
| F02 | **WhatsApp-compressed / baked UI chrome as “good enough” sources** until late quality crisis | Alba chrome ✕ baked into JPEG; Valentina draft-preview JPEGs; Abril provisional WebP release gate | `partial` (protocol labels exist; no hard gate) | **P0** | Asset protocol + readiness | Doc: provisional never clears `READY_FOR_IMPLEMENTATION`; helper already encodes — wire it |
| F03 | **Absolute client OneDrive / chat paths + contact names in committed docs** | Alba Sources table: `C:\Users\<user-home>\OneDrive\Clientes\<client-source-dir>\WhatsApp Chat - <chat-folder>\` | `info-leak-risk` | **P0** | Prep template + hygiene | Goal 2: forbid absolute machine paths / chat folder names in committed Markdown; use opaque labels |
| F04 | **Pipeline double-encode / upscale destroys provisional detail** | Alba quality root-cause; commit `dd6ed573` | `partial` (runtime fixed reactively) | **P1** | Implementation (post-prep) with prep blind spot | Prep protocol note + optional Goal 3 checklist that managed WebP must not be re-encoded |
| F05 | **Identity spelling locked wrong (slug / alias) then full rekey** | `quinones` → `quinonez` commit `51983d74`; large rename blast radius | `partial` (creation contract alias rules exist; prep didn’t force orthography verify) | **P1** | Prep fact register + creation identity | Require `verified` spelling evidence before slug/alias freeze; owner pack item |
| F06 | **Ambiguous client facts shipped without resolution** | Abril `Macedio` vs `Macedonio` left open as P1 | `covered` vocabulary / `partial` discipline | **P1** | Classification discipline | Skill: ambiguous required fields stay blocking; do not publish Local as “done” |
| F07 | **Lane A work fights shared preset inheritance** (absolute hero metadata, café bleed) | Abril hero cascade v6→v7; Alba café/brown neutralization pass | `partial` (Lane A/B defined; no inheritance-reset checklist) | **P1** | Two-lane spec + frontend-design | Goal 2: Lane A must list inherited properties to reset; link hero composition contract |
| F08 | **Undefined completeness contracts for non-XV** allow thin “minima only” prep | `cumple` Alba: maturity `undefined`; baby-shower Leah similarly thin | `partial` | **P1** | `event-completeness.ts` maturity | Goal 2/3: promote `cumple` / `baby-shower` toward `partial` with evidenced fields |
| F09 | **Photo multi-role reuse / uniqueness** discovered late | Alba thank-you was hero garden duplicate; protocol step 7 exists | `partial` | **P1** | Asset protocol | Deterministic uniqueness table required before READY_*; Goal 3 test on inventory parse optional |
| F10 | **`intake-publishing` on prep route** | routing-matrix `invitation_preparation` rules | `misplaced` | **P1** | Routing | Goal 2: drop from prep route; keep on intake/publication tasks |
| F11 | **Demo catalog / counterpart gaps deferred as Lane B while client ships** | Abril missing `demo-xv-premiere-floral` JSON | `covered` as Lane B pattern | **P2** | Theme / catalog | Keep Lane B backlog; skill already warns preset ≠ visual parity |
| F12 | **Managed↔editor merge conflicts after apply** treated adjacent to invite docs | `alba-rosa-quinonez-merge-conflicts.md` | `misplaced` if folded into prep skill | **P2** | Publication | Link from lifecycle only; prep handoff says “out of scope” |
| F13 | **Preparation vs technical readiness naming collision** | Contract/workflow separate them; agents still mix with `invitation:update --status` | `partial` | **P2** | Doc clarity | Stronger vocabulary (`prepReadiness` vs `envReadiness`) in skill + template |
| F14 | **Phase numbering / duplicated readiness prose** across workflow ↔ skill ↔ contract | Workflow P0–P6 vs skill P0–P5 | `partial` | **P2** | Doc hygiene | Single phase list in workflow; skill links |
| F15 | **Chat media / HR URLs / PII paste into agent chat** | No prep-specific chat-media or HR-URL rule; production rule bans exposing private client data generally | `absent` (prep-specific) / `partial` (global safety) | **P0** hygiene subset with F03 | Info hygiene | Goal 2: explicit prep hygiene block (see §3) |
| F16 | **`_assetSlug` / route slug / `baseDemoId` confusion** | Leah plan insists distinct meanings; skill content-profile table | `covered` | — | — | Preserve; no Goal 2 change except cross-link |
| F17 | **No package script invokes prep helpers** | Helpers only in unit tests | `absent` (automation) | **P0** for Goal 3; **P1** acknowledge in Goal 2 | Exec surface | Goal 2: require “run helper mentally / via test” until Goal 3 adds `validate:` script |

---

## 3. Info-hygiene snapshot

| Concern | Already constrains? | Where | Gap |
| ------- | ------------------- | ----- | --- |
| WhatsApp attachments as managed assets | **Yes** | Contract §1, WhatsApp intake ref, asset protocol | Enforcement is prose; inventory can still label provisional as implementation-ready (F01/F02) |
| Chat media pasted into agent transcripts / screenshots in repo | **Weak** | celebra-delegation “no broad OneDrive scans”; production “never expose private client data” | **Absent** prep rule: do not attach full WA exports, photo dumps, or HR screenshots to chat or commits |
| Absolute FS paths to `Clientes\` / OneDrive in durable Markdown | **No** | Template literally invites `<absolute-or-repo-path>` | **Absent** — Alba committed real paths (F03) |
| PII (phones, emails, guest lists) in git content collections | **Yes** (historical lesson) | `validate:no-pii`, invitation-workflow archive, content-parity RSVP isolation | Prep Markdown still holds celebrant names/addresses by design — OK; contact paths/chat titles are excess |
| Environment / credential URLs | **Yes** | `invitation-production.md`, branch-lane | Not a prep recurrent failure in corpus |
| Demo ↔ real media crossover | **Yes** | Skill content-profile invariants; archived demo-counterpart work | Covered |
| HR / payroll / internal HR portal URLs | **Absent** | — | No mention in prep surfaces — add explicit forbid if agents encounter them in WA dumps |
| Host/contact names in Sources labels | **Partial** | Production bans “private client data” exposure | Prefer role labels (`client-contact`, `source:wa-export`) over full chat folder titles |

**Verdict:** Demo crossover and “WA ≠ photo SoT” are the strong existing controls. Missing are **committed-path hygiene**, **chat-media handling**, and **HR URL** forbid — plus the readiness bypass that lets provisional media look “fully ready.”

---

## 4. Handoff note for Goal 2 (start here)

Ordered by priority. Remediations = doc/process/skill/workflow/contract alignment only (no new helpers unless trivially clarifying ownership; Goal 3 owns automation).

### P0 — do first

1. **Wire readiness truth:** Skill + contract + template must state that Markdown `Preparation Readiness` is invalid unless it matches `evaluatePreparationReadiness` outcomes — especially `onlyNonProductionImages` ⇒ cannot be `READY_FOR_IMPLEMENTATION` (F01, F02, F17).
2. **Info-hygiene block in prep workflow/skill:** no absolute `Clientes`/OneDrive paths; no WA export folder titles; no chat media dumps; no HR URLs; opaque source labels (F03, F15).
3. **Fix routing:** remove `intake-publishing.md` from `invitation_preparation` route (F10).

### P1 — next

4. Orthography / identity freeze checklist before slug & `hostLoginAlias` (F05).
5. Ambiguous required facts remain blocking — Local “done” language forbidden (F06).
6. Lane A inheritance-reset checklist + link to hero composition contract (F07).
7. Asset uniqueness table mandatory before READY_* (F09).
8. Note double-encode risk in asset protocol (F04) — point at managed-WebP direct delivery.
9. Plan maturity bumps for `cumple` / `baby-shower` completeness (F08) — may spill to Goal 3 field lists.

### P2 — cleanup

10. Align phase numbering; skill links contract instead of restating tables (F14).
11. Vocabulary: `prepReadiness` vs env/status readiness (F13).
12. Keep merge-conflict / promote docs out of prep skill (F12); Lane B demo gaps stay theme backlog (F11).

### Explicit non-goals for Goal 2

- No new `src/lib/invitation-preparation` APIs or validate scripts (Goal 3).
- No next invitation create/publish; no Preview/Production mutations; no commits unless authorized.

---

## Goal 2 status

Process remediations landed 2026-07-31. See
[invitation-preparation-goal2-handoff.md](./invitation-preparation-goal2-handoff.md) for closures and
the Goal 3 automation list (A1–A8).

---

## Exit criteria checklist (Goal 2 inputs)

- [x] SSOT per semantic area mapped; duplicates and inverted deps flagged (§1).
- [x] Recurrent errors P0–P2 with failed layer (§2).
- [x] Process/prose vs missing automation distinguished (F01/F17 automation; others mostly prose).
- [x] Info-hygiene existing vs absent (§3).
