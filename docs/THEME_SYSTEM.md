# Sistema de Personalización de Temas - Celebra-me

## Resumen

Este documento describe el sistema de personalización visual que permite a cada evento tener una
identidad única e irrepetible. Los eventos ahora pueden definir estilos específicos por sección,
eliminando la similitud entre invitaciones.

## Estructura de Configuración

Cada evento puede configurar sus estilos en el archivo JSON correspondiente:

```json
{
	"sectionStyles": {
		"quote": {
			"variant": "elegant",
			"fontStyle": "serif",
			"animation": "fade"
		},
		"countdown": {
			"variant": "vibrant",
			"numberStyle": "bold",
			"showParticles": true
		},
		"location": {
			"variant": "organic",
			"mapStyle": "colorful",
			"showFlourishes": true
		}
	}
}
```

## Variantes Disponibles

### Quote Section

| Variante          | Descripción                                                                                                | Status    | Mejor para                               |
| :---------------- | :--------------------------------------------------------------------------------------------------------- | :-------- | :--------------------------------------- |
| `elegant`         | Clásico, fondo cuero oscuro, serif, transiciones suaves                                                    | [APPLIED] | Bodas formales, aniversarios             |
| `modern`          | Juvenil, gradientes pasteles, script, animaciones bounce                                                   | [APPLIED] | XV Años, fiestas modernas                |
| `jewelry-box`     | **Premium Luxury**, fondo pergamino marfil, `Pinyon Script`, animaciones `premiumFadeUp`, acentos dorados. | [APPLIED] | **XV Años Premium**, Bodas de Lujo       |
| `luxury-hacienda` | **Masculine Elite**, fondo pergamino con textura, tipografía Hacienda, acentos cobre/café.                 | [APPLIED] | **Gerardo 60**, Eventos rústicos de lujo |
| `minimal`         | Limpio, sans-serif, fondo claro simple                                                                     | [APPLIED] | Eventos corporativos, bodas minimalistas |

### Hero Section

| Variante          | Descripción                                                               | Status    | Mejor para          |
| :---------------- | :------------------------------------------------------------------------ | :-------- | :------------------ |
| `standard`        | Diseño base con overlays estándar                                         | [APPLIED] | Genérico            |
| `jewelry-box`     | Glassmorphism profundo, light sweep, animaciones de foil de oro           | [APPLIED] | **XV Años Premium** |
| `luxury-hacienda` | Estética de cuero y metal, tipografía con shimmer dorado, bordes rústicos | [APPLIED] | **Gerardo 60**      |

> [!NOTE] Recent refinements to `jewelry-box` and `luxury-hacienda` themes include optimized scroll
> icons and responsive action buttons.

### RSVP Section

| Variante          | Descripción                                                   | Status    | Mejor para          |
| :---------------- | :------------------------------------------------------------ | :-------- | :------------------ |
| `standard`        | Formulario base con estilos neutros                           | [APPLIED] | Genérico            |
| `jewelry-box`     | Botones glass con bordes dorados, tipografía manuscrita sutil | [APPLIED] | **XV Años Premium** |
| `luxury-hacienda` | Botones de alto contraste (café/oro), tipografía UI bloqueada | [APPLIED] | **Gerardo 60**      |

### Itinerary Section

| Variante          | Descripción                                                | Status    | Mejor para          |
| :---------------- | :--------------------------------------------------------- | :-------- | :------------------ |
| `base`            | Línea de tiempo editorial limpia                           | [APPLIED] | Eventos formales    |
| `jewelry-box`     | Iconografía glassmorphic, acentos oro líquido              | [APPLIED] | **XV Años Premium** |
| `luxury-hacienda` | Estética rústica, iconos cuero/bronce, tipografía Hacienda | [APPLIED] | **Gerardo 60**      |

### Envelope Reveal (Sobre)

| Variante          | Descripción                                                   | Status    | Mejor para          |
| :---------------- | :------------------------------------------------------------ | :-------- | :------------------ |
| `jewelry-box`     | Sello de oro brillante, tarjeta blanca minimalista            | [APPLIED] | **XV Años Premium** |
| `luxury-hacienda` | Sobre de cuero, sello de lacre oscuro, tarjeta Hacienda beige | [APPLIED] | **Gerardo 60**      |

### Countdown Section

