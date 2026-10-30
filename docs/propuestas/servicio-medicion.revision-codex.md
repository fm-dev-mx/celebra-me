# Revisión 2: Viabilidad técnica contra el repositorio · Servicio de medición y campañas

**Fecha:** 30 de octubre de 2026  
**Revisor:** Codex (`f05-plataforma · T465 · PR #673`, ejecutado por identidad gemini)  
**Documentos evaluados:**

- [docs/propuestas/servicio-medicion.md](servicio-medicion.md)
- [docs/propuestas/plan-medicion-celebra-me.md](plan-medicion-celebra-me.md)
- [docs/propuestas/servicio-medicion.revision-gemini.md](servicio-medicion.revision-gemini.md)

---

## 1. Veredicto

**Aprobada con observaciones técnicas críticas**

### Resumen ejecutivo del dictamen técnico

La propuesta técnica de un servicio multi-inquilino (_multi-tenant_) de medición y atribución de
campañas publicitarias es viable y responde a una necesidad crítica de mercado. Sin embargo, su
éxito técnico y operativo depende de una decisión arquitectónica fundamental: el servicio debe
desarrollarse en un **monorepo separado** y no incrustado dentro del monolito de Celebra-me.

Incrustar un sistema B2B multi-inquilino dentro de la base de código de Celebra-me colisionaría con
el ciclo de vida de un producto orientado a invitaciones digitales, mezclaría esquemas de datos con
filosofías de seguridad incompatibles (Celebra-me utiliza intensivamente `useServiceRole: true` en
sus endpoints de servidor, lo que anula las políticas de RLS), aumentaría el radio de impacto ante
fallas de despliegue y ralentizaría la velocidad de desarrollo debido a la suite exhaustiva de
validaciones y pruebas de CI de Celebra-me.

Asimismo, esta revisión confirma y valida los hallazgos de la Revisión 1 (Gemini `T464`), destacando
su impacto directo en los contratos de eventos de Meta Business Messaging, TikTok y Google Ads, e
introduce salvaguardas técnicas concretas sobre concurrencia en la tabla `outbox` mediante
arrendamiento atómico (`claim_id`), cifrado en reposo para credenciales de terceros en la tabla
`connections`, monitoreo activo en `packages/watch` para evitar fallas silenciosas y la captura de
identificadores de clic de TikTok (`ttclid`) y Google (`gclid`) que actualmente no existen en el
cliente de rastreo.

---

## 2. Impacto técnico de los hallazgos de la Revisión 1 (Gemini T464)

Se evaluó la relevancia técnica de cada hallazgo emitido en la Revisión 1:

