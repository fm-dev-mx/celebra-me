# Phase 01: Audit & Data Modeling

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Validate the current content schema against real-client requirements, identify any
gaps, and define the canonical data structure for the production XV event JSON.

**Weight:** 15% of total plan

---

## 🎯 Analysis / Findings

### Schema Fitness Assessment

The current `eventContentSchema` in `src/content/config.ts` is **fully sufficient** for a real XV
invitation. No schema modifications are required. The evidence:

| Requirement                   | Schema Support                        | Status |
| :---------------------------- | :------------------------------------ | :----- |
| Event type (`xv`)             | `z.enum(EVENT_TYPES)`                 | ✅     |
| Hero with portrait            | `portrait: AssetSchema`               | ✅     |
| Family (parents + godparents) | `family.parents`, `family.godparents` | ✅     |
| Gallery (12+ images)          | `gallery.items[]`                     | ✅     |
| RSVP with WhatsApp            | `rsvp.whatsappConfig`                 | ✅     |
| Music player                  | `music.url`                           | ✅     |
| Envelope reveal               | `envelope.*`                          | ✅     |
| Content blocks reordering     | `contentBlocks[]`                     | ✅     |
| Per-event style override      | Filename convention                   | ✅     |

### Content Collection Architecture

The production event will live in the `events` collection (`src/content/events/`), which has
**priority** over `event-demos` in the `getRoutableEventEntry()` resolution chain. This is the
correct and intended path for real client data.

```
src/content/events/
└── <client-slug>.json    ← New production event file
```

### Slug Naming Convention

The slug becomes the URL path segment: `/<eventType>/<slug>`. Recommended pattern:

```
xv-<first-name>-<year>
```

Example: `xv-valentina-2026` → URL: `/xv/xv-valentina-2026`

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Data Structure Validation

- [ ] Confirm `eventContentSchema` requires no modifications for this event (30% of Phase)
- [ ] Define the client event slug following naming conventions (10% of Phase)
- [ ] Create a checklist of all required client inputs (name, date, venues, photos) (30% of Phase)

### Template Preparation

- [ ] Duplicate `demo-xv.json` structure as the scaffolding base (15% of Phase)
- [ ] Document all fields that require client personalization (15% of Phase)

---

## ✅ Acceptance Criteria

- [ ] No changes needed to `src/content/config.ts` — confirmed via Zod validation of a sample JSON.
- [ ] Client input checklist is complete and shared with stakeholder.
- [ ] Event slug is chosen and does not conflict with any existing demo or template.
- [ ] Template scaffold file is ready for Phase 04 (content population).

---

## 📎 References

- [Content Schema](../../../../src/content/config.ts)
- [Event Resolution Logic](../../../../src/lib/content/events.ts)
- [Demo XV JSON](../../../../src/content/event-demos/xv/demo-xv.json)
- [Master XV Template](../../../../src/content/event-templates/xv/master.json)
