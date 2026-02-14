---
description: Generate comprehensive Content Collections documentation from schema and examples.
lifecycle: evergreen
domain: docs
owner: docs-governance
last_reviewed: 2026-02-14
---

# 📝 Workflow: Content Collections Documentation

Creates `docs/CONTENT_COLLECTIONS.md` - the missing critical documentation for the core business
logic.

---

## 1. Information Gathering

### 1.1 Schema Analysis

Read and extract from:

- `src/content/config.ts` - Zod schema definitions
- `src/content/events/*.json` - Example event configurations
- `src/pages/[eventType]/[slug].astro` - Consumption patterns
- `src/lib/assets/AssetRegistry.ts` - Asset relationships

### 1.2 Key Schema Components to Document

**Core Structure:**

```typescript
// From config.ts - Extract:
- Event type enum (xv, boda, bautizo, cumple)
- All required vs optional fields
- Nested objects (hero, location, family, etc.)
- Discriminated unions (gifts array)
- Section styles configuration
```

**Relationships:**

- Content slug ↔️ AssetRegistry event key
- EventType ↔️ Route parameters
- Section styles ↔️ Theme variants

---

## 2. Documentation Structure

### 2.1 Header & Overview

```markdown
# Content Collections - Celebra-me

## Overview

Content collections power Celebra-me's event system. Each event (invitation) is defined as a JSON
file in `src/content/events/`, validated by Zod schema, and rendered dynamically.

**Key Features:**

- Type-safe event configuration
- Schema validation at build time
- Multi-event support (XV, Weddings, Baptisms, Birthdays)
- Section-level customization via sectionStyles
- Asset integration with AssetRegistry
```

### 2.2 Event Types

Document each event type:

```markdown
## Event Types

### XV Años (`xv`)

Quinceañera celebrations - formal, milestone events.

- Typical preset: `jewelry-box`
- Common sections: All enabled
- Example: `demo-xv.json`

### Wedding (`boda`)

Wedding celebrations - romantic, elegant themes.

- Typical preset: `jewelry-box` or `luxury`
- Special features: Couple portraits, dual families

### Baptism (`bautizo`)

Religious ceremonies - traditional, family-focused.

- Typical preset: `minimal` or `elegant`
- Common sections: Protocol, Family, Location

### Birthday (`cumple`)

Birthday celebrations - varies by milestone.

- Typical preset: `luxury-hacienda` (adult), `modern` (youth)
- Example: `cumple-60-gerardo.json`
```

### 2.3 Schema Reference

**Create comprehensive field reference:**

````markdown
## Schema Reference

### Required Fields

#### `eventType` (string)

- **Type**: Enum `'xv' | 'boda' | 'bautizo' | 'cumple'`
- **Purpose**: Determines route and default styling
- **Example**: `"eventType": "xv"`

#### `title` (string)

- **Purpose**: SEO title and internal reference
- **Example**: `"title": "XV Años - María Fernanda"`

#### `theme` (object)

Core visual configuration:

```json
{
	"theme": {
		"primaryColor": "#d4af37",
		"accentColor": "#8b4513",
		"fontFamily": "serif",
		"preset": "jewelry-box"
	}
}
```
````

#### `hero` (object)

Main invitation header:

```json
{
	"hero": {
		"name": "María Fernanda",
		"nickname": "Marifer",
		"date": "2026-06-15T18:00:00",
		"backgroundImage": "hero",
		"portrait": "portrait"
	}
}
```

### Optional Fields

#### `sectionStyles` (object)

Per-section theme customization:

```json
{
	"sectionStyles": {
		"quote": { "variant": "jewelry-box", "fontStyle": "script" },
		"countdown": { "variant": "jewelry-box", "showParticles": false },
		"location": { "variant": "jewelry-box", "mapStyle": "minimal" }
	}
}
```

**Available Variants by Section:** | Section | Variants | |---------|----------| | quote | elegant,
modern, minimal, floral, jewelry-box, luxury-hacienda | | countdown | minimal, vibrant, classic,
modern, jewelry-box, luxury-hacienda | | location | structured, organic, minimal, luxury,
jewelry-box, luxury-hacienda | | family | jewelry-box, luxury-hacienda | | gifts | jewelry-box,
luxury-hacienda |

#### `location` (object)

Venue information with ceremony/reception support:

```json
{
	"location": {
		"venue": "Jardín Las Bugambilias",
		"address": "Av. Insurgentes Sur 1234",
		"city": "Ciudad de México",
		"maps": {
			"ceremony": { "url": "...", "coords": "..." },
			"reception": { "url": "...", "coords": "..." }
		}
	}
}
```