| Hallazgo Gemini | Título / Tema                                                       | Severidad | Impacto técnico en código y arquitectura                                                                                                                                                                                                                                                                                                          |
| :-------------- | :------------------------------------------------------------------ | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hallazgo 1**  | Evento de compra en TikTok (`Purchase`)                             | Alta      | **Directo:** El adaptador `packages/dispatch/tiktok` debe configurarse con el nombre oficial `Purchase` (con parámetros obligatorios `properties.value` numérico y `properties.currency: "MXN"`), descartando `Compra con valor` y `PlaceAnOrder`. Evita el rechazo de eventos en runtime.                                                        |
| **Hallazgo 2**  | Eventos de prospectos en TikTok (`Contact` y `Lead`)                | Media     | **Directo:** El payload hacia TikTok Events API debe incluir el bloque `user` con identificadores normalizados bajo hash SHA-256 (teléfono E.164, email minúsculas) y el parámetro `ttclid` capturado en landing.                                                                                                                                 |
| **Hallazgo 3**  | Google Ads API: Retracciones y `order_id`                           | Alta      | **Directo:** Para soportar `RETRACTION` o `RESTATEMENT` ante cancelaciones (`order.canceled`), la subida de conversión inicial en `ConversionUploadService` debe enviar de forma obligatoria el identificador único `order_id`. Sin `order_id`, la retracción con solo `gclid` + timestamp es frágil y sujeta a descarte por desfase de segundos. |
| **Hallazgo 4**  | Lista blanca de Meta Business Messaging (`LeadSubmitted`)           | Alta      | **Directo:** Meta rechaza `QualifiedLead` u `OrderCanceled` con `action_source: "business_messaging"`. El adaptador de despacho de mensajería debe traducir `lead.qualified` a `LeadSubmitted`. `OrderCanceled` no puede despacharse a Meta en mensajería y debe quedar como evento de ajuste interno en la base de datos.                        |
| **Hallazgo 5**  | Alineación de objetivos de campaña en Meta Ads                      | Media     | **Operativo/Config:** Define la separación técnica entre campañas de mensajes directos y campañas web de conversión.                                                                                                                                                                                                                              |
| **Hallazgo 6**  | Desfase de cobro y riesgo de ROAS inflado                           | Media     | **Negocio/Datos:** Reglas de atribución de valor en `orders` y disparador de `Purchase`.                                                                                                                                                                                                                                                          |
| **Hallazgo 7**  | Desconexión de WhatsApp tras 14 días y webhook `ACCOUNT_OFFBOARDED` | Alta      | **Directo:** El servicio de ingestión (`packages/ingest`) y el vigilante (`packages/watch`) deben suscribirse a los webhooks de ciclo de vida del BSP/Meta para alertar inmediatamente si la app móvil pierde conexión, antes de que los anuncios pierdan atribución.                                                                             |
| **Hallazgo 8**  | Sustituir «Sitio web completo» por «Landing page de conversión»     | Alta      | **Alcance:** Elimina desarrollo de software a medida fuera del core de medición; estandariza la integración con `@medicion/capture`.                                                                                                                                                                                                              |
| **Hallazgo 9**  | Costos directos de terceros (_pass-through_) y SLA                  | Media     | **Operativo:** Modelo de costos de infraestructura.                                                                                                                                                                                                                                                                                               |
| **Hallazgo 10** | Hipótesis interna de tarifas                                        | Media     | **Operativo:** Modelo comercial de prueba en piloto.                                                                                                                                                                                                                                                                                              |
| **Hallazgo 11** | Conciliación Cliente Cero (Celebra-me) vs ICP B2B                   | Media     | **Arquitectura:** Celebra-me valida la robustez técnica (_dogfooding_ del pipeline y CAPI); clientes externos validan volumen algorítmico y rentabilidad.                                                                                                                                                                                         |
| **Hallazgo 12** | Marco legal LFPDPPP, Decreto DOF 2025-03-20 y SHA-256               | Alta      | **Normativo/Técnico:** Clarificación de que SHA-256 es un hash unidireccional irreversible (no cifrado) y que los datos con hash son datos personales seudonimizados; figura de Encargado con DPA.                                                                                                                                                |

---

## 3. Revisión técnica contra el código real del repositorio

### 3.1. Monorepo separado vs. Dentro de Celebra-me (Costo real de cada opción)

Se contrastaron las dos opciones arquitectónicas frente a los artefactos existentes en Celebra-me:

1. **Infraestructura y Runtime Existente:**
   - Celebra-me está implementado con Astro SSR sobre **Cloudflare Workers** (`@astrojs/cloudflare`,
     `wrangler.jsonc`). Los proveedores previos de funciones serverless fueron retirados y están
     vedados por guardas estructurales de CI (`scripts/validate-retired-provider-references.mjs`).
   - Las tareas programadas corren mediante disparadores cron nativos de Cloudflare Workers
     definidos en `wrangler.jsonc` y coordinados en `src/lib/server/scheduled-jobs.ts`.
   - El recolector diario de Meta Insights ya opera en el repositorio
     (`src/lib/meta/insights-collector.ts`), ejecutándose dentro del cron `engagement_maintenance`
     (10:43 UTC) e insertando en la tabla `meta_insights_daily`.
   - La captura web en cliente (`src/lib/tracking/client.ts`) y el servicio de ingesta de leads
     (`src/lib/tracking/lead-capture.service.ts`) operan actualmente de forma acoplada al esquema de
     eventos de invitaciones.