| Variante      | Descripción                                                                                            | Status    | Mejor para                             |
| :------------ | :----------------------------------------------------------------------------------------------------- | :-------- | :------------------------------------- |
| `minimal`     | Números finos, fondo pergamino, diseño limpio                                                          | [APPLIED] | Eventos formales                       |
| `vibrant`     | Números bold, gradientes vibrantes, partículas                                                         | [APPLIED] | XV Años convencionales                 |
| `jewelry-box` | **Sophisticated**, números delgados `Playfair Display`, glassmorphism, fondo crema, sin distracciones. | [APPLIED] | **Demo XV**, Invitaciones de alta gama |
| `classic`     | Atemporal, números serif, bordes dorados, fondo oscuro                                                 | [APPLIED] | Bodas tradicionales                    |

### Location Section

| Variante      | Descripción                                                                           | Status    | Mejor para           |
| :------------ | :------------------------------------------------------------------------------------ | :-------- | :------------------- |
| `structured`  | Layout en grid, bordes definidos, tarjetas rígidas                                    | [APPLIED] | Eventos corporativos |
| `organic`     | Curvas suaves, flourishes florales, colores pasteles                                  | [APPLIED] | XV Años estándar     |
| `jewelry-box` | **Immersion**, marcos de oro fino, fondo marfil, tipografía `EB Garamond` optimizada. | [PENDING] | **XV Años Premium**  |
| `luxury`      | Tema oscuro, acentos dorados, detalles sofisticados                                   | [APPLIED] | Bodas de lujo        |

### Family & Gifts

| Variante      | Descripción                                                                        | Status    | Secciones     |
| :------------ | :--------------------------------------------------------------------------------- | :-------- | :------------ |
| `standard`    | Layout base por defecto                                                            | [APPLIED] | Todas         |
| `jewelry-box` | Vidrio esmerilado, bordes de oro líquido, tipografía marfil sobre crema, glass-ui. | [APPLIED] | Family, Gifts |
| `floral`      | Decoraciones botánicas sutiles                                                     | [PENDING] | Family        |

## Configuración de Eventos Actuales

### Gerardo - 60 Años (Tema: Luxury Hacienda)

```json
"sectionStyles": {
  "quote": {
    "variant": "elegant"
  },
  "countdown": {
    "variant": "minimal"
  },
  "location": {
    "variant": "structured"
  }
}
```

**Identidad Visual:** Leather texture, dark gold, serious serif approach.

### XV Años - Demo (Tema: Jewelry Box)

```json
"sectionStyles": {
  "quote": {
    "variant": "jewelry-box"
  },
  "countdown": {
    "variant": "jewelry-box"
  },
  "family": {
    "variant": "jewelry-box"
  },
  "gifts": {
    "variant": "jewelry-box"
  },
  "location": {
    "variant": "jewelry-box"
  }
}
```

**Identidad Visual:** Ivory parchment, Pinyon Script accents, liquid gold borders, airy spacing,
reduced saturation.

### Inventario Completo

