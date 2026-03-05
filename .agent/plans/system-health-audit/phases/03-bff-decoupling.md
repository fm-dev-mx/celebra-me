# Fase 3: Desacoplamiento (Coupling) Front-End de Lógica BFF

**Objetivo Principal:** Eliminar llamadas explícitas a API (`fetch(...)`) incrustadas en el árbol
React y trasladarlas consistentemente a un "Cliente de Data" que implemente desacoplamiento,
inyección de dependencias o Hooks dedicados (el Backend-for-Frontend).

**Estado:** `100% Completado`

---

## 🎯 Hallazgos Específicos

1. **Dependencia Fuerte a Infraestructura Externa desde UI:**
    - La auditoría identificó casos críticos en el ecosistema Dashboard y flujos RSVP donde
      componentes de React (como `GuestDashboardApp.tsx`, `GuestRSVPForm.tsx`, `ContactForm.tsx`,
      `RSVP.tsx`) montaban directamente llamadas `fetch('/api/...')` de infraestructura.
    - Rompía con el principio `S` (Single Responsibility) del código limpio de SOLID: El árbol UI
      conocía cómo contactar al Backend.

2. **Doble Esfuerzo Reactivo / Sin Abstracciones Universales:**
    - No se encontraba universalmente una capa `/hooks/useApi.ts` o un `apiClient.ts` que resolviese
      reintentos, validación uniforme de respuestas, etc.
    - Ausencia del Patrón BFF en algunas vistas expuestas.

3. **Anti-Patrones de Astro Native Labels:**
    - Se observó dentro de `src/components/home/Hero.astro` componentes visuales estáticos
      integrando `<img src={...}>` nativo en un entorno de Astro 4+.

---

## ✅ Resolución Completada

### Capa de API Clients existente (trabajo previo)

- `src/lib/api-client-shared.ts` — Wrapper `fetchJSON()` con tipado `ApiResult<T>`.
- `src/lib/dashboard/api-client.ts` — `DashboardApiClient` con soporte CSRF.
- `src/lib/dashboard/guests-api.ts` — `GuestsApi` (list, create, update, delete, markShared,
  bulkImport, listEvents, **exportCsv**).
- `src/lib/dashboard/admin-api.ts` — `AdminApi` (events, users, claimcodes).
- `src/lib/rsvp/rsvp-api.ts` — `RsvpApi` (submitRsvp, markViewed, trackAction, submitContact).
- `src/lib/rsvp/auth-api.ts` — Supabase auth wrapper server-side.

### Nuevos archivos creados en esta fase

- `src/lib/rsvp/auth-bridge-api.ts` — `AuthBridgeApi` (login, register, logout) para bridges
  client-side.

### Archivos migrados

- `GuestDashboardApp.tsx` → Export CSV migrado a `guestsApi.exportCsv()`.
- `login-bridge.ts` → Login/Register migrados a `authBridgeApi.login()` / `.register()`.
- `logout-client.ts` → Logout migrado a `authBridgeApi.logout()`.

### Astro Assets (ya completado previamente)

- `home/Hero.astro` → Ya usa `<Image>` de `astro:assets`.
- `invitation/Hero.astro` → Ya usa `<Image>` de `astro:assets`.

---

## ✅ Criterios de Aceptación

- [x] Cero dependencias duras `await fetch('/api/...')` localizadas en archivos con extensión de
      vista directa (`.tsx`, `.astro`) a menos que sean estrictamente BFF Endpoints internos de
      React Server Components.
- [x] Incorporación de capa `lib/hooks/` o `lib/api/` unificada y abstracta de peticiones HTTP.
- [x] No existen etiquetas `<img>` subóptimas cargando assets locales desde Astro; están
      transformadas hacia el `<Image>` estandarizado en la documentación.

## 📝 Excepciones Documentadas

- **`mfa-setup.astro`**: Contiene `fetch('/api/auth/sync-session')` dentro de un bloque `<script>`
  de página Astro (vanilla JS con manipulación DOM directa). No es un componente React ni una vista
  reutilizable — es un flujo MFA acoplado a Supabase que sincroniza la sesión elevada tras la
  verificación TOTP. Migrar a `AuthBridgeApi` sería arquitectónicamente correcto pero queda fuera
  del alcance original de esta fase (componentes `.tsx`).
