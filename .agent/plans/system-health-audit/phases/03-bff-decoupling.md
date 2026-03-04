# Fase 3: Desacoplamiento (Coupling) Front-End de Lógica BFF

**Objetivo Principal:** Eliminar llamadas explícitas a API (`fetch(...)`) incrustadas en el árbol
React y trasladarlas consistentemente a un "Cliente de Data" que implemente desacoplamiento,
inyección de dependencias o Hooks dedicados (el Backend-for-Frontend).

**Estado:** `0% Completado`

---

## 🎯 Hallazgos Específicos

1. **Dependencia Fuerte a Infraestructura Externa desde UI:**
    - La auditoría identificó casos críticos en el ecosistema Dashboard y flujos RSVP donde
      componentes de React (como `GuestDashboardApp.tsx`, `GuestRSVPForm.tsx`, `ContactForm.tsx`,
      `RSVP.tsx`) montan directamente llamadas `fetch('/api/...')` de infraestructura.
    - Rompe con el principio `S` (Single Responsibility) del código limpio de SOLID: El árbol UI
      conoce cómo contactar al Backend.

2. **Doble Esfuerzo Reactivo / Sin Abstracciones Universales:**
    - En base a inspecciones, no se encuentra o no se está utilizando universalmente una capa
      `/hooks/useApi.ts` o un `apiClient.ts` que resuelva reintentos, validación uniforme de
      respuestas, etc. (O si lo hace, no está generalizado a todos).
    - Ausencia del Patrón BFF en algunas vistas expuestas.

3. **Anti-Patrones de Astro Native Labels:**
    - Observé dentro de `src/components/home/Hero.astro` componentes visuales estáticos integrando
      `<img src={...}>` nativo en un entorno de Astro 4+. Las reglas oficiales dictan utilizar el
      componente asíncrono `<Image />` desde `astro:assets` para performance.

---

## 🛠️ Plan de Ejecución Paso a Paso

### 1. Extracción de Funcionalidades a API Clients o Hooks

- Crear y estandarizar un cliente API (e.g., `src/lib/api-client.ts`) que haga de Wrapper sobre
  `fetch` local si es necesario (o `axios` / framework de data fetching, o TanStack Query de estar
  en uso), ofreciendo `.get()`, `.post()`.
- Migrar las peticiones en crudo `fetch(...)` ubicadas en `GuestDashboardApp.tsx`,
  `ContactForm.tsx`, `GuestRSVPForm.tsx`, y cualquier otra expuesta en componentes, hacia custom
  hooks como `useGuests(...)`, `useRSVP(...)` que empaqueten las firmas.

### 2. Estabilización Astro Assets

- Realizar limpieza global de etiquetas HTML `<img>` (imágenes locales/estáticas que no sean
  external CDN si se requiere optimización) e importar explícitamente y usar el tag
  `<Image src={avatar1} alt="..." />` conforme a mejores prácticas establecidas en la propia
  documentación.

### 3. Integridad E2E (Evitar Romper Tests Locales)

- Asegurar que este "refactor" reasigne las firmas que los tests ya están "mockeando" si los tests
  dependían de spyOn a los Global `fetch`.

---

## ✅ Criterios de Aceptación

- [ ] Cero dependencias duras `await fetch('/api/...')` localizadas en archivos con extensión de
      vista directa (`.tsx`, `.astro`) a menos que sean estrictamente BFF Endpoints internos de
      React Server Components (si aplica, pero siendo client-side, debe haber Cliente API).
- [ ] Incorporación de capa `lib/hooks/` o `lib/api/` unificada y abstracta de peticiones HTTP.
- [ ] No existen etiquetas `<img>` subóptimas cargando assets locales desde Astro; están
      transformadas hacia el `<Image>` estandarizado en la documentación (Architecture Mismatch
      Resuelto).
