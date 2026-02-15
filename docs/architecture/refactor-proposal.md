# Propuesta de Refactorización Arquitectónica

**Estado**: Propuesta **Fecha**: 14 de Febrero, 2026 **Objetivo**: Mejorar la seguridad de tipos, la
separación de responsabilidades y la mantenibilidad del sistema de eventos.

---

## 1. El Problema: "The God Component" (`[slug].astro`)

Actualmente, `src/pages/[eventType]/[slug].astro` (350+ líneas) es responsable de demasiadas cosas:

1.  **Data Transformation**: Convierte strings de la DB/Content en objetos de Asset.
2.  **View Logic**: Decide qué componentes renderizar basado en flags complejos.
3.  **Client Hydration**: Inyecta scripts inline para desbloquear el sobre.

Esto viola el principio de responsabilidad única y hace que agregar nuevos features (como un nuevo
tipo de sección) sea riesgozo.

## 2. La Brecha de Seguridad: Assets no Tipados

Aunque tenemos un `AssetRegistry.ts` robusto, su seguridad se pierde en la frontera con el CMS
(Content Collections):

- **Código Seguro**: `getEventAsset(id, 'hero')` (Tipado estricto)
- **CMS Real**: `data.hero.backgroundImage` (Es solo un `string`)

Si un editor pone "hero-bg.jpg" en el JSON, pero la key real es "heroBg", el error ocurre en
_runtime_ o se muestra una imagen rota, en lugar de fallar en el _build_.

---

## 3. La Solución: Patrón "Typed View Models"

Propongo introducir una capa de **Adaptadores (Presenters)** que transformen la data cruda del CMS
en View Models estrictamente tipados y listos para consumir.

### A. Adaptador de Evento (`src/lib/adapters/event.ts`)

```typescript
// Transforma CollectionEntry<'events'> -> InvitationViewModel
export function adaptEvent(entry: CollectionEntry<'events'>): InvitationViewModel {
	const { data } = entry;
	// Lógica centralizada de resolución de assets y fallbacks
	return {
		hero: {
			// Aquí se valida contra el Registry al transformar
			image: resolveRegistryAsset(entry.id, data.hero.backgroundImage),
			title: data.hero.name,
		},
		// ...
	};
}
```

### B. View Model Interface

```typescript
interface InvitationViewModel {
	theme: ThemeConfig;
	hero: HeroViewModel;
	// Array polimórfico de secciones ordenadas
	sections: Array<QuoteSection | GallerySection | RSVPSection>;
}
```

### C. Refactor de `[slug].astro`

El archivo pasaría de 350 líneas a ~50 líneas:

```astro
---
const eventWrapper = await getEntry('events', slug);
const viewModel = adaptEvent(eventWrapper);
---

<Layout theme={viewModel.theme}>
	<Hero {...viewModel.hero} />

	{viewModel.sections.map((section) => <SectionRenderer section={section} />)}
</Layout>
```

---

## 4. Mejora Adicional: "Asset Keys as Config"

Modificar `src/content/config.ts` para que Zod valide las keys de los assets contra el Registry:

```typescript
import { AssetKeys } from '@/lib/assets/AssetRegistry';

// En Zod
backgroundImage: z.enum(AssetKeys), // Error de build si la key no existe
```

Esto requiere exportar las keys del Registry como un array de strings (tuple) para que Zod las
consuma.

---

## 5. Beneficios

1.  **Build Safety**: Errores en nombres de assets rompen el build, no la UI en producción.
2.  **Testability**: Podemos probar `adaptEvent` con unit tests simples sin montar componentes
    Astro.
3.  **Developer Experience**: Autocompletado real para las props de los componentes, en lugar de
    pasar `data.sectionStyles?.quote?.variant` manualmente.

## Recomendación Inmediata

Implementar el **Adaptador de Evento** (`src/lib/adapters/event.ts`) antes de agregar más
complejidad al sistema de RSVP v2.
