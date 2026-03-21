# Phase 04: Content Population & Integration

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Create the production event JSON file with all real client data, integrate it into
the content pipeline, and validate the full rendering flow end-to-end.

**Weight:** 25% of total plan

---

## 🎯 Analysis / Findings

### File Location & Naming

The production JSON file goes in the `events` collection:

```text
src/content/events/<client-slug>.json
```

This is the **first real event** in this collection. The collection is defined in `config.ts` as
`eventsCollection` using the same `eventContentSchema` as demos and templates.

### JSON Structure Blueprint

Based on the audit in Phase 01, the production file structure mirrors `demo-xv.json` with these key
changes:

```json
{
  "eventType": "xv",
  "isDemo": false, // ← Production flag
  "title": "<Client Event Title>",
  "description": "<Client SEO Description>",
  "theme": {
    "primaryColor": "<client-hex>",
    "accentColor": "<client-hex>",
    "fontFamily": "serif",
    "preset": "jewelry-box-xv-client" // ← From Phase 02
  },
  "sectionStyles": {
    /* all with variant: "jewelry-box-xv-client" */
  },
  "hero": {
    "name": "<Real Name>",
    "label": "Mis XV Años",
    "date": "<ISO-8601 event date>",
    "backgroundImage": "<Cloudinary URL>", // ← From Phase 03
    "portrait": "<Cloudinary URL>" // ← Optional
  },
  "location": {
    "ceremony": {
      /* Real venue data */
    },
    "reception": {
      /* Real venue data */
    },
    "indications": [
      /* Client-specific rules */
    ]
  },
  "family": {
    "parents": { "father": "...", "mother": "..." },
    "godparents": [
      /* Real godparents */
    ],
    "featuredImage": "<Cloudinary URL>"
  },
  "gallery": {
    "title": "Galería",
    "subtitle": "<Client subtitle>",
    "items": [
      /* 8-12 images with CDN URLs */
    ]
  },
  "rsvp": {
    "confirmationMode": "both",
    "whatsappConfig": { "phone": "<real-phone>" }
  },
  "quote": {
    /* Client-chosen quote */
  },
  "thankYou": {
    /* Personalized closing */
  },
  "music": { "url": "<R2 URL>", "autoPlay": false },
  "itinerary": {
    /* Event timeline */
  },
  "countdown": {
    /* Countdown copy */
  },
  "navigation": [
    /* Invitation nav links */
  ],
  "envelope": {
    /* Client seal & palette preferences */
  },
  "sharing": { "whatsappTemplate": "..." }
}
```

### Integration Checklist

The `[slug].astro` page routing requires no changes — it automatically picks up new entries from the
`events` collection via `getRoutableEventEntry()`.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Content File Creation

- [ ] Create `src/content/events/<client-slug>.json` from the blueprint above (25% of Phase)
- [ ] Populate all hero fields with real client data (10% of Phase)
- [ ] Populate location section with real venue addresses, times, and map URLs (15% of Phase)
- [ ] Populate family section with real parents and godparents (10% of Phase)
- [ ] Populate gallery with CDN-hosted photo URLs from Phase 03 (10% of Phase)

### RSVP Configuration

- [ ] Set real WhatsApp phone number and message templates (5% of Phase)
- [ ] Configure guest cap based on client requirements (5% of Phase)
- [ ] (Optional) Create guest list entries for personalized invitations (5% of Phase)

### Copywriting & Personalization

- [ ] Write or adapt event quote in Spanish following `copywriting-es` skill guidelines (5% of
      Phase)
- [ ] Write personalized thank-you message (5% of Phase)
- [ ] Set countdown copy (5% of Phase)

---

## ✅ Acceptance Criteria

- [ ] `pnpm dev` runs without Zod validation errors for the new event file.
- [ ] Navigating to `/<eventType>/<slug>` renders the full invitation.
- [ ] All sections display with the correct theme preset (not falling back to `jewelry-box`).
- [ ] All images load from CDN URLs without broken references.
- [ ] Music player loads and plays the hosted audio file.
- [ ] Envelope reveal animation functions correctly.
- [ ] WhatsApp sharing link generates the correct pre-filled message.
- [ ] No existing demos are affected — all three render identically.
- [ ] SEO metadata (title, description, og:image) is correct in HTML `<head>`.

---

## 📎 References

- [Event Page Template](../../../../src/pages/[eventType]/[slug].astro)
- [Event Adapter](../../../../src/lib/adapters/event.ts)
- [Demo XV JSON](../../../../src/content/event-demos/xv/demo-xv.json) — Structural reference
- [Demo Bodas JSON](../../../../src/content/event-demos/boda/demo-bodas.json) — `contentBlocks`
  pattern
- [copywriting-es Skill](../../../../.agent/skills/copywriting-es/SKILL.md)
- [seo-metadata Skill](../../../../.agent/skills/seo-metadata/SKILL.md)
