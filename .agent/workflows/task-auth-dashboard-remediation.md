---
description: Depuración y refuerzo del sistema de login, registro de hosts y persistencia de MFA.
---

# 🛠️ Workflow: Auth & Dashboard Remediation

Este workflow guía la resolución de errores críticos en el flujo de autenticación, el registro de
anfitriones y la usabilidad del dashboard.

## 1. Diagnóstico de Middleware y Sesiones

- Analizar `src/middleware.ts` para identificar por qué `/dashboard/invitados` produce redirecciones
  no deseadas (ghosting).
- Verificar la sincronización de cookies entre el cliente y el servidor, especialmente tras el
  login.

// turbo

- `pnpm test src/middleware.test.ts` (si existe) para validar casos de borde.

## 2. Remediación del Registro de Hosts

- Corregir el flujo POST en `src/pages/api/auth/register-host.ts`.
- Asegurar que `ensureUserRole` y `claimEventForUserByClaimCode` no interrumpan el flujo si el
  usuario ya existe en Supabase pero el proceso de registro local falló previamente.
- Mejorar el feedback de error para que sea descriptivo y no un "No se pudo registrar" genérico.

## 3. Implementación de Persistencia MFA (Trusted Device)

- Extender la lógica en `src/pages/dashboard/mfa-setup.astro` para que tras una verificación
  exitosa, se emita una cookie de confianza (`sb-trust-device`).
- Actualizar `src/middleware.ts` para respetar esta cookie y evitar pedir MFA en cada inicio de
  sesión durante el periodo de validez (30 días).

## 4. Refuerzo de UX en MFA

- Modificar `src/pages/dashboard/mfa-setup.astro` para permitir el envío del código mediante la
  tecla **Enter**.
- Asegurar que el botón de verificación muestre un estado de carga visualmente coherente con la
  estética "Jewelry Box".

## 5. Verificación y Cierre

- Ejecutar pruebas de integración para el flujo de registro y login.
- Realizar pruebas manuales de:
    - Registro con Claim Code.
    - Login de Superadmin con MFA persistente.
    - Navegación al dashboard sin rebotes.

- **Auto-archivo**: Una vez completado, mover este workflow a `.agent/workflows/archive/` o
  eliminarlo.

---

> [!CAUTION] **Critical Reflection**
>
> - **Fricción de Sincronización**: La actualización de sesiones en Supabase puede tardar unos
>   milisegundos en propagarse. Es vital asegurar que el API de `sync-session` sea atómico.
> - **Seguridad**: La cookie `sb-trust-device` debe ser `HttpOnly` y `Secure` para prevenir ataques
>   XSS, aunque sea verificada mediante firma JWT local.
