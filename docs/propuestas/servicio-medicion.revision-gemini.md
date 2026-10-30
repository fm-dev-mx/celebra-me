# Revisión 1: Hechos externos y viabilidad de negocio · Servicio de medición y campañas

**Fecha:** 29 de octubre de 2026 (Actualizada: 30 de octubre de 2026)  
**Revisor:** Gemini (`f12-release · T464`)  
**Documentos evaluados:**

- [docs/propuestas/servicio-medicion.md](servicio-medicion.md)
- [docs/propuestas/plan-medicion-celebra-me.md](plan-medicion-celebra-me.md)

---

## Veredicto

**Aprobada con cambios**

### Resumen ejecutivo del dictamen

La propuesta técnica y de arquitectura multi-inquilino (_multi-tenant_ sobre Supabase con RLS,
desacoplamiento modular en `capture`, `ingest`, `core`, `dispatch`, `spend`, `metrics`, `panel`,
`watch`, y tres capas de métricas) es sólida, escalable y adecuada para transformar la medición de
campañas en un producto de software repetible.

Esta revisión identifica correcciones críticas en contratos de eventos de plataformas externas
(TikTok Events API, Google Ads y Meta Conversions API para Business Messaging), vacíos en la
modelación del embudo publicitario (alineación de objetivos de campaña, eventos de mensajería y
riesgo de ROAS inflado sin anticipo), redefine la lista de precios como una hipótesis interna para
validación en piloto (aclarando la naturaleza no verificada de benchmarks públicos de agencias en
México), concilia el Cliente Cero (Celebra-me) con el Perfil de Cliente Ideal (ICP B2B), y actualiza
el análisis de privacidad bajo el marco legal vigente en México tras la reforma constitucional y el
decreto del Diario Oficial de la Federación (DOF) del 20 de marzo de 2025 (extinción del INAI y
traslado de atribuciones a la Secretaría Anticorrupción y Buen Gobierno).

---

## Hallazgos de la revisión

