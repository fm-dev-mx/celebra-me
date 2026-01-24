---
name: seo-metadata
description: Implement SEO and Open Graph metadata for digital invitations. Ensure attractive social media previews when invitations are shared on WhatsApp, Facebook, and Instagram.
---

# SEO & Open Graph Metadata

Apply this skill when creating or updating invitation pages to ensure optimal social media previews.

---

## 1. Open Graph Tags

Every invitation page **must** include these meta tags in `<head>`:

```astro
---
// BaseLayout.astro
interface Props {
  title: string;           // "XV Años de María Elena"
  description: string;     // "Te invitamos a celebrar • 15 de marzo, 2026 • Salón Los Arcos"
  image: string;           // Absolute URL to OG image
  url: string;             // Canonical URL
  type?: 'website' | 'event';
}

const { title, description, image, url, type = 'website' } = Astro.props;
const siteUrl = Astro.site?.origin ?? 'https://celebra.me';
const absoluteImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
---

<!-- Open Graph -->
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={absoluteImage} />
<meta property="og:url" content={url} />
<meta property="og:type" content={type} />
<meta property="og:site_name" content="Celebra-me" />
<meta property="og:locale" content="es_MX" />
```

### Content Guidelines

| Tag | Max Length | Example |
|-----|------------|---------|
| `og:title` | 60 chars | "XV Años de María Elena" |
| `og:description` | 155 chars | "15 de marzo, 2026 • Salón Los Arcos, Guadalajara" |

---

## 2. Twitter Cards

Fallback for Twitter/X sharing:

```astro
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={absoluteImage} />
<meta name="twitter:image:alt" content={`Invitación: ${title}`} />
```

---

## 3. Astro Implementation

Complete `BaseLayout.astro` integration:

```astro
---
// src/layouts/BaseLayout.astro
import { getImage } from 'astro:assets';

interface Props {
  event: {
    title: string;
    eventType: string;
    date: string;
    venue: { name: string; city: string };
    heroImage: ImageMetadata;
  };
  slug: string;
}

const { event, slug } = Astro.props;
const siteUrl = import.meta.env.SITE ?? 'https://celebra.me';
const canonicalUrl = `${siteUrl}/${event.eventType}/${slug}`;

// Generate optimized OG image
const ogImage = await getImage({
  src: event.heroImage,
  width: 1200,
  height: 630,
  format: 'jpg',
});

const metaTitle = `${event.title} | Celebra-me`;
const metaDescription = `${event.date} • ${event.venue.name}, ${event.venue.city}`;
---

<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{metaTitle}</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- OG + Twitter tags here -->
</head>
```

---

## 4. Image Requirements

| Property | Requirement |
|----------|-------------|
| **Dimensions** | 1200×630 px (1.91:1 ratio) |
| **Format** | JPG or PNG, prefer WebP with JPG fallback |
| **File size** | < 300 KB for fast loading |
| **Alt text** | Descriptive, include event type |
| **Safe zone** | Keep text within center 80% |

### OG Image Generation

```astro
---
// Generate OG-optimized image at build time
import { getImage } from 'astro:assets';
import heroSrc from '../assets/hero.jpg';

const ogImage = await getImage({
  src: heroSrc,
  width: 1200,
  height: 630,
  format: 'jpg',
  quality: 80,
});
---
<meta property="og:image" content={`${Astro.site}${ogImage.src}`} />
```

---

## 5. Structured Data (JSON-LD)

Add Schema.org Event markup for rich search results:

```astro
---
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  "name": event.title,
  "startDate": event.isoDate, // "2026-03-15T18:00:00-06:00"
  "endDate": event.isoEndDate,
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": event.venue.name,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": event.venue.city,
      "addressCountry": "MX"
    }
  },
  "image": absoluteImage,
  "description": metaDescription,
  "organizer": {
    "@type": "Person",
    "name": event.hosts?.[0] ?? event.title
  }
};
---

<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

---

## 6. Platform-Specific Tips

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

## 7. Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Images < 600px wide | Use 1200×630 minimum |
| Generic descriptions | Include date + venue |
| Relative image URLs | Always use absolute URLs |
| Descriptions > 200 chars | Keep under 155 chars |
| Missing `og:url` | Always include canonical |
| Same image for all events | Unique hero per invitation |
| Text outside safe zone | Center important content |

---

## 8. Verification Checklist

Before deploying any invitation:

- [ ] `og:title` is unique and under 60 chars
- [ ] `og:description` includes date and venue, under 155 chars
- [ ] `og:image` is 1200×630, absolute URL, < 300 KB
- [ ] `og:url` matches canonical URL
- [ ] Twitter Card tags present
- [ ] JSON-LD validates at [Schema.org Validator](https://validator.schema.org/)
- [ ] Test in Facebook Debugger
- [ ] Test WhatsApp preview on mobile
- [ ] `<html lang="es-MX">` is set
- [ ] No console errors for missing images
