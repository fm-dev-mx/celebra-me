# Phase 05: Invitation Creator Frontend Evaluation

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Conduct a comprehensive feasibility analysis of building a Simplified Frontend
Creator for digital invitations, and deliver a clear Go/No-Go recommendation.

**Weight:** 15% of total plan

---

## 🎯 Analysis / Findings

### What Is the "Invitation Creator"?

A web-based UI that allows non-technical users to create, customize, and preview digital invitations
without editing JSON files or SCSS presets manually. Think of it as a "Canva for Celebra-me
invitations" with live preview.

### Current Manual Workflow (Baseline)

```
Client Request → Developer creates JSON → Developer creates/selects SCSS preset
→ Developer uploads photos to CDN → Developer commits & deploys → Client previews URL
```

**Time:** ~30-60 minutes per invitation (experienced developer). **Skill required:** JSON editing,
SCSS basics, CDN uploads.

### Proposed Creator Workflow

```
Client Request → Admin opens Creator UI → Selects template → Fills form fields
→ Live preview updates → Exports JSON → Auto-deploys → Client previews URL
```

**Developer time:** 0 after initial build. **User skill required:** None (guided UI).

---

## 📊 Pros & Cons Analysis

### Pros

| #   | Benefit                           | Impact                                    |
| --- | :-------------------------------- | :---------------------------------------- |
| 1   | **Zero-dev event creation**       | Scales beyond developer availability      |
| 2   | **Client self-service** potential | Reduces turnaround time to minutes        |
| 3   | **Reduced human error**           | Form validation prevents invalid JSON     |
| 4   | **Live preview**                  | WYSIWYG confidence before publishing      |
| 5   | **Portfolio growth**              | Enables rapid demo creation for marketing |

### Cons

| #   | Risk                         | Impact                                      |
| --- | :--------------------------- | :------------------------------------------ |
| 1   | **3-5 day development cost** | Delays shipping the first real invitation   |
| 2   | **Theme preview complexity** | SCSS presets cannot be hot-reloaded in a UI |
| 3   | **Premature abstraction**    | Creating a UI before knowing real patterns  |
| 4   | **WYSIWYG sync debt**        | Preview must mirror production rendering    |
| 5   | **Maintenance cost**         | Every schema change requires UI updates     |
| 6   | **Photo upload integration** | Requires Cloudinary API integration in UI   |

---

## 🔧 Technical Stack Assessment

### Existing Dashboard Infrastructure

The project has a React-based dashboard (`src/components/dashboard/`) with:

| Component Area      | Status   | Reusable for Creator?                 |
| :------------------ | :------- | :------------------------------------ |
| `events/`           | Existing | Event listing — not directly reusable |
| `guests/`           | Existing | Guest management — partially reusable |
| `shell/`            | Existing | Navigation shell — fully reusable     |
| `ErrorBoundary.tsx` | Existing | Error handling — fully reusable       |
| `claimcodes/`       | Existing | Claim code UI — not related           |

### MVP Creator Architecture (If Built)

```
Dashboard Shell
└── Event Creator (new page)
    ├── Template Selector            ← Choose base template (xv, boda, cumple)
    ├── Form Sections                ← Dynamic form from schema
    │   ├── Hero Fields              ← Name, date, background image upload
    │   ├── Location Fields          ← Ceremony/reception address forms
    │   ├── Family Fields            ← Parents, godparents dynamic list
    │   ├── Gallery Upload           ← Multi-image uploader
    │   ├── RSVP Config              ← Guest cap, WhatsApp phone
    │   └── Theme Picker             ← Color palette + preset selector
    ├── Live Preview Panel           ← iframe rendering the invitation page
    └── Export / Publish             ← Save JSON + trigger deployment
```

### Estimated Development Effort

| Component                | Effort     | Complexity |
| :----------------------- | :--------- | :--------- |
| Form builder (React)     | 1.5 days   | Medium     |
| Cloudinary upload widget | 0.5 days   | Low        |
| Live preview (iframe)    | 1 day      | High       |
| Theme picker             | 0.5 days   | Medium     |
| JSON serialization       | 0.5 days   | Low        |
| Testing & polish         | 1 day      | Medium     |
| **Total**                | **5 days** | —          |

---

## 🏁 Recommendation: 🔴 NO-GO

### Decision Matrix

| Criterion              | Manual JSON Workflow | Creator UI      | Winner     |
| :--------------------- | :------------------- | :-------------- | :--------- |
| Time to first delivery | **30-60 min**        | 5+ days (build) | Manual ✅  |
| Per-event cost         | 30-60 min            | **5 min**       | Creator ✅ |
| Risk                   | **Low (proven)**     | High (new code) | Manual ✅  |
| Scalability            | Limited              | **Unlimited**   | Creator ✅ |
| Break-even point       | —                    | **~10 events**  | —          |

### Key Rationale

1. **Insufficient pattern data:** Building a UI before creating 3+ real events means guessing what
   fields clients actually customize. This leads to either over-engineering or rework.

2. **Theme preview is unsolvable in MVP:** SCSS presets compile at build time. A live preview
   requires either a server-side recompilation pipeline or maintaining a parallel CSS-in-JS theme
   system — both of which are expensive and fragile.

3. **Opportunity cost:** The 5 developer-days are better spent shipping 3-5 real invitations, which
   generates revenue and provides the pattern data needed to later build a well-informed Creator.

### Revisit Conditions

Build the Creator when **all** of these are true:

- [ ] 3+ real client invitations have been shipped using the manual workflow.
- [ ] Common customization vectors are documented (which fields clients always change).
- [ ] A dedicated sprint is allocated (not interleaved with client delivery).
- [ ] The SCSS preset system has been evaluated for CSS-in-JS migration feasibility.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Documentation

- [ ] Document the manual workflow as a runbook for future developers/operators (40% of Phase)
- [ ] Document the revisit criteria in the project's technical roadmap (30% of Phase)
- [ ] Archive this evaluation for future reference (30% of Phase)

---

## ✅ Acceptance Criteria

- [ ] Go/No-Go recommendation is documented with clear rationale.
- [ ] Decision matrix and effort estimates are captured in this document.
- [ ] Revisit conditions are listed with measurable triggers.
- [ ] Manual workflow runbook is created (or planned for a follow-up task).
- [ ] Stakeholder has acknowledged the recommendation.

---

## 📎 References

- [Dashboard Components](../../../../src/components/dashboard/)
- [Events Admin Table](../../../../src/components/dashboard/events/EventsAdminTable.tsx)
- [Content Schema](../../../../src/content/config.ts)