2. **Costo Real de Construir Dentro de Celebra-me:**
   - **Riesgo crítico de seguridad en RLS:** En Celebra-me, los servicios de backend y rutas API
     utilizan de forma generalizada `useServiceRole: true` para operaciones internas
     (`src/lib/rsvp/repositories/supabase.ts:133-140`, consumido por ejemplo en
     `src/lib/commercial/crm-timeline.service.ts:64` y
     `src/lib/commercial/meta-capi/lead-stage-events.ts:54,63`). El rol de servicio en Supabase pasa
     por alto todas las políticas de Row Level Security (RLS) a nivel base de datos. Si se alojan
     tablas multi-tenant de clientes externos (CEJ, clientes de construcción, etc.) en la misma base
     de datos de Celebra-me, cualquier consulta administrativa o rutina de fondo que use
     `useServiceRole: true` representaría un vector directo de fuga o contaminación cruzada de datos
     entre clientes.
   - **Fricción de Despliegue y CI/CD:** La suite completa de integración continua de Celebra-me
     (`pnpm run ci`), diseñada para salvaguardar una plataforma de producción de invitaciones,
     ejecuta verificación estricta de branding/logo, accesibilidad WCAG, validación estructural,
     cobertura de tipos completa y pruebas de render corpus. Desarrollar un servicio desacoplado
     dentro de este monorepo obligaría a que cada commit o iteración sobre adaptadores publicitarios
     corra esta suite pesada, ralentizando el ciclo de desarrollo frente a un monorepo enfocado con
     CI ágil.
   - **Ruptura de Principios de Dominio:** Alojar el servicio dentro de Celebra-me violaría de
     origen la Regla 1 (_Regla del segundo cliente_) y la Regla 2 (_Configuración, no copias_),
     induciendo a reutilizar modelos propios de invitaciones (`event_type: boda | xv`,
     `celebrant_names`) en un producto de atribución genérico.

3. **Costo Real de Construir en un Monorepo Separado:**
   - **Esfuerzo de arranque inicial:** Crear un repositorio limpio con `pnpm workspace`
     (`packages/core`, `packages/capture`, etc.), configuración de TypeScript, base de datos
     Supabase dedicada (migraciones locales de inicio) y despliegue a Cloudflare Workers requiere
     una inversión acotada estimada internamente en **1.5 a 2 días de agente** de configuración
     inicial.
   - **Aislamiento absoluto:** Base de datos independiente donde RLS se aplica de forma estricta y
     donde el `service_role` solo opera sobre datos del servicio de medición, sin riesgo de exponer
     invitados, fotos o memorias privadas de Celebra-me.
   - **Dictamen:** Se ratifica plenamente la recomendación de un **monorepo separado**. Celebra-me
     debe figurar únicamente como el **Cliente Cero**, integrando el paquete cliente
     `@medicion/capture` y enviando eventos hacia la API del nuevo servicio mediante webhooks.

---

### 3.2. Modelo de datos, RLS, Outbox, Idempotencia y Manejo de Secretos

1. **Modelo de Diez Tablas:**
   - La partición en 10 tablas (`tenants`, `connections`, `contacts`, `leads`, `touchpoints`,
     `stage_changes`, `outbox`, `deliveries`, `ad_spend_daily`, `job_runs`) normaliza de manera
     limpia lo que en Celebra-me se encontraba sobrecargado en una sola tabla `leads`
     (`src/lib/tracking/lead-capture.service.ts`).
   - La separación de `contacts` (datos del titular) de `leads` (oportunidad comercial) y
     `touchpoints` (origen publicitario) permite nativamente la atribución multi-toque (_multi-touch
     attribution_), resolviendo la limitación actual de Celebra-me donde un lead solo retiene el
     último clic o sesión.
   - Se debe mantener coherencia con las políticas de retención de datos seudonimizados y borrado
     seguro conforme a la legislación aplicable.

