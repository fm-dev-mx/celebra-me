# Content Collections

Content collections are the foundation of Celebra-me's event system. Each invitation is defined as a
JSON file, validated by a Zod schema at build time, and rendered dynamically through Astro's content
collection API.

## Overview

**Purpose**: Define and configure digital invitations with type-safe, validated data structures.

**Key Features**:

- **Type Safety**: Full TypeScript support with Zod schema validation
- **Build-time Validation**: Errors caught before deployment
- **Multi-event Support**: XV Años, Weddings, Baptisms, Birthdays
- **Theme Integration**: Connects to the Aesthetic Presets system
- **Asset Management**: Seamless integration with AssetRegistry

**File Location**: `src/content/events/*.json`

---

## Event Types

### XV Años (`xv`)

Quinceañera celebrations marking a young woman's 15th birthday.

**Characteristics**:

- Formal, milestone celebration
- Typically uses `jewelry-box` preset for elegance
- Full ceremony/reception structure common
- Extended family and godparents featured prominently

### Wedding (`boda`)

Wedding celebrations for couples.

### Baptism (`bautizo`)

Religious ceremonies for infant or adult baptism.

### Birthday (`cumple`)

Birthday celebrations for all ages.

---

## Schema Reference

### Core Fields

#### `eventType` (required)

**Type**: `enum['xv' | 'boda' | 'bautizo' | 'cumple']`

Determines the route and default styling for the invitation.

#### `title` (required)

**Type**: `string`

SEO title and internal reference for the event.

#### `description` (optional)

**Type**: `string`

Brief description for SEO and meta tags. Keep under 160 characters.

#### `isDemo` (optional)

**Type**: `boolean`

Marks the event as a demo/example for testing and showcasing.

---

### Theme Configuration

#### `theme` (required)

**Type**: `object`

Core visual configuration connecting to the design system.

```json
{
	"theme": {
		"primaryColor": "#d4af37",
		"accentColor": "#111111",
		"fontFamily": "serif",
		"preset": "jewelry-box"
	}
}
```

**Properties**:

| Property       | Type                                       | Required | Description            |
| -------------- | ------------------------------------------ | -------- | ---------------------- |
| `primaryColor` | `string (hex)`                             | Yes      | Main brand color       |
| `accentColor`  | `string (hex)`                             | No       | Secondary accent color |
| `fontFamily`   | `enum['serif' \| 'sans']`                  | No       | Base font family       |
| `preset`       | `enum['jewelry-box' \| 'luxury-hacienda']` | No       | Aesthetic preset       |

---

### Section Styles

#### `sectionStyles` (optional)

**Type**: `object`

Per-section theme customization. Allows each section to have a unique visual treatment.

```json
{
	"sectionStyles": {
		"quote": {
			"variant": "jewelry-box",
			"fontStyle": "script",
			"animation": "bounce"
		},
		"countdown": {
			"variant": "minimal",
			"numberStyle": "thin",
			"showParticles": false
		}
	}
}
```

**Available Sections and Variants**:

| Section     | Available Variants                                                             | Default      |
| ----------- | ------------------------------------------------------------------------------ | ------------ |
| `quote`     | `elegant`, `modern`, `minimal`, `floral`, `jewelry-box`, `luxury-hacienda`     | `elegant`    |
| `countdown` | `minimal`, `vibrant`, `classic`, `modern`, `jewelry-box`, `luxury-hacienda`    | `minimal`    |
| `location`  | `structured`, `organic`, `minimal`, `luxury`, `jewelry-box`, `luxury-hacienda` | `structured` |
| `family`    | `jewelry-box`, `luxury-hacienda`                                               | `standard`   |
| `gifts`     | `jewelry-box`, `luxury-hacienda`                                               | `standard`   |

---

### Hero Section

#### `hero` (required)

**Type**: `object`

Main invitation header with celebrant information.

```json
{
	"hero": {
		"name": "Lucía García",
		"nickname": "Lucy",
		"date": "2026-04-25T18:00:00.000Z",
		"backgroundImage": "hero",
		"portrait": "portrait"
	}
}
```

**Properties**:

| Property          | Type                | Required | Description                        |
| ----------------- | ------------------- | -------- | ---------------------------------- |
| `name`            | `string`            | Yes      | Full name of the celebrated person |
| `nickname`        | `string`            | No       | Informal name or nickname          |
| `date`            | `string (ISO 8601)` | Yes      | Event date and time                |
| `backgroundImage` | `string`            | Yes      | Asset key for hero background      |
| `portrait`        | `string`            | No       | Asset key for celebrant portrait   |

---

### Location Section

#### `location` (required)

**Type**: `object`

Venue information with support for ceremony and reception.

