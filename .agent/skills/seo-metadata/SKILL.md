---
name: seo-metadata
description:
  Implement SEO and Open Graph metadata for digital invitations. Ensure attractive social media
  previews when invitations are shared on WhatsApp, Facebook, and Instagram.
domain: growth
version: 1.1.0
when_to_use:
  - Creating or updating invitation pages with share metadata
  - Reviewing Open Graph, Twitter, or structured page metadata
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Page metadata, invitation routes, assets, and social sharing requirements
outputs:
  - Metadata requirements and implementation guidance for discoverability and sharing
related_skills: []
related_docs:
  - docs/core/project-conventions.md
---

# SEO & Open Graph Metadata

Apply this skill when creating or updating invitation pages to ensure optimal social media previews.

---

## 1. Open Graph Tags

The live invitation metadata surface is the shared [Layout.astro](../../../src/layouts/Layout.astro)
contract plus the invitation route at
[src/pages/[eventType]/[slug].astro](../../../src/pages/[eventType]/[slug].astro). Invitation pages
must publish title, description, canonical URL, and absolute social-image URLs through those
surfaces. Reuse the [social metadata helpers](../../../src/lib/invitation/social-metadata.ts) and
preserve public-origin canonical URLs without personalization parameters.

### Content Guidelines

| Tag              | Max Length | Example                                            |
| ---------------- | ---------- | -------------------------------------------------- |
| `og:title`       | 60 chars   | "XV Años de María Elena"                           |
| `og:description` | 155 chars  | "15 de marzo, 2026 • Salón Los Arcos, Guadalajara" |

---

## 2. Image Requirements

| Property       | Requirement                               |
| -------------- | ----------------------------------------- |
| **Dimensions** | 1200×630 px (1.91:1 ratio)                |
| **Format**     | JPG or PNG, prefer WebP with JPG fallback |
| **File size**  | < 300 KB for fast loading                 |
| **Alt text**   | Descriptive, include event type           |
| **Safe zone**  | Keep text within center 80%               |

---

## 3. Structured Data (JSON-LD)

Add Schema.org Event markup for rich search results:

```astro
---
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: event.title,
  startDate: event.isoDate, // "2026-03-15T18:00:00-06:00"
  endDate: event.isoEndDate,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: event.venue.name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: event.venue.city,
      addressCountry: 'MX',
    },
  },
  image: absoluteImage,
  description: metaDescription,
  organizer: {
    '@type': 'Person',
    name: event.hosts?.[0] ?? event.title,
  },
};
---

<script type="application/ld+json" set:html={JSON.stringify(jsonLd)}></script>
```

---

## 4. Platform-Specific Tips

### WhatsApp

- Caches previews aggressively; append `?v=2` to image URL after updates
- Test with `https://wa.me/?text=URL` before sharing

### Facebook

- Use [Sharing Debugger](https://developers.facebook.com/tools/debug/) to clear cache
- Scrape URL after any metadata changes

### Instagram

- Only shows previews in bio links and stories, not DMs
- Ensure image has high contrast for small thumbnails

### iMessage

- Uses `og:image` with proper aspect ratio
- Falls back to page screenshot if image fails

---

## 5. Verification Checklist

Before deploying any invitation:

- [ ] `og:title` is unique and under 60 chars
- [ ] `og:description` includes date and venue, under 155 chars
- [ ] `og:image` is 1200×630, absolute URL, < 300 KB
- [ ] `og:url` matches canonical URL
- [ ] Twitter Card tags present
- [ ] JSON-LD validates at [Schema.org Validator](https://validator.schema.org/)
- [ ] Test in Facebook Debugger
- [ ] Test WhatsApp preview on mobile
- [ ] No console errors for missing images