2. **Políticas RLS por `tenant_id`:**
   - Toda tabla del esquema debe declarar
     `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`.
   - Las políticas RLS para acceso desde el panel cliente (`packages/panel`) deben comprobar la
     pertenencia al inquilino mediante claims en el token JWT:
     `tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`.
   - **Regla técnica para procesos en segundo plano:** Los despachadores (`packages/dispatch`) e
     ingestores de gasto (`packages/spend`) corren mediante credenciales administrativas
     (`service_role`). Dado que el rol de servicio ignora RLS, todas las consultas y mutaciones SQL
     ejecutadas por workers deben incluir explícitamente la cláusula `WHERE tenant_id = ?` en la
     sentencia para garantizar el aislamiento lógico.

3. **Idempotencia con `event_id` y Mecanismo Outbox:**
   - El patrón de idempotencia determinista formulado en la Regla 7 es idéntico al probado con éxito
     en Celebra-me (`createMetaCrmLeadStageEventId` en
     `src/lib/commercial/meta-capi/lead-stage-events.ts:35-37`), donde se construye la clave
     combinando entidad y etapa: `crm-lead-stage:${leadId}:${stage}`.
   - **Arrendamiento concurrente indispensable:** En Cloudflare Workers o entornos serverless,
     múltiples invocaciones concurrentes del cron pueden colisionar al leer la tabla `outbox`. Es
     obligatorio incorporar en `outbox` las columnas `claim_id UUID`, `claimed_at TIMESTAMPTZ` y
     `claim_expires_at TIMESTAMPTZ` (tal como opera `meta_conversion_events` en
     `supabase/migrations/20260711183630_commercial_capi_readiness.sql:16-22`) para realizar
     bloqueos optimistas atómicos antes de iniciar el envío a las APIs externas.

4. **Manejo de Secretos y Credenciales:**
   - La nota de la tabla `connections` indica: _"Tokens en el almacén de secretos"_.
   - **Riesgo técnico:** Guardar tokens de acceso en texto plano en una tabla SQL expone las cuentas
     publicitarias de todos los clientes si se produce una brecha en la base de datos o un volcado
     accidental.
   - **Solución técnica requerida:** Implementar cifrado de sobre (_Envelope Encryption_) a nivel de
     aplicación con AES-256-GCM. La columna `encrypted_access_token` almacenará el texto cifrado y
     el vector de inicialización (IV); la clave maestra de descifrado
     (`TENANT_ENCRYPTION_MASTER_KEY`) residirá exclusivamente en los secretos del entorno de
     Cloudflare Workers, sin persistirse jamás en la base de datos. Si la instancia de Supabase lo
     soporta, puede emplearse la extensión oficial `Supabase Vault` (`pgsodium`).

---

### 3.3. Inventario de piezas: Reutilizables, Faltantes y Riesgos Técnicos

#### Piezas Reutilizables del Repositorio Actual

1. **Cliente Graph API (`src/lib/meta/graph-client.ts`):** Manejo de paginación de cursores,
   reintentos con retardo exponencial ante códigos de límite de tasa (`4, 17, 32, 613`), y
   ocultamiento estricto de URLs y tokens en excepciones (`MetaGraphError`).
2. **Recolector de Insights de Meta (`src/lib/meta/insights-collector.ts`):** Lógica de consulta a
   `/insights`, normalización de identificadores de cuenta (`normalizeAdAccountId`), e inserción con
   resolución de conflictos de claves compuestas.
3. **Mapeo y Hashing de Datos de Usuario (`src/lib/commercial/meta-capi/service.ts:83-93` y
   `src/lib/commercial/phone.ts`):** Sanitización contra fuga de datos personales
   (`sanitizeProviderError`), normalización de números telefónicos en formato internacional E.164 y
   hashing unidireccional con SHA-256 en minúsculas.