#### `gifts` (array)

Gift registry options (discriminated union):

```json
{
	"gifts": [
		{ "type": "store", "name": "Mesa de Regalos", "url": "..." },
		{ "type": "bank", "bankName": "BBVA", "accountNumber": "...", "beneficiary": "..." },
		{ "type": "paypal", "email": "..." },
		{ "type": "cash", "message": "..." }
	]
}
```

[Continue for all fields: family, rsvp, quote, thankYou, music, sections, gallery, envelope,
itinerary, countdown, navigation]

````

### 2.4 Complete Examples

**Include full, working examples:**

```markdown
## Complete Examples

### Example 1: XV Años (Jewelry Box)
\`\`\`json
[Full demo-xv.json content]
\`\`\`

### Example 2: 60th Birthday (Luxury Hacienda)
\`\`\`json
[Full cumple-60-gerardo.json content]
\`\`\`
````

### 2.5 Asset Integration

```markdown
## Asset Integration

### File Naming Convention

Event assets in `src/assets/images/events/{event-slug}/` must match content collection slug.

### Required Assets

- `hero.webp` - Cover image
- `portrait.webp` - Main portrait
- `jardin.webp` - Venue photo
- `signature.webp` - Decorative signature
- `gallery-01.webp` through `gallery-11.webp` - Gallery images

### Asset Keys

Reference assets in content JSON using semantic keys: \`\`\`json { "hero": { "backgroundImage":
"hero", // Maps to hero.webp "portrait": "portrait" // Maps to portrait.webp } } \`\`\`

### AssetRegistry Connection

The AssetRegistry automatically maps content slugs to asset directories. See
`docs/ASSET_REGISTRY_GUIDE.md` for details.
```

### 2.6 Route Generation

```markdown
## Route Generation

Events generate routes based on `eventType` and file slug:

**File**: `src/content/events/mi-boda-2025.json` \`\`\`json { "eventType": "boda" } \`\`\`

**Route**: `/boda/mi-boda-2025`

### Static Path Generation

\`\`\`astro // src/pages/[eventType]/[slug].astro export async function getStaticPaths() { const
events = await getCollection('events'); return events.map(event => ({ params: { eventType:
event.data.eventType, slug: event.slug }, props: { event } })); } \`\`\`
```

---

## 3. Validation & Testing

### 3.1 Schema Validation

```markdown
## Validation

Content is validated at build time using Zod schema:

### Common Validation Errors

| Error                | Cause                           | Solution                 |
| -------------------- | ------------------------------- | ------------------------ |
| `Required`           | Missing required field          | Add field to JSON        |
| `Invalid enum value` | Variant doesn't exist in schema | Use valid variant name   |
| `Invalid date`       | Date format incorrect           | Use ISO 8601 format      |
| `Invalid url`        | Malformed URL                   | Ensure proper URL format |

### Testing New Events

1. Create JSON file in `src/content/events/`
2. Run `pnpm check` to validate schema
3. Run `pnpm dev` and visit route
4. Verify all images load correctly
5. Test interactive sections (RSVP, Countdown)
```

### 3.2 Test File Reference

```markdown
## Schema Tests

Validation tests in `tests/content/schema.test.ts` ensure schema integrity:

- Event type validation
- Required field checks
- Variant enum validation

Run tests: \`\`\`bash pnpm test tests/content/schema.test.ts \`\`\`
```

---

## 4. Best Practices

```markdown
## Best Practices

### Content Guidelines

- Use semantic slugs (e.g., `xv-maria-2026` not `event1`)
- Keep descriptions under 160 characters for SEO
- Use ISO 8601 dates with timezone: `2026-06-15T18:00:00-06:00`
- Test all URLs before deploying

### Asset Guidelines

- Use WebP format for all images
- Optimize images before adding (max 500KB)
- Follow naming convention: lowercase, kebab-case

### Section Styles

- Start with `standard` or `minimal` variants
- Customize per-event based on client aesthetic
- Document custom variants in event notes
```

---

## 5. Generation Steps

1. **Extract Schema** - Read `config.ts` and document all fields
2. **Analyze Examples** - Use existing events as reference
3. **Create Structure** - Follow template above
4. **Document Variants** - Cross-reference with `THEME_SYSTEM.md`
5. **Add Examples** - Include complete working JSON
6. **Verify Links** - Ensure references to other docs work
7. **Test Examples** - Validate JSON syntax

// turbo

> [!IMPORTANT] This is critical missing documentation. Ensure all event types are covered and
> examples are copy-paste ready. Cross-reference with THEME_SYSTEM.md for accurate variant listings.
