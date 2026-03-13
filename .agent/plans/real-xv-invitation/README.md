# 🎀 Real XV Invitation — Production Implementation Plan

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Design and deliver a production-ready, personalized XV Años (Quinceañera) digital
invitation that is architecturally decoupled from all existing demos, using the established
JSON-driven content pipeline and 3-Layer Color Architecture.

**Estimated Duration:** 5 phases / ~4 days  
**Owner:** fm-dev-mx  
**Created:** 2026-03-12

---

## 🎯 Scope

### In Scope

- New `events` collection entry (production JSON) for a real client XV celebration.
- A dedicated theme preset (`_jewelry-box-xv-client.scss`) registered via `_invitation.scss`.
- Per-event style overrides via `src/styles/events/<slug>.scss`.
- Asset management strategy (CDN-hosted photos via Cloudinary / R2, no local bloat).
- Asset registry entry scoped to the client event slug.
- Feasibility analysis for a Simplified Frontend Creator (Go/No-Go).

### Out of Scope

- Modifications to existing demos (`demo-xv`, `demo-bodas`, `demo-cumple`).
- New Astro components — all existing sections are reused.
- Full "Invitation Creator" app build — only evaluation.
- Backend API changes (Supabase schema, RSVP logic).

---

## 🔴 Blockers & Risks

| Risk / Blocker                            | Severity | Mitigation                                                                |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Client photos not yet delivered           | High     | Use high-quality AI-generated placeholders; swap when real photos arrive. |
| Theme overrides leaking to other presets  | High     | Strict scoping via `.theme-preset--*` and `.event--<slug>` selectors.     |
| Asset bloat in main branch                | Medium   | Enforce CDN-only strategy for production event photos (Cloudinary/R2).    |
| Content schema mismatch if schema evolves | Low      | Pin to current `eventContentSchema` from `config.ts`; validate with Zod.  |

---

## 📐 Architectural Context

### Current System Topology

```
src/content/
├── config.ts                    ← Shared Zod schema (eventContentSchema)
├── events/                      ← 🟢 PRODUCTION events (empty — this is our target)
│   └── .gitkeep
├── event-demos/                 ← 🔵 Demo content (demo-xv, demo-bodas, demo-cumple)
│   ├── boda/demo-bodas.json
│   ├── cumple/demo-cumple.json
│   └── xv/demo-xv.json
└── event-templates/             ← 🟡 Client templates (master XV)
    └── xv/master.json
```

### Content Resolution Pipeline

1. `[eventType]/[slug].astro` receives the URL params.
2. `getRoutableEventEntry(slug)` searches `events` first, then falls back to `event-demos`.
3. The event adapter (`adaptEvent`) transforms raw JSON into a typed ViewModel.
4. Theme class is applied: `theme-preset--{preset}`, scope class: `event--{slug}`.
5. Per-event overrides auto-loaded from `src/styles/events/{slug}.scss`.

### Key Insight: Events Collection Priority

The `getRoutableEventEntry()` function in `src/lib/content/events.ts` searches the **`events`
collection first** and only falls back to `event-demos` if no match is found. This means placing the
real invitation JSON in `src/content/events/` gives it routing priority and complete isolation from
demos.

---

## 📊 Structural Audit: `demo-xv.json` vs. `master.json` (Template)

| Field           | `demo-xv.json`                         | `master.json` (Template)           | Delta                                                     |
| :-------------- | :------------------------------------- | :--------------------------------- | :-------------------------------------------------------- |
| `eventType`     | `"xv"`                                 | `"xv"`                             | Identical                                                 |
| `isDemo`        | `true`                                 | _(absent — defaults to `false`)_   | **Production field** — must be `false` for real events    |
| `theme.preset`  | `"jewelry-box"`                        | `"jewelry-box"`                    | Client preset will be unique (e.g., `"jewelry-box-xv-*"`) |
| `hero.name`     | `"Lucía García"`                       | `"Nombre de la Festejada"`         | Personalized content required                             |
| `hero.bgImage`  | `"hero"` (asset key)                   | Unsplash URL                       | Real photos needed (CDN or asset key)                     |
| `family`        | Parents + godparents + `featuredImage` | _(absent)_                         | **Must be fully populated** for production                |
| `gallery.items` | 12 items with asset keys               | 2 items with Unsplash URLs         | Real photos via CDN                                       |
| `music`         | Present (R2-hosted MP3)                | _(absent)_                         | Client music selection TBD                                |
| `rsvp`          | `guestCap: 2`, WhatsApp + API mode     | `guestCap: 2`, WhatsApp + API mode | Guest list & phone number personalized                    |
| `contentBlocks` | _(absent — uses default order)_        | _(absent)_                         | May add interlude images for premium feel                 |
| `envelope`      | Wax seal, heart icon                   | Wax seal, heart icon               | Customizable per client preference                        |

### Conclusion

The `master.json` template is a **useful starting skeleton** but is incomplete for production. The
`demo-xv.json` is a **better structural reference** for all sections. The production file should be
created by **cloning `demo-xv.json`, replacing all content**, and:

1. Setting `isDemo: false`
2. Using a unique theme preset slug
3. Replacing all asset keys with CDN URLs or a new asset registry entry
4. Personalizing all copy fields

---

## 🗺️ Phase Index

| #   | Phase                                                            | Weight | Status    |
| --- | ---------------------------------------------------------------- | ------ | --------- |
| 01  | [Audit & Data Modeling](./phases/01-audit-and-data-modeling.md)  | 15%    | `PENDING` |
| 02  | [Theme Isolation](./phases/02-theme-isolation.md)                | 25%    | `PENDING` |
| 03  | [Asset Pipeline & CDN](./phases/03-asset-pipeline.md)            | 20%    | `PENDING` |
| 04  | [Content Population](./phases/04-content-population.md)          | 25%    | `PENDING` |
| 05  | [Creator Frontend Evaluation](./phases/05-creator-evaluation.md) | 15%    | `PENDING` |

---

## 💡 Invitation Creator — Executive Summary

> A full evaluation is in [Phase 05](./phases/05-creator-evaluation.md), but the headline
> recommendation is provided here for fast decision-making.

### Verdict: 🔴 NO-GO (for this implementation)

| Factor               | Assessment                                                                        |
| :------------------- | :-------------------------------------------------------------------------------- |
| **Development Cost** | 3-5 days of UI/UX work (React form, live preview, JSON serialization)             |
| **Alternative Cost** | ~30 minutes to duplicate & edit a JSON file + SCSS preset manually                |
| **Risk**             | High — introduces UI debt, WYSIWYG synchronization challenges, theme preview bugs |
| **Recommendation**   | Defer to a dedicated sprint after 3+ real client invitations ship                 |

**Rationale:** The JSON + SCSS manual workflow is already proven, fast, and zero-risk. Building a
creator UI before having enough real-client patterns would lead to premature abstraction. Revisit
after shipping 3 production invitations to identify common customization vectors.

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