4. **Generador de Códigos de Prospecto (`src/lib/tracking/lead-code.ts`):** Algoritmo de generación
   de identificadores cortos no ambiguos (`CM-XXXXXX` o prefijo configurable).
5. **Esquema de Tareas Programadas (`src/lib/server/scheduled-jobs.ts`):** Arquitectura desacoplada
   para ejecutar rutinas cron en Cloudflare Workers con captura de evidencias de ejecución.

#### Piezas Faltantes (A construir desde cero en el nuevo monorepo)

1. **Adaptador de Ingesta WhatsApp (`packages/ingest`):** Receptor de webhooks multi-proveedor
   (Chakra, 360dialog, Zernio) con validación de firmas criptográficas HMAC-SHA256, extracción del
   `ctwa_clid` e intercepción de webhooks de desconexión (`ACCOUNT_OFFBOARDED`).
2. **Adaptador de Despacho TikTok (`packages/dispatch/tiktok`):** Conector con TikTok Events API
   (`POST /open_api/v1.3/event/track/`) que soporte los eventos estándar `Purchase`, `Lead` y
   `Contact`, formateando el bloque `user` con hashes y `ttclid`.
3. **Adaptador de Despacho Google Ads (`packages/dispatch/google`):** Cliente para Google Ads API
   que gestione `ConversionUploadService` con `order_id` y `ConversionAdjustmentUploadService` con
   `RETRACTION`.
4. **Recolectores de Gasto TikTok y Google (`packages/spend`):** Cron jobs equivalentes al
   recolector de Meta para extraer gasto e impresiones por anuncio y día de TikTok Marketing API y
   Google Ads API.
5. **Panel Móvil Multi-inquilino (`packages/panel`):** Interfaz ligera PWA o web móvil protegida por
   Supabase Auth para que los operadores de cada cliente puedan cambiar etapas de prospectos en
   segundos.
6. **Módulo de Vigilancia y Alertas (`packages/watch`):** Monitorización continua de ejecuciones de
   cron en la tabla `job_runs` y detección de silencios operativos (notificaciones a Slack /
   WhatsApp ante fallas o ausencia de ejecuciones).
7. **Librería de Captura Universal (`packages/capture`):** Script agnóstico en TypeScript puro
   (Vanilla JS/TS bundle) que cualquier sitio web o landing page pueda incrustar para capturar
   `fbclid`, `ttclid`, `gclid` y UTMs, enlazándolos con la sesión.

#### Riesgos Técnicos Principales y Mitigaciones

1. **Riesgo 1: Desconexión inadvertida de WhatsApp Business App (14 días sin uso):**
   - _Impacto:_ Los anuncios de Click-to-WhatsApp dejan de recibir `ctwa_clid` a través de la Cloud
     API, inutilizando la atribución.
   - _Mitigación:_ Suscribir el webhook a eventos de ciclo de vida (`ACCOUNT_OFFBOARDED`) y activar
     una alerta de alta prioridad en `packages/watch` para solicitar la apertura inmediata de la app
     en el dispositivo móvil.
2. **Riesgo 2: Vencimiento de la ventana de 7 días de Meta:**
   - _Impacto:_ Conversiones cerradas después del día 7 son rechazadas por Meta CAPI con error de
     antigüedad.
   - _Mitigación:_ Enviar el evento intermedio `LeadSubmitted` tan pronto como la clienta entregue
     sus datos de evento, y reportar `Purchase` con el valor al momento de confirmar el pedido.
3. **Riesgo 3: Desfase de identificadores en Google Ads:**
   - _Impacto:_ Intento de retracción de conversión rechazado si no coincide exactamente el
     identificador original.
   - _Mitigación:_ Obligar a que la subida inicial incluya `order_id` y persistirlo en la tabla
     `stage_changes`.
4. **Riesgo 4: Concurrencia en Cloudflare Workers y duplicación de envíos:**
   - _Impacto:_ Despacho doble de eventos hacia plataformas externas ante reintentos de workers.
   - _Mitigación:_ Arrendamiento transaccional en Supabase (`claim_id` con expiración temporal en la
     tabla `outbox`).

