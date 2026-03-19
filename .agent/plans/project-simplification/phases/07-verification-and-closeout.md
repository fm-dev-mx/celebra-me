# Phase 07: Verification and Closeout

**Completion:** `80%` | **Status:** `IN-PROGRESS`

**Objective:** Run repo-wide validation and close the simplification loop with a final status update.

**Weight:** 10% of total plan

---

## 🎯 Analysis / Findings

- Code, assets, styles, and governance docs were simplified without breaking route or API contracts.
- Automated validation is mostly green after implementation:
  - `pnpm astro check`: pass
  - `pnpm lint`: pass with 2 pre-existing warnings in `src/lib/adapters/event-helpers.ts`
  - `pnpm test`: pass
  - `pnpm assets:check-registry`: pass
  - `pnpm ops check-links`: pass
- `pnpm ops validate-schema` still fails with 26 pre-existing ThemeContract/CSS variant mismatches:
  - sections affected: `quote`, `countdown`, `location`, `family`, `gifts`, `gallery`, `thankYou`
- Manual browser smoke for landing, invitation, and dashboard routes was not run in this terminal-only turn.

---

## 🛠️ Execution Tasks [STATUS: IN-PROGRESS]

### Final Verification

- [x] Run `pnpm astro check`. (20% of Phase)
- [x] Run `pnpm lint`. (20% of Phase)
- [x] Run `pnpm test`. (20% of Phase)
- [x] Run `pnpm assets:check-registry`, `pnpm ops validate-schema`, and `pnpm ops check-links`. (20% of Phase)
- [x] Update this plan, changelog, and manifest with final completion status. (20% of Phase)

### Outstanding Closeout Items

- [ ] Repair ThemeContract/CSS variant parity so `pnpm ops validate-schema` passes.
- [ ] Run manual browser smoke on `/`, `/login`, `/dashboard/invitados`, `/dashboard/claimcodes`, `/xv/noir-premiere-xv`, `/cumple/demo-cumple`, one `?invite=` flow, and one `/i/{shortId}` flow.

---

## ✅ Acceptance Criteria

- [ ] All required validation passes.
- [x] Remaining retained abstractions are documented as intentional.

---

## 📎 References

- `package.json`
- `docs/DOC_STATUS.md`
- `src/lib/adapters/event.ts`
- `src/lib/rsvp/service.ts`
