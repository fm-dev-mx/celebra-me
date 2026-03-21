# Phase 02: Evergreen Architecture And Domain Alignment

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Correct the evergreen architecture, RSVP, and content-governance documents so they
match the live repository structure, routes, and theme contracts.

**Weight:** 35% of total plan

---

## 🎯 Analysis / Findings

- RSVP docs still describe `/invitation/{inviteId}` and `/api/invitation/*` despite the live
  implementation using `/{eventType}/{slug}/invitado`, `/{eventType}/{slug}/i/{shortId}`, and
  `/api/invitacion/*`.
- Core architecture still lists legacy module locations as active architecture.
- Content governance understates the supported theme presets relative to the contract in
  `src/lib/theme/theme-contract.ts`.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Evergreen Corrections

- [x] Update `docs/core/architecture.md` to reflect live module hubs and legacy boundaries
      (30% of Phase) (Completed: 2026-03-17 17:31)
- [x] Update `docs/domains/rsvp/architecture.md` to reflect live guest URLs and APIs (30% of
      Phase) (Completed: 2026-03-17 17:31)
- [x] Update `docs/domains/rsvp/status.md` to reflect current host routes, APIs, and status
      boundaries (20% of Phase) (Completed: 2026-03-17 17:31)
- [x] Update `docs/domains/content/event-governance.md` to match the real theme preset contract
      (20% of Phase) (Completed: 2026-03-17 17:31)

---

## ✅ Acceptance Criteria

- [x] All cited evergreen routes and modules exist in the current tree. (Completed:
  2026-03-17 17:31)
- [x] RSVP docs no longer describe `/api/invitation/*` or `/invitation/{inviteId}` as current.
  (Completed: 2026-03-17 17:31)
- [x] Content governance does not contradict the live theme contract. (Completed:
  2026-03-17 17:31)

---

## 📎 References

- [src/utils/invitation-link.ts](../../../src/utils/invitation-link.ts)
- [src/lib/theme/theme-contract.ts](../../../src/lib/theme/theme-contract.ts)
- [docs/domains/theme/architecture.md](../../../docs/domains/theme/architecture.md)