```json
{
	"location": {
		"venueName": "Quinta Las Flores",
		"address": "Av. Real de Catorce 123, Monterrey, N.L.",
		"city": "Monterrey",
		"ceremony": {
			"venueEvent": "Ceremonia",
			"venueName": "Parroquia de la Sagrada Familia",
			"address": "Avenida Ayuntamiento s/n",
			"date": "25 de abril de 2026",
			"time": "6:00 PM",
			"coordinates": { "lat": 25.6816, "lng": -100.252 }
		},
		"reception": {
			"venueEvent": "Recepción",
			"venueName": "Quinta Las Flores",
			"time": "8:00 PM",
			"itinerary": [{ "icon": "waltz", "label": "Vals", "time": "9:00 PM" }]
		}
	}
}
```

---

### Family Section

#### `family` (optional)

**Type**: `object`

Family and godparent information.

```json
{
	"family": {
		"parents": {
			"father": "Sr. Roberto Pérez",
			"mother": "Sra. Esthela de Pérez"
		},
		"spouse": "Nombre del Cónyuge",
		"children": [{ "name": "Hijo 1", "role": "optional" }],
		"godparents": [{ "name": "Sr. Juan Carlos", "role": "Padrino de Honor" }],
		"featuredImage": "family"
	}
}
```

---

### RSVP Section

#### `rsvp` (optional)

**Type**: `object`

Guest confirmation form configuration.

```json
{
	"rsvp": {
		"title": "¿Vienes a celebrar conmigo?",
		"guestCap": 2,
		"confirmationMessage": "¡Gracias por confirmar! Te esperamos."
	}
}
```

---

### Gifts Section

#### `gifts` (optional)

**Type**: `array`

Gift registry options using discriminated union types.

```json
{
	"gifts": [
		{
			"type": "store",
			"name": "Liverpool",
			"url": "https://mesaderegalos.liverpool.com.mx/"
		},
		{
			"type": "bank",
			"bankName": "BBVA México",
			"accountHolder": "Nombre del Titular",
			"clabe": "0121 8001 2345 6789 01"
		},
		{
			"type": "paypal",
			"url": "https://paypal.me/username"
		},
		{
			"type": "cash",
			"text": "Contaremos con una tómbola para sobres..."
		}
	]
}
```

---

### Additional Sections

- **quote**: Inspirational message from the celebrated person
- **thankYou**: Closing gratitude message
- **music**: Background music configuration
- **gallery**: Photo gallery with captions
- **envelope**: Animated envelope reveal
- **itinerary**: Event timeline/schedule
- **countdown**: Countdown timer customization
- **navigation**: Custom navigation links

See the full schema in `src/content/config.ts` for complete details.

---

## Asset Integration

Content collections work with the AssetRegistry system for image management.

### File Naming Convention

Place images in: `src/assets/images/events/{event-slug}/`

**Required Files**:

- `hero.webp` - Main cover image
- `portrait.webp` - Celebrant portrait
- `jardin.webp` - Venue/location photo
- `signature.webp` - Decorative element
- `gallery-01.webp` through `gallery-11.webp` - Gallery images

**Asset Key Mapping**:

- `"hero"` maps to `hero.webp`
- `"gallery01"` maps to `gallery-01.webp`
- `"portrait"` maps to `portrait.webp`

### AssetRegistry Connection

```typescript
const heroAsset = getEventAsset('event-slug', 'hero');
// Returns: { src: 'hero.webp', alt: 'Event Display Name' }
```

---

## Route Generation

Events generate routes based on `eventType` and filename:

**File**: `src/content/events/mi-xv-2026.json` with `"eventType": "xv"`

**Generated Route**: `/xv/mi-xv-2026`

---

## Validation

### Build-time Validation

```bash
pnpm check    # TypeScript validation
pnpm build    # Full build with content validation
```

### Common Validation Errors

| Error                | Cause                  | Solution                 |
| -------------------- | ---------------------- | ------------------------ |
| `Required`           | Missing required field | Add the missing field    |
| `Invalid enum value` | Variant doesn't exist  | Use a valid variant name |
| `Invalid datetime`   | Date format incorrect  | Use ISO 8601 format      |
| `Invalid url`        | Malformed URL          | Ensure proper URL format |

---

## Best Practices

### Content Guidelines

1. **Use Semantic Slugs**: `xv-maria-2026` instead of `event1`
2. **Optimize Images**: Use WebP format, max 500KB per image
3. **Write Descriptions**: Keep under 160 characters for SEO
4. **Date Format**: Use ISO 8601 with timezone

### Section Configuration

1. **Start Simple**: Use default variants initially
2. **Theme Consistency**: Match sectionStyles to theme.preset
3. **Test All Sections**: Enable sections one by one

### Asset Management

1. **Follow Naming Convention**: Lowercase, kebab-case
2. **Optimize Before Adding**: Compress images
3. **Test Asset Loading**: Verify all images display

---

## Related Documentation

- `docs/ASSET_REGISTRY_GUIDE.md` - Asset management and registration
- `docs/THEME_SYSTEM.md` - Theme variants and customization
- `docs/ARCHITECTURE.md` - System architecture overview
- `src/content/config.ts` - Zod schema definition