---

## 4. Hallazgos específicos de la Revisión 2 (Codex)

### Hallazgo C1: Necesidad de arrendamiento concurrente (`claim_id`) en la tabla `outbox`

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Modelo de datos y contrato de
  eventos (líneas 119-130).
- **Descripción:** La tabla `outbox` propuesta contiene únicamente `"event_id, intentos, estado"`.
  En un entorno serverless como Cloudflare Workers con múltiples ejecuciones simultáneas o tareas
  programadas cada pocos minutos, dos instancias del despachador pueden seleccionar las mismas filas
  en estado `pending` al mismo tiempo, generando llamadas concurrentes redundantes a las APIs de
  Meta, TikTok y Google.
- **Cambio propuesto:** Enriquecer la definición de la tabla `outbox` para incluir:
  - `claim_id UUID NULL`: Identificador único de la instancia/ejecución que procesa el lote.
  - `claimed_at TIMESTAMPTZ NULL`: Momento de adquisición del arrendamiento.
  - `claim_expires_at TIMESTAMPTZ NULL`: Expiración del arrendamiento (por ejemplo,
    `NOW() + INTERVAL '120 seconds'`).
  - La consulta de selección debe actualizar atómicamente estas columnas sobre filas
    `WHERE status = 'pending' AND (claim_expires_at IS NULL OR claim_expires_at < NOW())`.
- **Evidencia en el repositorio:** `src/lib/commercial/meta-capi/service.ts:47-52` y
  `supabase/migrations/20260711183630_commercial_capi_readiness.sql:16-22`.

---

### Hallazgo C2: Cifrado en reposo para credenciales de clientes en la tabla `connections`

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Reglas del proyecto (Regla 5) y §
  Modelo de datos (tabla `connections`).
- **Descripción:** La propuesta establece en la nota de `connections`: _"Tokens en el almacén de
  secretos"_. En Celebra-me, los tokens son de un único cliente y se leen como variables de entorno
  del proceso en tiempo de ejecución (`src/lib/server/env.ts:1-10` y
  `src/lib/meta/graph-client.ts:10-17` con `getEnv('META_GRAPH_ACCESS_TOKEN')`). Sin embargo, en un
  modelo multi-inquilino donde cada cliente vincula sus propios tokens dinámicos de Meta System
  User, TikTok Access Token y credenciales de Google Ads, no es posible usar variables de entorno de
  proceso: los tokens deben persistirse por fila en la base de datos (tabla `connections`).
  Almacenar estos valores en texto plano en columnas estándar viola la Regla 5 (_los tokens viven en
  un almacén de secretos, nunca en el código_) y expone las credenciales de todos los clientes ante
  cualquier volcado o consulta con rol de servicio.
- **Cambio propuesto:**
  1. Especificar que la tabla `connections` almacenará `encrypted_access_token BYTEA` o `TEXT` con
     su respectivo vector de inicialización (`iv`), cifrado mediante AES-256-GCM a nivel de
     aplicación antes de persistir.
  2. La llave maestra de descifrado (`TENANT_ENCRYPTION_MASTER_KEY`) residirá exclusivamente en las
     variables secretas de Cloudflare Workers, de modo que la base de datos nunca conserve las
     credenciales descifradas.
  3. Alternativamente, utilizar la extensión `Supabase Vault` (`vault.create_secret`) si la
     instancia de Supabase tiene habilitada la extensión `pgsodium`.
- **Evidencia en el repositorio:** `src/lib/meta/graph-client.ts:10-17` (demuestra que el código
  actual solo soporta un token estático global vía `readMetaInsightsConfig`) y
  `src/lib/server/env.ts:1-10` (lector de variables de entorno de proceso único).

---

### Hallazgo C3: Inexistencia de captura de `ttclid` y `gclid` en la suite de tracking actual

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Arquitectura de código (paquete
  `capture`) y `docs/propuestas/plan-medicion-celebra-me.md` § Fase 1.