### Bloque 1: APIs publicitarias y contratos de eventos (TikTok, Google Ads, Meta)

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
- **Fuentes:**
  - [TikTok Business Help Center: Standard Events Reference](https://ads.tiktok.com/help/article/standard-events-reference)
  - [TikTok Events API Developer Documentation](https://business-api.tiktok.com/portal/docs?id=1771100799077377)

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
  TikTok, el objeto `user` debe enviar parámetros de coincidencia avanzada normalizados con hash
  SHA-256 (`phone_number`, `email`), acompañados del identificador de clic `ttclid` capturado en la
  URL de aterrizaje.
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
- **Fuentes:**
  - [Google Ads API: Upload Conversion Adjustments](https://developers.google.com/google-ads/api/docs/conversions/upload-adjustments)
  - [Google Ads API: Upload Click Conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-clicks)

---

#### Hallazgo 4: Lista blanca de eventos en Meta Conversions API para Business Messaging (`action_source: "business_messaging"`)

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Embudo y eventos (líneas
  36-41) y `docs/propuestas/servicio-medicion.md` § Modelo de datos.
- **Descripción:** La propuesta planea enviar `QualifiedLead` y `OrderCanceled` con
  `action_source: "business_messaging"` hacia Meta. Sin embargo, en la documentación oficial de Meta
  para Business Messaging (Conversions API sobre WhatsApp/Messenger), la lista permitida de eventos
  estándar es estrictamente restringida y no admite nombres personalizados arbitrarios. La API
  admite principalmente:
  - `Purchase`
  - `LeadSubmitted` (reemplazo estándar para generación de prospectos en chat)
  - `InitiateCheckout`
  - `AppointmentBooked`

  Eventos como `QualifiedLead` u `OrderCanceled` no forman parte de la lista blanca documentada para
  mensajería y corren el riesgo de ser rechazados con error de esquema o no ser elegibles para
  optimización en Ads Manager. Asimismo, `OrderCanceled` debe tratarse como un ajuste interno o
  evaluarse en campañas web, pero no existe como evento estándar en Business Messaging.

- **Cambio propuesto:**
  1. Sustituir el evento `QualifiedLead` en la ruta directa de mensajería por el evento estándar
     admitido **`LeadSubmitted`**.
  2. Documentar que `OrderCanceled` para la ruta directa de mensajería queda restringido a registro
     interno en la base de datos de Celebra-me, ya que Meta no admite retracción de eventos en
     `business_messaging`.
  3. Ejecutar una llamada de validación en Meta Test Events antes de desplegar la fase 3 para
     confirmar los eventos admitidos por el dataset de WhatsApp.
- **Fuente:**
  [Meta Developers: Conversions API for Business Messaging](https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging).

---

#### Hallazgo 5: Alineación de objetivos de campaña y discrepancia en optimización (Landing vs. Chat directo)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Embudo y eventos y § Fase 2.
- **Descripción:** La propuesta contempla dos rutas:
  1. Anuncios directo al chat de WhatsApp (`action_source: "business_messaging"` con `ctwa_clid`).
  2. Anuncios hacia la landing page en `celebra-me.com`, que envían eventos web
     (`action_source: "website"` o `"chat"` con `fbc`/`fbp`).

  Si las campañas publicitarias en Meta se configuran con el objetivo de **Mensajes**
  (Click-to-WhatsApp), los eventos web enviados por la landing page no pueden ser utilizados por el
  algoritmo de Meta como evento de optimización de esa campaña. Para que Meta optimice por los
  eventos de la landing (`Lead` y `Purchase`), la campaña debe configurarse con el objetivo de
  **Ventas / Clientes potenciales (Conversiones web)**.

- **Cambio propuesto:** Especificar en el plan de campañas que los anuncios dirigidos a la landing
  page deben operarse bajo campañas de Conversión Web en Meta Ads Manager, mientras que los anuncios
  con destino directo a WhatsApp operan bajo campañas de Interacción / Mensajes con optimización
  habilitada para Business Messaging.
- **Fuente:**
  [Meta Ads Manager: Campaign Objectives Guide](https://www.facebook.com/business/help/1438479229607612).

---

#### Hallazgo 6: Desfase temporal del cobro y riesgo de ROAS inflado

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Embudo y eventos (línea 37)
  y § Situación actual.
- **Descripción:** La propuesta estipula enviar el evento `Purchase` con el valor total del paquete
  al marcar `"Pedido confirmado"` (cuando la clienta entrega datos para diseñar), debido a que el
  cobro real se realiza hasta la entrega de la invitación y esperar al cobro excedería el límite de
  7 días. No obstante, al cobrar contra entrega sin anticipo, si la clienta cancela el pedido tras
  el diseño:
  - Meta habrá registrado un `Purchase` con valor monetario completo que nunca se cobró.
  - El ROAS reportado en Ads Manager estará inflado artificialmente frente a los ingresos reales.
  - La ruta de landing marca la cancelación como "solo interno", dejando la compra inflada en Meta
    de forma permanente.
- **Cambio propuesto:** Evaluar como regla de negocio la solicitud de un anticipo simbólico (ej. 30%
  a 50%) para confirmar el pedido, utilizando el anticipo como el activador genuino del evento
  `Purchase` en Meta; o alternativamente, aplicar un factor de descuento probabilístico sobre el
  valor reportado hasta que el flujo de cobro exija anticipo.
- **Fuente:** Mejores prácticas de atribución y valor de conversión en Meta Ads.

---

#### Hallazgo 7: Requisitos técnicos y límites de desconexión en Coexistencia de WhatsApp Business

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/plan-medicion-celebra-me.md` § Fase 3 y
  `docs/propuestas/servicio-medicion.md` § Conexión de WhatsApp.
- **Descripción:** La coexistencia vincula la app móvil WhatsApp Business con la Cloud API bajo un
  mismo número telefónico. Existen restricciones operativas críticas documentadas por Meta:
  1. **Requiere Solution Partner o Tech Provider:** El flujo nativo de coexistencia (_Embedded
     Signup v4_ con parámetro `coex: true`) no está abierto a desarrollo individual sin acreditación
     como socio tecnológico. Esto valida la decisión de recurrir a un BSP acreditado (Chakra, Zernio
     o 360dialog).
  2. **Desconexión por inactividad móvil:** Si el dispositivo móvil principal con la app WhatsApp
     Business pasa aproximadamente 14 días sin conexión o uso, Meta revoca automáticamente el token
     de la Cloud API complementaria, disparando el webhook `ACCOUNT_OFFBOARDED`.
  3. **Reinstalación o cambio de equipo:** Si el cliente reinstala la app o cambia de teléfono, la
     vinculación con la API se suspende y exige reconexión asistida (`ACCOUNT_RECONNECTED`).
  4. **Límite estricto de envío de 7 días:** Meta rechaza eventos de servidor cuyo `event_time`
     supere los 7 días de antigüedad respecto al momento del envío.
- **Cambio propuesto:**
  1. Integrar en `packages/watch` la captura de alertas de los webhooks de ciclo de vida
     (`ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED`).
  2. Aclarar en la documentación que el límite de 7 días corresponde al límite técnico de envío
     (_send limit_) admitido por la API de conversiones de Meta.
- **Fuentes:**
  - [Meta Developers: WhatsApp Business App Coexistence Onboarding Guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
  - [Meta Cloud API Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
  - [Meta Conversions API: Event Time Constraints](https://developers.facebook.com/documentation/ads-commerce/conversions-api/offline-events)

---

### Bloque 2: Evaluación de la oferta comercial y estructura de paquetes

#### Hallazgo 8: Desalineación estratégica del paquete «Sitio web completo»

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Paquete 5) y § Reglas
  del proyecto.
- **Descripción:** El paquete «Sitio web completo» desvirtúa el modelo de producto de software
  repetible:
  1. **Conflicto con la tesis de producto:** El desarrollo web a la medida (UX/UI en Figma,
     maquetación, redacción corporativa y rondas subjetivas de cambios) es un servicio de agencia
     intensivo en mano de obra que dispara las horas por implementación y desvía recursos del núcleo
     de medición.
  2. **Competencia con agencias aliadas:** Las agencias de desarrollo y diseño web son el canal
     natural de distribución B2B para comercializar este software a sus propios clientes. Vender
     sitios web completos convierte al servicio en competidor directo de sus aliados potenciales.
- **Cambio propuesto:** Sustituir «Sitio web completo» por **«Landing page de conversión
  integrada»** (o canalizar sitios completos como referencias hacia agencias externas asociadas).
- **Fuente:** Análisis de modelo _Productized Service_ vs Agencia de Desarrollo Web.

---

#### Hallazgo 9: Delimitación de costos directos de terceros (_Pass-Through_) y SLA de Operación

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Paquetes Implementación
  y Operación).
- **Descripción:** La propuesta original no delimitaba la absorción de costos de infraestructura y
  plataformas:
  - Cuota mensual del BSP de WhatsApp ($20 a $50 USD mensuales por número).
  - Tarifas por conversación de Meta Cloud API.
  - Costos de base de datos e infraestructura serverless (Supabase y Cloudflare Workers). Asimismo,
    definir la Operación como _"Monitoreo diario, reporte semanal, ajustes de eventos y soporte"_
    sin límites exponía el margen a solicitudes desmedidas de rediseño de embudos.
- **Cambio propuesto:**
  1. Incluir cláusula de costos _pass-through_: los costos de BSP, conversaciones de Meta e
     infraestructura se contratan a nombre del cliente o se facturan como costo directo
     reembolsable.
  2. Delimitar la iguala de Operación a soporte técnico con SLA de 24 a 48 horas hábiles y hasta 2
     ajustes menores de eventos al mes; cambios estructurales se cotizan por proyecto.
- **Fuente:** Estructura comercial estándar de servicios SaaS y BSP de mensajería empresarial.

---

### Bloque 3: Estimación de precios de mercado e hipótesis interna de tarifas

#### Hallazgo 10: Rangos preliminares del mercado en México e hipótesis interna de precios

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Decisiones pendientes (Precios).
- **Descripción:** En México, las agencias de marketing digital y consultores técnicos operan bajo
  cotizaciones personalizadas según el alcance y rara vez publican listas fijas de precios en sus
  portales web. En consecuencia, cualquier tabulador de tarifas públicas debe catalogarse como una
  **estimación exploratoria de la industria**, no como un benchmark auditado.

  Los rangos aproximados observados en cotizaciones y modelos de iguala en México oscilan en:
  - _Diagnóstico y auditoría técnica:_ $4,000 a $8,000 MXN (pago único).
  - _Implementación técnica server-side:_ $15,000 a $35,000 MXN (según número de plataformas y
    complejidad del sitio).
  - _Operación y soporte de medición:_ $6,000 a $15,000 MXN mensuales.
  - _Gestión de campañas (media buying):_ $8,000 a $25,000 MXN mensuales (honorarios de gestión,
    excluyendo la pauta).
  - _Landing page de conversión:_ $8,000 a $18,000 MXN.

- **Cambio propuesto:** Presentar la lista de precios no como un estándar verificado del mercado,
  sino como una **hipótesis interna de fijación de precios (pricing hypothesis)** orientada a costos
  y márgenes para el programa piloto:
  - _Diagnóstico:_ $5,000 MXN (100% bonificable si se contrata la implementación).
  - _Implementación:_ $18,000 a $24,000 MXN.
  - _Operación mensual:_ $7,500 MXN / mes.
  - _Gestión de campañas:_ $12,000 MXN / mes (o base de $8,000 MXN + 10% del presupuesto
    publicitario).
  - _Landing page integrada:_ $10,000 MXN. Estas tarifas deberán calibrarse con datos reales de
    esfuerzo y valor percibido durante las fases de piloto (CEJ y clientes externos iniciales).
- **Fuente:** Estimación interna de viabilidad de costos y sondeo cualitativo de tarifas de agencias
  de marketing digital en México (octubre de 2026).

---

### Bloque 4: Cliente ideal y marco de privacidad en México (LFPDPPP)

#### Hallazgo 11: Conciliación entre el Cliente Cero (Celebra-me) y el Cliente Ideal Comercial (ICP)

- **Severidad:** Media
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § La oferta (Cliente ideal) y § Ruta
  hacia la venta.
- **Descripción:** Existe una aparente contradicción entre fijar un umbral de inversión de $12,000+
  MXN mensuales para el Cliente Ideal y utilizar a Celebra-me como Cliente Cero (etapa 0), dado que
  Celebra-me cuenta con un volumen modesto de pedidos por semana. Es necesario reconciliar ambos
  roles:
  1. **Celebra-me como Cliente Cero (Etapa 0):** Su función es validar la integridad del software
     (_dogfooding_): asegurar que los webhooks no fallen, que los identificadores (`ctwa_clid`,
     `fbc`, `ttclid`) se almacenen correctamente, que el panel de etapas funcione en móvil y que los
     eventos se envíen a las APIs sin errores de esquema (Capa 1: Calidad de señal).
  2. **Cliente Ideal Externo (Etapa 2 y 3):** Negocios con inversión publicitaria de $12,000 a
     $30,000+ MXN/mes y volumen suficiente para que los modelos de Smart Bidding de Meta/Google
     salgan de la fase de aprendizaje (30 a 50 conversiones semanales) y para que el retorno
     económico justifique el pago de la iguala mensual de operación ($7,500 MXN/mes).
  3. **Micro-conversiones para ticket alto:** Negocios con ciclos de venta largos (inmobiliarias,
     constructoras) deben mapear micro-conversiones intermedias (`LeadSubmitted`, `Cita agendada`)
     para optimizar dentro del límite de 7 días.
- **Cambio propuesto:** Clarificar explícitamente en el documento la distinción entre los objetivos
  de la Etapa 0 (validación técnica del pipeline con Celebra-me) y el perfil comercial del cliente
  externo (volumen e inversión necesarios para aprendizaje algorítmico y rentabilidad del servicio).
- **Fuente:** Requisitos de aprendizaje de Meta Smart Bidding y modelo de negocio del servicio.

---

#### Hallazgo 12: Marco regulatorio de privacidad en México: Decreto DOF 2025-03-20 y rol de Encargado

- **Severidad:** Alta
- **Sección afectada:** `docs/propuestas/servicio-medicion.md` § Reglas del proyecto (Regla 6) y §
  Decisiones pendientes (Contrato y datos).
- **Descripción:** El análisis legal sobre protección de datos debe sustentarse en el marco
  normativo mexicano vigente:
  1. **Reforma institucional y autoridad garante (DOF 20 de marzo de 2025):** Mediante el Decreto
     publicado en el Diario Oficial de la Federación el 20 de marzo de 2025 (en vigor el 21 de marzo
     de 2025), se extinguieron diversos organismos autónomos, incluido el INAI. Las atribuciones de
     vigilancia, cumplimiento y substanciación en materia de protección de datos personales en el
     sector privado quedaron transferidas a la **Secretaría Anticorrupción y Buen Gobierno** (en
     coordinación con las reformas a la Ley Orgánica de la Administración Pública Federal). Citar al
     INAI como autoridad activa o fundarse en guías extintas constituye un anacronismo regulatorio.
  2. **Figura legal de Responsable vs. Encargado:**
     - El cliente comercial que contrata el servicio actúa legalmente como **Responsable**, pues
       determina los fines y medios del tratamiento de los datos de sus prospectos y compradores.
     - El servicio de medición actúa estrictamente como **Encargado**, tratando datos personales por
       cuenta y bajo instrucción documentada del Responsable.
     - La transmisión de datos del Responsable al servicio de medición constituye una **Remisión**
       (que no requiere consentimiento del titular siempre que derive de un contrato de prestación
       de servicios), la cual debe formalizarse mediante un acuerdo de tratamiento de datos (_Data
       Processing Agreement_ o DPA) con compromisos de confidencialidad, medidas de seguridad y
       prohibición de uso de los datos para fines propios o entre clientes.
  3. **Aviso de Privacidad y Transferencias Internacionales:** Para que el cliente pueda registrar y
     transmitir datos hacia Meta Platforms Inc., Google LLC y ByteDance Ltd., su Aviso de Privacidad
     debe transparentar:
     - El uso de tecnologías de rastreo y medición en servidor (_server-side tracking_).
     - La realización de **transferencias internacionales de datos** a proveedores tecnológicos
       extranjeros para fines de atribución y análisis publicitario.
  4. **Precisión técnica sobre SHA-256 (Hashing vs. Cifrado):**
     - El algoritmo SHA-256 genera un **resumen criptográfico unidireccional (hash)**, no un cifrado
       reversible.
     - Los identificadores seudonimizados mediante hash continúan considerándose datos personales
       conforme a la regulación mientras exista capacidad de correlación o reidentificación
       (especialmente dado que la tabla `contacts` preserva el número telefónico para la operación
       de venta junto a su hash).
- **Cambio propuesto:**
  1. Actualizar la fundamentación de la Regla 6 al marco vigente emanado del Decreto DOF 2025-03-20
     y la autoridad de la Secretaría Anticorrupción y Buen Gobierno.
  2. Diseñar el contrato marco y el anexo DPA bajo la figura de Responsable–Encargado para la
     remisión de datos.
  3. Entregar al cliente un paquete de cláusulas modelo de Aviso de Privacidad que contemple
     transferencias internacionales y tecnologías de medición.
  4. Corregir toda mención técnica en la documentación, sustituyendo "cifrado" por "hashing
     unidireccional con SHA-256" y reconociendo el tratamiento de datos seudonimizados.
- **Fuentes:**
  - [Diario Oficial de la Federación (DOF), Decreto del 20 de marzo de 2025 en materia de simplificación orgánica y protección de datos](https://dof.gob.mx)
  - Ley Federal de Protección de Datos Personales en Posesión de los Particulares (texto reformado)
    y Ley Orgánica de la Administración Pública Federal (Art. 37, Fracc. XV).

---

## Conclusión

El servicio de medición propuesto posee una base técnica sólida. Al integrar las correcciones a los
contratos de eventos de Meta (`LeadSubmitted` y descarte de retracciones en mensajería), mitigar el
riesgo de ROAS inflado sin anticipo, alinear los objetivos de campaña en Ads Manager, adoptar el
stack de Cloudflare Workers sin alterar listas de excepciones del repositorio, posicionar los
precios como hipótesis de validación para piloto y actualizar la arquitectura legal ante la
Secretaría Anticorrupción y Buen Gobierno conforme al decreto del DOF de marzo de 2025, la propuesta
alcanza el estándar de rigor técnico y viabilidad comercial requerido.
