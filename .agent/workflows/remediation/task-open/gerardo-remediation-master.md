# 🏆 Workflow: Gerardo Remediation Master

---

## 1. Parameters

- **Project**: Gerardo 60th Birthday
- **Primary Theme**: `luxury-hacienda`
- **Discovery Report**: `docs/audit/discovery/gerardo-composite-discovery-2026-02-13.md`
- **Checklist**: `docs/audit/remediation/master-remediation-checklist.md`

---

## 2. Objective

Execute a coordinated remediation of all invitation sections to achieve "Premium" status, resolving
all findings in the composite report.

---

## 3. Execution Sequence

### Phase 1: Foundation (Header & Hero)

1. **Header**: Fix desktop contrast and tokenize `_event-header.scss`.
2. **Hero**: Execute `hero-premium-audit-remediation.md` to establish the baseline.

### Phase 2: Core Content (Family & Event)

1. **Family**: Fix vertical scale/padding (`11vw` -> `tokens`) and tokenize parchment/ink colors in
   `_family-theme.scss`.
2. **Event**: Fix misleading icons (Dress/Hat) and tokenize venue card title colors.

### Phase 3: Experience (Itinerary & Gallery)

1. **Itinerary**: Align SVG line end and remove hardcoded fallback `#d4af37` from
   `TimelineList.tsx`.
2. **Gallery**: Implement **Mobile Intersection Observer** for B&W to Color transition. Tokenize
   backgrounds.

### Phase 4: Conversion (RSVP)

1. **RSVP**: Fix placeholder contrast and replace emojis with theme-aware SVGs.

---

## 4. Generic Instruction for Each Section

For each section above, follow the
[generic-section-remediation.md](file:///c:/Code/celebra-me/.agent/workflows/remediation/task-open/generic-section-remediation.md)
workflow using the specific findings from the checklist.

---

## 5. Global Verification

- `pnpm gatekeeper` (Full mode)
- Visual check on `jewelry-box` for regression.
- Visual check on mobile (320px) for all sections.

// turbo
