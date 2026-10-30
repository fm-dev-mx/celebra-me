# Revisión 1: Hechos externos y viabilidad de negocio · Servicio de medición y campañas

**Fecha:** 29 de octubre de 2026  
**Revisor:** Gemini (`f12-release · T464`)  
**Documentos evaluados:**

- [docs/propuestas/servicio-medicion.md](file:///D:/code/celebra-me-worktrees/f12-release/docs/propuestas/servicio-medicion.md)
- [docs/propuestas/plan-medicion-celebra-me.md](file:///D:/code/celebra-me-worktrees/f12-release/docs/propuestas/plan-medicion-celebra-me.md)

---

## Veredicto

**Aprobada con cambios**

### Resumen ejecutivo del dictamen

La propuesta técnica y de arquitectura multi-inquilino (_multi-tenant_ sobre Supabase con RLS,
desacoplamiento en módulos `capture`, `ingest`, `core`, `dispatch`, `spend`, `metrics`, `panel`,
`watch`, y tres capas de métricas) es sólida, escalable y adecuada para transformar la medición de
campañas en un producto de software repetible.

No obstante, la propuesta presenta imprecisiones técnicas en nombres de eventos de plataformas
externas (especialmente TikTok Events API y Google Ads API), omisiones en los requisitos de
identificación para la retracción de conversiones en Google Ads, vacíos operativos en los paquetes
comerciales (riesgo de costos _pass-through_ y canibalización por el paquete de sitio web a la
medida), y requiere robustecer la definición del Cliente Ideal (ICP) frente a la ventana de
atribución de 7 días de Meta y formalizar el marco legal mexicano bajo la LFPDPPP (relación
Responsable-Encargado).

---

## Hallazgos de la revisión

### Bloque 1: APIs publicitarias y eventos externos (TikTok, Google Ads, Meta)

#### Hallazgo 1: Nombre estándar del evento de compra en TikTok Events API

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Modelo de datos y contrato de
  eventos (línea 111) y `docs/propuestas/plan-medicion-celebra-me.md` § Embudo y eventos.
- **Descripción:** La tabla de eventos de la propuesta indica textualmente `"Compra con valor"` en
  español para el evento interno `order.confirmed` en TikTok. En la API técnica de TikTok
  (`POST https://business-api.tiktok.com/open_api/v1.3/event/track/`), los eventos deben ser cadenas
  reservadas en inglés. Históricamente TikTok utilizaba el evento `CompletePayment`, pero en su
  documentación técnica actual estandarizó la nomenclatura con la industria renombrando el evento
  oficial a **`Purchase`**. Asimismo, el evento `PlaceAnOrder` se encuentra catalogado como
  _soft-deprecated_ (desaconsejado para nuevas implementaciones).
- **Cambio propuesto:**
  1. En la tabla del contrato de eventos, cambiar `"Compra con valor"` por `"Purchase"` (con
     parámetros obligatorios `properties.value` numérico y `properties.currency: "MXN"`).
  2. Documentar en el adaptador `packages/dispatch` que el evento estándar de compra es `Purchase` y
     que no debe emplearse `PlaceAnOrder` ni cadenas en español.
- **Fuente:**
  [TikTok Business Help Center: Standard Events Reference](https://ads.tiktok.com/help/article/standard-events-reference)
  y
  [TikTok Events API Developer Documentation](https://business-api.tiktok.com/portal/docs?id=1771100799077377).

---

#### Hallazgo 2: Confirmación técnica de eventos de prospectos en TikTok (`Contact` y `Lead`)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Modelo de datos y contrato de
  eventos (líneas 109-110).
- **Descripción:** La propuesta mapea `lead.created` a `Contact` y `lead.qualified` a `Lead` en
  TikTok. Este mapeo es consistente con la taxonomía oficial de TikTok Events API: TikTok unificó su
  antiguo evento `SubmitForm` en el evento estándar `Lead` (prospecto que entrega información
  calificada) y mantiene `Contact` para interacciones iniciales de contacto (como clics a chat o
  enlaces de soporte). Para que estos eventos optimicen efectivamente los algoritmos de entrega de
  TikTok, el objeto `user` debe enviar parámetros de coincidencia avanzada normalizados y cifrados
  en SHA-256 (`phone_number`, `email`), acompañados del identificador de clic `ttclid` capturado en
  la URL de aterrizaje.
- **Cambio propuesto:**
  1. Ratificar oficialmente `Contact` para `lead.created` y `Lead` para `lead.qualified`.
  2. En la especificación del módulo `packages/dispatch/tiktok`, formalizar el envío del bloque
     `user` con `phone_number` (formato E.164, minúsculas, hash SHA-256), `email` (minúsculas, trim,
     hash SHA-256) y el `ttclid`.
- **Fuente:**
  [TikTok Events API Data Formats and User Identification](https://business-api.tiktok.com/portal/docs?id=1771100799077377).

---

#### Hallazgo 3: Mecanismo de retracción y ajuste de conversiones en Google Ads API

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Modelo de datos y contrato de
  eventos (líneas 111-112).
- **Descripción:** La propuesta señala `"Ajuste de la conversión"` ante `order.canceled` en Google
  Ads, pero no detalla el protocolo técnico. En la Google Ads API, los ajustes posteriores a una
  conversión subida (`uploadClickConversions`) se gestionan mediante el servicio dedicado
  **`ConversionAdjustmentUploadService.uploadConversionAdjustments`**. Existen dos tipos de ajuste:
  - `RETRACTION`: Invalida completamente la conversión (establece su valor en 0.00 y resta 1 del
    conteo de conversiones en las estrategias de Smart Bidding).
  - `RESTATEMENT`: Modifica el valor económico de la conversión (por ejemplo, cancelaciones
    parciales o cambios de paquete) manteniendo el conteo de conversiones.

  **Requisito técnico crítico de identificación:** Google Ads exige vincular el ajuste con la
  conversión original mediante uno de dos métodos:
  1. `order_id` (Identificador de transacción único).
  2. La combinación exacta de `gclid` + `conversion_date_time` (fecha y hora exacta al segundo en
     que se registró la conversión original). Si al registrar `order.confirmed` en Google Ads no se
     envía un `order_id` unívoco generado por Supabase, intentar una retracción posterior con solo
     `gclid` y timestamp es altamente frágil y susceptible a rechazos por desfase de segundos o
     conversiones múltiples. Adicionalmente, Google impone una ventana máxima de 55 días para
     procesar ajustes.

- **Cambio propuesto:**
  1. Especificar que al subir la conversión offline `order.confirmed` vía `ConversionUploadService`,
     se debe adjuntar obligatoriamente el campo `order_id` con el ID del pedido registrado en
     Supabase.
  2. Para `order.canceled`, invocar `ConversionAdjustmentUploadService` indicando
     `adjustment_type: RETRACTION` y referenciando el `order_id`. Si hay variación de precio en vez
     de cancelación total, usar `adjustment_type: RESTATEMENT` con el nuevo `restated_value`.
- **Fuente:**
  [Google Ads API: Upload Conversion Adjustments](https://developers.google.com/google-ads/api/docs/conversions/upload-adjustments)
  y
  [Google Ads API: Upload Click Conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-clicks).

---

#### Hallazgo 4: Requisitos técnicos, límites y desconexión en Coexistencia de WhatsApp Business

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Fase 3 y
  `docs/propuestas/servicio-medicion.md` § Arquitectura / Conexión de WhatsApp.
- **Descripción:** La propuesta describe con exactitud varias condiciones de coexistencia (versión
  2.24.17+ de WhatsApp Business, incompatibilidad con WhatsApp para Windows de escritorio, y la
  limitación de que las etiquetas móviles no viajan por la API). Sin embargo, existen tres
  restricciones críticas adicionales documentadas por Meta que deben contemplarse para evitar caídas
  imprevistas del servicio:
  1. **Requiere Solution Partner o Tech Provider:** El flujo nativo de coexistencia (_Embedded
     Signup v4_ con parámetro `coex: true`) no está abierto a desarrollo individual directo de Meta
     sin registro como socio tecnológico. Esto valida plenamente la decisión de iniciar utilizando
     un Business Solution Provider (BSP) ya acreditado (como Chakra, Zernio o 360dialog) en lugar de
     tramitar una cuenta de Tech Provider propia al inicio.
  2. **Desconexión automática por inactividad móvil:** Si el dispositivo móvil principal que alberga
     la aplicación WhatsApp Business pasa aproximadamente 14 días sin actividad o conexión a
     Internet, los servidores de Meta revocan automáticamente el token de la Cloud API
     complementaria, disparando un webhook `ACCOUNT_OFFBOARDED`.
  3. **Reinstalación o cambio de equipo:** Si el cliente cambia de teléfono móvil o reinstala la app
     de WhatsApp Business, la vinculación con la Cloud API se interrumpe inmediatamente y exige un
     proceso de reconexión asistida (`ACCOUNT_RECONNECTED`).
- **Cambio propuesto:**
  1. Documentar explícitamente en las reglas de operación y en el módulo `packages/watch` la escucha
     de los webhooks de ciclo de vida de la cuenta (`ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED`).
  2. Incluir en el manual operativo del cliente una advertencia estricta sobre la necesidad de
     mantener el teléfono principal con conexión periódica para evitar la suspensión de la API.
- **Fuente:**
  [Meta Developers: WhatsApp Business App Coexistence Onboarding Guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
  y
  [Meta Cloud API Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components).

---

#### Hallazgo 5: Parámetros obligatorios en Conversions API for Business Messaging (Meta)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Embudo y eventos (línea 43)
  y § Fase 3.
- **Descripción:** Para reportar conversiones derivadas de anuncios de WhatsApp con
  `action_source: "business_messaging"`, la API de conversiones de Meta exige parámetros de contexto
  específicos en la raíz y en el bloque `user_data`:
  - `messaging_channel: "whatsapp"` (campo de primer nivel requerido para distinguir tráfico de
    Messenger o Instagram Direct).
  - `user_data.ctwa_clid`: Extraído directamente del webhook del primer mensaje
    (`entry[].changes[].value.messages[].referral.ctwa_clid`).
  - `user_data.whatsapp_business_account_id`: El ID de la cuenta de WhatsApp Business (WABA).
  - `user_data.ph`: Array con el teléfono del cliente en formato E.164, normalizado y con hash
    SHA-256 para elevar el puntaje de coincidencia (_Event Match Quality_).
  - Límite de tiempo: Meta rechaza de forma estricta cualquier evento cuyo `event_time` tenga más de
    7 días de antigüedad respecto al momento del envío.
- **Cambio propuesto:** Detallar este contrato formal de payload en el adaptador
  `packages/dispatch/meta-messaging` para garantizar compatibilidad con la versión actual de la
  Graph API (v20+).
- **Fuente:**
  [Meta Developers: Conversions API for Business Messaging](https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging).

---

### Bloque 2: Evaluación de la oferta comercial y estructura de paquetes

#### Hallazgo 6: Desalineación estratégica del paquete «Sitio web completo»

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Paquete 5, línea 17) y §
  Reglas del proyecto.
- **Descripción:** El paquete «Sitio web completo» presenta serios problemas de coherencia con el
  modelo de negocio:
  1. **Conflicto con la tesis de producto repetible:** La oferta promete certeza en medición
     publicitaria mediante un software multi-cliente y procesos automatizados (Regla 12: _"Lo que se
     repite se automatiza"_). El desarrollo de sitios web completos a la medida es un servicio de
     agencia tradicional (diseño gráfico en Figma, maquetación, redacción corporativa, revisiones
     subjetivas con clientes), altamente intensivo en horas hombre. Esto disparará negativamente la
     métrica de negocio _"Horas por implementación"_ y distraerá los recursos técnicos del
     desarrollo del núcleo de datos.
  2. **Canibalización de canales de adquisición (Agencias aliadas):** Las agencias de diseño y
     marketing son el canal natural de referencia B2B para vender este software de medición a sus
     clientes. Ofrecer "Sitio web completo" convierte al servicio de medición en competidor directo
     de las mismas agencias que podrían recomendarlo.
  3. **Solución alineada al producto:** Lo que un servicio de medición publicitaria sí necesita y
     puede estandarizar es:
     - **Landing Page de conversión optimizada para medición:** Una página única de aterrizaje,
       ultra-rápida, con diseño enfocado en conversión (botón a WhatsApp con generación de código y
       captura de parámetros UTM/clid).
     - **Scripts o plugins de integración para sitios existentes:** Módulos listos para instalar en
       WordPress/WooCommerce, Shopify o Webflow.
- **Cambio propuesto:** Reemplazar el paquete «Sitio web completo» por **«Landing page de conversión
  integrada»** (o canalizar los desarrollos web completos a través de una alianza externa, sin que
  formen parte del alcance del producto de medición).
- **Fuente:** Análisis de modelo de negocio _Productized Service_ vs Agencia de Desarrollo
  (Benchmark de agencias de analítica digital en México).

---

#### Hallazgo 7: Ausencia de delimitación de costos de infraestructura y terceros (_Pass-Through_)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Paquetes Implementación
  y Operación).
- **Descripción:** La propuesta no establece quién absorbe los costos directos de herramientas de
  terceros:
  - Cuota mensual del proveedor de WhatsApp BSP (ej. 360dialog, Chakra o Zernio, que oscila entre
    $20 y $50 USD mensuales por número).
  - Costo por conversación de Meta (tarifas de WhatsApp Business API por conversaciones iniciadas
    por el negocio o de servicio).
  - Infraestructura de hosting y base de datos (planes de Supabase y servicios serverless). Si la
    tarifa mensual de «Operación» absorbe estos consumos variables, la métrica _"Margen por
    cliente"_ (Capa 3) puede degradarse severamente en clientes de alto volumen.
- **Cambio propuesto:** Agregar una cláusula explícita en las condiciones del servicio: _"Los costos
  de plataformas externas (cuota del BSP de WhatsApp, costo por conversación de Meta Ads/Cloud API y
  consumo de base de datos) se contratan directamente a nombre del cliente o se facturan como costo
  directo reembolsable (pass-through). La mensualidad de Operación cubre estrictamente la licencia
  del software, el monitoreo diario, la calibración de eventos y los reportes."_
- **Fuente:** Estructura de precios estándar de Business Solution Providers de Meta (360dialog,
  Wati, Chakra).

---

#### Hallazgo 8: Definición de límites y SLA en el paquete de Operación

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Paquete Operación, línea
  15).
- **Descripción:** Definir la Operación como _"Monitoreo diario, reporte semanal, ajustes de eventos
  y soporte"_ es ambiguo. Clientes con operaciones desordenadas pueden interpretar "ajustes de
  eventos y soporte" como una bolsa abierta de horas para rediseñar embudos, crear nuevas landing
  pages o integrar nuevos sistemas CRM sin costo adicional.
- **Cambio propuesto:** Delimitar el alcance mensual:
  1. Definir un tiempo de respuesta garantizado (SLA) de 24 a 48 horas hábiles para incidencias de
     medición.
  2. Incluir hasta 2 ajustes menores de mapeo de eventos por mes incluidos en la iguala.
  3. Establecer que cambios estructurales de embudo o integraciones adicionales se cotizan como
     proyectos independientes.
- **Fuente:** Prácticas contractuales de pólizas de soporte y mantenimiento en servicios
  tecnológicos en México.

---

### Bloque 3: Precios de referencia en el mercado mexicano

#### Hallazgo 9: Benchmark de precios de mercado en México (Octubre 2026)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Decisiones pendientes (Precios,
  línea 169).
- **Descripción:** La propuesta deja los precios como una incógnita abierta. A continuación se
  presentan los rangos de referencia observados en el mercado mexicano para servicios equivalentes
  de agencias y consultores de marketing y tecnología (consultados en octubre de 2026):

| Concepto / Paquete                     | Rango de mercado en México (MXN)        | Qué incluye en el mercado                                                                                                                                                                                               |
| :------------------------------------- | :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Diagnóstico de analítica y pauta**   | **$4,000 a $8,000 MXN** (pago único)    | Auditoría de píxeles, CAPI existente, fuga de UTMs/clids, calidad de coincidencia de eventos, revisión de configuración en Business Manager y reporte con plan de acción. Bonificable si se contrata la implementación. |
| **Implementación técnica de medición** | **$15,000 a $35,000 MXN** (pago único)  | Configuración avanzada de CAPI de Meta (web + WhatsApp), TikTok Events API, conversiones offline de Google Ads, webhooks con Supabase, deduplicación de eventos y tablero inicial de control.                           |
| **Operación mensual de medición**      | **$6,000 a $15,000 MXN** / mes          | Monitoreo diario de salud de APIs y webhooks, resolución de incidencias de señal, calibración de eventos, reporte semanal de desempeño publicitario y soporte técnico.                                                  |
| **Gestión de campañas (Media Buying)** | **$8,000 a $25,000 MXN** / mes          | Honorarios de gestión de pauta (independiente de la inversión publicitaria): estrategia de anuncios, copys, creativos visuales, optimización de presupuesto y pruebas A/B.                                              |
| **Landing page de alta conversión**    | **$8,000 a $18,000 MXN** (pago único)   | Diseño responsivo enfocado a conversión, copywriting persuasivo, botón directo a WhatsApp con parámetros y píxeles server-side preinstalados.                                                                           |
| **Sitio web corporativo a la medida**  | **$25,000 a $65,000+ MXN** (pago único) | Sitio multipágina (5 a 12 secciones), arquitectura UX/UI en Figma, CMS editable, optimización SEO y formularios avanzados.                                                                                              |

- **Cambio propuesto:** Adoptar esta referencia para establecer la lista de precios recomendada en
  la fase piloto:
  - _Diagnóstico:_ $5,000 MXN (100% acreditable a la implementación).
  - _Implementación:_ $18,000 a $24,000 MXN.
  - _Operación mensual:_ $7,500 MXN / mes.
  - _Gestión de campañas:_ $12,000 MXN / mes (o base de $8,000 MXN + 10% del gasto en pauta).
  - _Landing page integrada:_ $10,000 MXN.
- **Fuentes y fecha de consulta (29 de octubre de 2026):**
  - [Alem Marketing: Tarifas de agencias de marketing digital en México](https://alem.com.mx)
  - [4V Marketing: Costos de analítica avanzada y API de conversiones en México](https://4vmarketing.com)
  - [Shortway: Costos de igualas mensuales en Meta Ads en México](https://shortway.com.mx)
  - [Vexus Agency: Costos de diseño web y landing pages en México](https://vexusagency.com)
  - [Bastian Soft: Cuánto cuesta una página web en México](https://bastiansoft.com)

---

### Bloque 4: Cliente ideal y obligaciones de privacidad en México (LFPDPPP)

#### Hallazgo 10: Ajuste al Perfil del Cliente Ideal (ICP): umbral de inversión y ciclo de venta

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Cliente ideal, línea
  19).
- **Descripción:** El perfil del cliente ideal definido en la propuesta (_"negocios que venden por
  WhatsApp, con ticket alto y que ya invierten en anuncios. Por ejemplo: constructoras,
  inmobiliarias, clínicas, escuelas, salones y proveedores de eventos"_) requiere dos precisiones
  técnicas indispensables:
  1. **Umbral mínimo de inversión en pauta ($10,000 - $15,000 MXN/mes):** Para que la optimización
     server-side mediante eventos de compra o leads calificados funcione, los algoritmos de Smart
     Bidding de Meta y Google necesitan un mínimo de 30 a 50 conversiones semanales para salir de la
     fase de aprendizaje. Negocios que invierten menos de $8,000 MXN mensuales no generan el volumen
     de datos necesario para justificar el costo del servicio ni para que el algoritmo aprenda.
  2. **La trampa del ciclo largo en ticket alto (Inmobiliarias / Constructoras):** En el sector
     inmobiliario y de construcción, el cierre de una venta toma entre 2 y 9 meses. Sin embargo, la
     ventana de atribución de Meta para anuncios con destino a WhatsApp (`ctwa_clid`) tiene un
     límite estricto de **7 días posteriores al clic**. Si una constructora solo registra la
     conversión final al firmar escrituras, Meta rechazará o no atribuirá el evento al anuncio. En
     este tipo de clientes, el servicio debe estructurar y optimizar obligatoriamente
     **micro-conversiones intermedias** que sucedan dentro de los primeros 7 días (por ejemplo:
     `Lead calificado` al confirmar presupuesto y zona, `Cita agendada` en showroom, o
     `Visita confirmada`).
- **Cambio propuesto:**
  1. Establecer como criterio de calificación comercial que el cliente invierta un mínimo de $12,000
     MXN mensuales en pauta publicitaria.
  2. En clientes con ciclos de compra superiores a 7 días, exigir en el onboarding el mapeo de
     micro-conversiones intermedias que ocurran dentro de la ventana de atribución de 7 días.
- **Fuente:**
  [Meta Documentation: Conversions API Offline Events Attribution Limits](https://developers.facebook.com/documentation/ads-commerce/conversions-api/offline-events).

---

#### Hallazgo 11: Marco regulatorio de privacidad en México (LFPDPPP): Encargado vs. Responsable

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Reglas del proyecto (Regla 6) y §
  Decisiones pendientes (Contrato y datos).
- **Descripción:** La Regla 6 actual estipula: _"Ningún cliente se conecta sin aviso de privacidad
  actualizado y un acuerdo que diga qué datos se tratan y para qué."_ En la legislación mexicana
  (Ley Federal de Protección de Datos Personales en Posesión de los Particulares - LFPDPPP y su
  Reglamento), el tratamiento de datos de terceros exige formalidades jurídicas indispensables:
  1. **Figura de Encargado del Tratamiento (Artículos 49 al 52 del Reglamento de la LFPDPPP):** El
     cliente final (la empresa que contrata el servicio) es el **Responsable**, pues decide sobre
     los fines del tratamiento de los datos de sus clientes. El servicio de medición es legalmente
     un **Encargado**, ya que procesa y transmite los datos exclusivamente por cuenta e instrucción
     del Responsable. La ley exige un contrato formal de transmisión de datos personales que
     contenga:
     - Compromiso del Encargado de tratar los datos únicamente conforme a las instrucciones del
       Responsable.
     - Implementación de medidas de seguridad administrativas, técnicas y físicas.
     - Prohibición estricta de transferir los datos o utilizarlos para fines propios o entre
       clientes (lo que valida legalmente el aislamiento multi-inquilino de la arquitectura
       técnica).
     - Devolución o supresión segura de las bases de datos al terminar el servicio.
  2. **Aviso de Privacidad del Cliente hacia sus Prospectos:** Para que el cliente pueda capturar y
     enviar legalmente los datos de sus prospectos a Meta, Google y TikTok:
     - El Aviso de Privacidad del cliente (en su sitio web y en el mensaje de bienvenida de
       WhatsApp) debe transparentar el uso de cookies, web beacons y tecnologías de seguimiento en
       servidor (_server-side tracking_).
     - Debe explicitar las finalidades secundarias (análisis publicitario y prospección comercial).
     - Debe informar la **transferencia internacional de datos personales** a proveedores
       tecnológicos en el extranjero (Meta Platforms Inc., Google LLC, ByteDance Ltd., Supabase
       Inc.).
  3. **Minimización y cifrado obligatorio:** Los datos de contacto (teléfono y correo) deben
     normalizarse (E.164, minúsculas, sin caracteres especiales) y cifrarse de forma unidireccional
     con el algoritmo **SHA-256** antes de cualquier almacenamiento o envío a APIs externas, en
     estricto cumplimiento del principio de seguridad y confidencialidad de la LFPDPPP.
- **Cambio propuesto:**
  1. Rediseñar la Regla 6 del proyecto para incluir el anexo contractual de Encargado de Tratamiento
     (_Data Processing Agreement_) obligatorio antes de la conexión técnica.
  2. Proporcionar a cada cliente nuevo un kit de cláusulas modelo de privacidad para que actualice
     su Aviso de Privacidad con el consentimiento para tecnologías de medición y transferencias
     internacionales.
- **Fuentes:**
  - [Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), Artículos 14, 36 y 37](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)
  - [Reglamento de la LFPDPPP, Artículos 49 a 52 (Remisiones y Encargados)](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf)
  - [INAI: Guía para el tratamiento de datos personales en servicios de computo en la nube y publicidad digital](https://inai.org.mx)

---

## Conclusión

El servicio de medición propuesto cuenta con una arquitectura de datos de primer nivel, orientada a
la ingeniería de software y con una separación clara de responsabilidades técnicas. Al implementar
las correcciones identificadas en los contratos de eventos de las plataformas publicitarias (TikTok
y Google Ads), reenfocar el paquete de desarrollo web hacia landings de conversión para proteger los
márgenes, anclar la política de precios de referencia e incorporar las obligaciones de la LFPDPPP,
la propuesta queda lista para convertirse en un producto comercial altamente diferenciado y
rentable.