- **Descripción:** La propuesta asume que la captura web ya guarda `fbclid`, `ttclid`, `gclid` y
  UTM. Sin embargo, la inspección del código real en `src/lib/tracking/client.ts` y
  `src/lib/tracking/lead-capture.service.ts` demuestra que el sistema actual de Celebra-me
  únicamente procesa parámetros de Meta (`fbc`, `fbp`, `fbclid`) y UTMs estándar (`utm_source`,
  `utm_medium`, etc.), careciendo de extracción, almacenamiento y persistencia para los
  identificadores de clic de TikTok (`ttclid`) y Google (`gclid`).
- **Cambio propuesto:**
  1. Diseñar el paquete `@medicion/capture` para registrar activamente `ttclid` y `gclid` desde la
     URL (`window.location.search`), almacenándolos en cookies de primer contacto y
     `sessionStorage`.
  2. Incluir columnas específicas `ttclid` y `gclid` en la tabla `touchpoints` del nuevo esquema
     multi-inquilino.
- **Evidencia en el repositorio:** `src/lib/tracking/client.ts:31-39` y
  `src/lib/tracking/lead-capture.service.ts:40-45`.

---

### Hallazgo C4: Monitoreo activo de procesos silenciosos en `packages/watch`

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Reglas del proyecto (Regla 9) y §
  Arquitectura de código (`watch`).
- **Descripción:** La Regla 9 estipula: _"Ningún proceso falla en silencio. Cada tarea programada
  registra su ejecución y avisa si falla o no corre"_. El antecedente citado en la propuesta
  (`docs/propuestas/servicio-medicion.md:60-63`) documenta que _"el 29 de octubre, Meta Insights
  llevaba tres días fallando y solo aparecía como tarea en la cola"_. Al inspeccionar la
  implementación actual en `src/lib/server/scheduled-jobs.ts:152-176`, se comprueba la causa
  estructural: la función `runMetaInsightsJob` únicamente escribe mensajes informativos o de
  advertencia a la salida estándar del Worker (`console.warn`, `console.info`, `console.error`). Si
  el cron falla o si Cloudflare no lo dispara, no existe ningún mecanismo activo de inserción en
  cola de alertas o notificación push hacia canales externos, por lo que las fallas permanecen
  invisibles a menos que un operador consulte deliberadamente los logs de la consola.
- **Cambio propuesto:** El paquete `packages/watch` no debe limitarse a un registro pasivo de
  ejecuciones en la tabla `job_runs`, sino operar como un monitor activo:
  - Cada tarea programada reporta inicio, fin y estado en la tabla `job_runs`.
  - Un chequeo de vigilancia independiente (o monitor externo de salud / ping cron) consulta
    periódicamente:
    `SELECT job_name FROM job_runs WHERE last_completed_at < NOW() - INTERVAL '26 hours'`. Si un
    trabajo diario no registra finalización exitosa dentro de la ventana esperada, despacha una
    alerta push inmediata vía webhook (Slack, Telegram o WhatsApp) al equipo operativo.
- **Evidencia en el repositorio:** `docs/propuestas/servicio-medicion.md:60-63` (antecedente del
  fallo de 3 días) y `src/lib/server/scheduled-jobs.ts:152-176` (evidencia de que la ejecución
  actual solo emite logs pasivos a `console` sin despacho de alertas externas).

---

## 5. Estimación de esfuerzo por etapa en Días de Agente

La estimación contempla el desarrollo por agentes autónomos de código (Gemini / Codex) trabajando
bajo el estándar de pruebas unitarias y validación continua del repositorio:

| Etapa                           | Alcance principal                                                              | Entregables técnicos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |       Días de agente       |
| :------------------------------ | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------: |
| **Etapa 0**<br>(Nov 2026)       | **Celebra-me como Cliente Cero**<br>Núcleo multi-inquilino + Meta CAPI y Gasto | 1. Setup del monorepo independiente (`pnpm workspace`) con TypeScript y Cloudflare Workers.<br>2. Esquema Supabase (10 tablas con RLS, claves foráneas y arrendamiento outbox).<br>3. Módulo de cifrado AES-256-GCM para `connections`.<br>4. Adaptador de Meta CAPI (Web `action_source: "website"` / `"chat"` y Mensajería `action_source: "business_messaging"` con `LeadSubmitted` y `Purchase`).<br>5. Cron diario de gasto Meta Insights (`packages/spend`).<br>6. Panel móvil básico (`packages/panel`) para cambio de etapas de prospectos.<br>7. Integración de `@medicion/capture` en celebra-me.com. |         **6 a 8**          |
| **Etapa 1**<br>(Dic 2026)       | **CEJ como Segundo Cliente**<br>Generalización multi-tenant + WhatsApp BSP     | 1. Integración de webhook de WhatsApp con BSP acreditado (Chakra / 360dialog) con soporte de coexistencia y extracción de `ctwa_clid`.<br>2. Manejo de webhooks de desconexión (`ACCOUNT_OFFBOARDED`).<br>3. Script `@medicion/capture` empaquetado y probado como librería independiente reutilizable.<br>4. Parametrización y alta de CEJ (onboarding 100% por configuración y SQL, 0 líneas de código específico para CEJ).<br>5. Pruebas de penetración de aislamiento RLS entre Celebra-me y CEJ.                                                                                                          |         **4 a 5**          |
| **Etapa 2**<br>(Ene-Feb 2027)   | **Piloto con Clientes Externos**<br>TikTok + Google Ads + Vigilancia activa    | 1. Adaptador TikTok Events API (`Purchase`, `Lead`, `Contact` con hashes y `ttclid`).<br>2. Adaptador Google Ads API (`UploadClickConversions` con `order_id` y `ConversionAdjustmentUploadService` con `RETRACTION`).<br>3. Ingestores de gasto diario para TikTok Marketing API y Google Ads API.<br>4. Módulo `packages/watch` con detección activa de procesos silenciosos y webhook de alertas.<br>5. Acompañamiento y soporte técnico a 1-2 clientes piloto.                                                                                                                                              |         **7 a 9**          |
| **Etapa 3**<br>(Desde Mar 2027) | **Oferta Abierta y Escalamiento**<br>Automatización de Onboarding y Métricas   | 1. Vistas SQL completas para el diccionario de métricas (Capas 1, 2 y 3).<br>2. CLI o script de auto-aprovisionamiento para nuevas altas de inquilinos.<br>3. Panel de control multi-tenant consolidado con roles (operador vs administrador de cliente).<br>4. Documentación de contratos de integración para agencias asociadas.                                                                                                                                                                                                                                                                              |         **5 a 6**          |
| **TOTAL**                       | **Roadmap completo (Etapas 0 a 3)**                                            | **Plataforma lista para comercialización abierta**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **22 a 28 días de agente** |

---

## 6. Conclusión y Recomendación Final

La arquitectura propuesta está sólidamente fundamentada y resuelve una necesidad crítica de mercado.
Para garantizar su éxito y minimizar riesgos:

1. **Separación estricta de repositorios:** Iniciar el desarrollo en un monorepo nuevo e
   independiente. No intentar fusionar las 10 tablas multi-inquilino en la base de datos de
   invitaciones de Celebra-me.
2. **Adopción de las correcciones de eventos:** Implementar `Purchase` en TikTok, `order_id`
   obligatorio en Google Ads y `LeadSubmitted` en Meta Business Messaging.
3. **Seguridad y Concurrencia:** Aplicar cifrado AES-256-GCM para los tokens de clientes y el patrón
   de arrendamiento atómico (`claim_id`) en la tabla `outbox`.

Con estas precisiones técnicas, la propuesta queda formalmente aprobada desde la perspectiva de
viabilidad técnica y código de repositorio.