Para una lista exhaustiva de todos los componentes, variantes y archivos de estilo asociados,
consulte el [Inventario de Temas](file:///c:/Code/celebra-me/docs/THEME_INVENTORY.md).

## Tokens de Diseño

### Colores Base

```scss
// Primarios
$color-action-accent: #d4af37; // Dorado
$color-surface-dark: #4b3621; // Café oscuro
$color-surface-primary: #f5f5dc; // Pergamino

// Texto
$color-text-primary: #4b3621; // Café principal
$color-text-on-dark: #f5f5dc; // Texto claro
$color-neutral-muted: #888; // Gris medio

// Acciones
$color-action-primary: #4b3621;
$color-border-subtle: rgba(75, 54, 33, 0.1);
```

### Tipografía

```scss
// Fuentes Display
$font-display-elegant: 'Playfair Display', serif;
$font-display-formal: 'Cormorant Garamond', serif;

// Fuentes Body
$font-body: 'EB Garamond', serif;
$font-ui: 'Inter', sans-serif;

// Fuentes Decorativas
$font-decorative-calligraphy: 'Pinyon Script', cursive;
$font-heading-elegant: 'Playfair Display', serif;
$font-heading-modern: 'Montserrat', sans-serif;
$font-heading-formal: 'Cormorant Garamond', serif;
```

### Espaciado

```scss
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 2rem;
$spacing-xl: 4rem;
$spacing-2xl: 6rem;
```

### Movimiento

```scss
// Duraciones
$duration-snappy: 0.2s;
$duration-standard: 0.4s;
$duration-smooth: 0.6s;
$duration-slower: 0.8s;

// Easing
$ease-premium: cubic-bezier(0.22, 1, 0.36, 1);
$ease-out: cubic-bezier(0.16, 1, 0.3, 1);
$ease-in: cubic-bezier(0.7, 0, 0.84, 0);
$ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

## Arquitectura de Archivos

```markdown
src/styles/themes/ ├── presets/ │ ├── \_jewelry-box.scss # SOLO inyección de variables CSS │ └──
\_luxury-hacienda.scss # SOLO inyección de variables CSS └── sections/ ├── \_index.scss # Exporta
todos los temas ├── \_base-theme.scss # Overrides globales y filtros por variante ├──
\_hero-theme.scss # Hero UI por variante ├── \_quote-theme.scss # Quote UI por variante ├──
\_rsvp-theme.scss # RSVP UI por variante ├── \_reveal-theme.scss # Envelope/Seal UI por variante └──
... # Otros temas de sección
```

> [!IMPORTANT] **Ley de Aislamiento**: Los archivos en `presets/` NUNCA deben contener estilos CSS
> directos ni selectores de clase (ej. `.card`). Su única responsabilidad es definir variables CSS.
> Los estilos visuales se encapsulan en `sections/` exclusivamente usando selectores de atributo
> `[data-variant]`.

## Implementación Técnica

### Componentes Actualizados

1. **Quote.astro**: Acepta `variant` y `animation`
2. **Countdown.astro**: Acepta `variant` y `showParticles`
3. **EventLocation.astro**: Acepta `variant`, `mapStyle` y `showFlourishes`
4. **EnvelopeReveal.tsx**: Acepta `variant`
5. **Itinerary.astro**: Acepta `variant`
6. **RSVP.tsx**: Acepta `variant`

### Schema Extendido (config.ts)

El schema de Zod ahora incluye configuración por sección:

```typescript
sectionStyles: z.object({
	quote: z.object({
		variant: z.enum(['elegant', 'modern', 'minimal', 'floral', 'jewelry-box']),
		fontStyle: z.enum(['serif', 'script', 'sans']),
		animation: z.enum(['fade', 'bounce', 'elastic', 'none']),
	}),
	countdown: z.object({
		variant: z.enum(['minimal', 'vibrant', 'classic', 'modern', 'jewelry-box']),
		numberStyle: z.enum(['thin', 'bold', 'monospace']),
		showParticles: z.boolean(),
	}),
	location: z.object({
		variant: z.enum(['structured', 'organic', 'minimal', 'luxury', 'jewelry-box']),
		mapStyle: z.enum(['dark', 'colorful', 'minimal', 'satellite']),
		showFlourishes: z.boolean(),
	}),
	rsvp: z.object({
		variant: z.enum(['standard', 'jewelry-box', 'luxury-hacienda']),
		labels: z
			.object({
				name: z.string().optional(),
				guestCount: z.string().optional(),
				attendance: z.string().optional(),
				confirmButton: z.string().optional(),
			})
			.optional(),
	}),
});

// Configuración de WhatsApp (Tier 3)
whatsappConfig: z.object({
	phone: z.string(),
	messageTemplate: z.string().optional(),
	confirmedTemplate: z.string().optional(),
	declinedTemplate: z.string().optional(),
	omitTitle: z.boolean().optional(),
});

// Hero Props
hero: z.object({
	name: z.string(),
	label: z.string().optional(), // Ej: "Mis XV Años", "Nuestra Boda"
	date: z.string(),
	backgroundImage: z.string(),
});
```

## Validación de Diferenciación

Para asegurar 0% de similitud visual entre eventos:

| Sección   | Gerardo (60 años)                              | XV Años (Demo)                                      | Diferenciación |
| :-------- | :--------------------------------------------- | :-------------------------------------------------- | :------------- |
| Quote     | Fondo cuero oscuro, serif, transiciones suaves | Fondo pergamino marfil, script, animaciones premium | 100%           |
| Countdown | Números finos, pergamino, sin partículas       | Números delgados Playfair, glassmorphism            | 100%           |
| Location  | Estructurado, mapa oscuro, bordes dorados      | Orgánico, colores pastel, flourishes florales       | 100%           |

## Próximos Pasos

1. Crear más variantes según necesidades de clientes
2. Agregar soporte para animaciones personalizadas
3. Implementar sistema de preview en tiempo real
4. Agregar más opciones de personalización para otras secciones
