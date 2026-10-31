# ANEXO A · Propuesta: servicio de medición y campañas

Versión final · 30 de octubre de 2026 · Francisco Mendoza

Construirlo como un producto para varios clientes desde el primer día, usar Celebra-me y CEJ como
los dos primeros clientes, y empezar a venderlo cuando ambos lleven un mes con datos confiables.

## La oferta

Lo que se vende es certeza: saber qué anuncio trae ventas y dejar de pagar por los que no. La
configuración de campañas va incluida, pero no es el producto.

| Paquete               | Qué incluye                                                                                            | Cómo se cobra                              |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Diagnóstico           | Revisión de Pixel, Conversions API, cuentas y cómo llegan los chats; reporte con hallazgos y plan      | Pago único; puerta de entrada              |
| Implementación        | Captura en el sitio, conexión de WhatsApp, ficha de clientes, eventos a Meta, TikTok y Google, tablero | Pago único por proyecto                    |
| Operación             | Monitoreo diario, reporte semanal, ajustes de eventos y soporte                                        | Mensualidad                                |
| Gestión de campañas   | Creativos, presupuesto y optimización con los datos del tablero                                        | Mensualidad aparte, opcional               |
| Landing de conversión | Landing page a la medida con la captura, el Pixel y la Conversions API integrados desde el inicio      | Pago único; mantenimiento mensual opcional |

Cliente ideal: negocios que venden por WhatsApp, con ticket alto y que ya invierten en anuncios. Por
ejemplo: constructoras, inmobiliarias, clínicas, escuelas, salones y proveedores de eventos.

Queda fuera:

- Prometer ventas o un costo por pedido. Se promete medición confiable y decisiones con datos.
- Ser dueño de las cuentas del cliente.
- Atender el WhatsApp del cliente.
- Hacer sitios web completos. Solo se ofrece la landing de conversión, cotizada aparte como su
  propio paquete.

## Reglas del proyecto

Doce reglas resuelven las dudas antes de que aparezcan. Si una tarea choca con una regla, gana la
regla, o la regla se cambia por escrito.

**Producto**

1. **Regla del segundo cliente.** Nada se construye solo para Celebra-me: si no sirve igual para
   CEJ, va a configuración, no a código.
2. **Configuración, no copias.** Cada cliente es un registro con su configuración: etapas, eventos,
   valores y cuentas. Nunca una rama o carpeta por cliente.
3. **Primero la ficha.** La fuente de verdad es la ficha del cliente final y sus cambios de etapa.
   Todo evento hacia una plataforma sale de ahí.

**Datos**

4. **Las cuentas son del cliente.** Business Manager, dataset, WhatsApp y cuentas de anuncios a
   nombre del cliente; el servicio entra como socio con acceso que se puede retirar.
5. **Mínimo dato personal.** Solo teléfono, nombre y lo necesario para la venta. Teléfono y correo
   se procesan con hash SHA-256. Un hash sigue siendo dato personal seudonimizado, no cifrado: se
   trata con el mismo cuidado que el dato original. Los tokens de cada cliente se guardan cifrados
   con AES-256-GCM (o en Supabase Vault), nunca en texto plano ni en el código.
6. **Aviso y términos antes de conectar.** Ningún cliente se conecta sin aviso de privacidad
   actualizado y sin aceptar los términos del servicio en línea, que dicen qué datos se tratan y
   para qué.

**Calidad**

7. **Cada evento una sola vez.** El `event_id` se calcula de la ficha y la etapa, así un reintento
   nunca duplica.
8. **Nada a producción sin prueba.** Cada evento nuevo pasa por Test Events, o el equivalente de
   cada plataforma, con un caso real antes de activarse.
9. **Ningún proceso falla en silencio.** Cada tarea programada registra su ejecución y avisa si
   falla o no corre. El 29 de octubre, Meta Insights llevaba tres días fallando y solo aparecía como
   tarea en la cola.

**Operación**

10. **Un solo diccionario de métricas.** Cada métrica tiene definición, fórmula y fuente escritas;
    el tablero solo muestra métricas del diccionario.
11. **Mismo flujo de trabajo que Celebra-me.** Cada cambio con tarea, PR y revisión cruzada de otro
    agente, en el mismo tablero de seguimiento.
12. **Lo que se repite se automatiza.** Cada alta sigue el mismo checklist; un paso que se hace a
    mano tres veces se convierte en código.

## Arquitectura de código

Todo pasa por un núcleo; entradas y salidas son módulos intercambiables. Celebra-me y CEJ corren
exactamente este código; entre clientes solo cambian su configuración y sus cuentas conectadas.

Flujo (versión en texto del diagrama):

- **Entradas**, las tres escriben en el núcleo:
  - Captura web: script en el sitio del cliente que guarda fbclid, ttclid, gclid y UTM.
  - Webhook de WhatsApp: el servicio se registra como Tech Provider propio ante Meta y conecta el
    número de cada cliente con coexistencia; trae el ctwa_clid y el código del mensaje. También
    recibe el aviso de desconexión cuando el celular del cliente pasa unos 14 días sin uso.
  - Panel de etapas: quien atiende marca calificado, pedido o perdido.
- **Núcleo multi-cliente en Supabase:** fichas, orígenes, historial de etapas, cola de eventos y
  gasto por anuncio. Cada fila lleva `tenant_id` con RLS; la configuración de cada cliente vive
  aquí, no en el código.
- **Salidas del núcleo:**
  - Despachador: traduce cada etapa a cada plataforma, con `event_id` único, reintentos y registro.
    Envía a Meta (CAPI web y de mensajes), TikTok (Events API) y Google Ads (conversiones offline).
  - Métricas y tablero: vistas SQL del diccionario de métricas, tablero por cliente y reporte
    semanal.
- **Ingesta de gasto:** cron diario de Meta Insights, TikTok y Google; gasto e impresiones por
  anuncio y día que alimentan las métricas.
- **Vigilante:** registra cada ejecución en `job_runs` y manda una alerta activa (correo o mensaje)
  si un envío o una ingesta falla, o si una tarea diaria no tiene ejecución en las últimas 26 horas.
  Una tarea en la cola no cuenta como alerta.

**Stack.** TypeScript en un monorepo nuevo con pnpm, separado del repositorio de Celebra-me;
Supabase para la base de datos, RLS y cron; Cloudflare Workers para webhooks y envíos. Un paquete
por módulo:

| Paquete  | Responsabilidad                                                  |
| -------- | ---------------------------------------------------------------- |
| capture  | Script para el sitio del cliente, más una integración para Astro |
| ingest   | Webhooks de WhatsApp de la app de Tech Provider propia           |
| core     | Esquema, migraciones y reglas de etapas                          |
| dispatch | Un adaptador por plataforma, todos con la misma interfaz         |
| spend    | Ingesta diaria de gasto por plataforma                           |
| metrics  | Vistas SQL y el diccionario de métricas                          |
| panel    | Panel de etapas para celular y tablero por cliente               |
| watch    | Registro de ejecuciones y alertas                                |

Agregar una plataforma nueva significa agregar un adaptador en dispatch y otro en spend; el resto no
cambia.

## Modelo de datos y contrato de eventos

Diez tablas cubren a cualquier cliente. Todas llevan `tenant_id` y políticas RLS, así un cliente
nunca ve datos de otro.

| Tabla          | Qué guarda                                                                                   | Nota                                                 |
| -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| tenants        | Cada cliente del servicio                                                                    | Configuración: etapas, valores, moneda, zona horaria |
| connections    | Cuentas conectadas: dataset de Meta, WhatsApp, TikTok, Google Ads                            | Tokens cifrados con AES-256-GCM                      |
| contacts       | La persona final: teléfono y nombre                                                          | Teléfono en formato internacional y su hash          |
| leads          | Una oportunidad por contacto                                                                 | Etapa actual, valor, tipo de producto                |
| touchpoints    | Origen de cada lead: ruta, campaña, anuncio, fbc, fbp, ctwa_clid, ttclid, gclid, UTM, código | Puede haber varios por lead                          |
| stage_changes  | Historial de etapas: cuándo y quién                                                          | De aquí salen todos los eventos                      |
| outbox         | Eventos pendientes por plataforma                                                            | event_id, intentos, estado y arrendamiento           |
| deliveries     | Respuesta de cada plataforma a cada envío                                                    | Auditoría y calidad de señal                         |
| ad_spend_daily | Gasto e impresiones por anuncio y día                                                        | Llega de Meta Insights, TikTok y Google              |
| job_runs       | Cada ejecución de una tarea programada                                                       | Alimenta las alertas                                 |

La cola usa arrendamiento para que dos procesos nunca envíen el mismo evento: cada fila toma un
`claim_id`, `claimed_at` y `claim_expires_at` de 120 segundos; si el proceso muere, otro la retoma
al vencer el plazo.

El contrato de eventos separa el lenguaje del negocio del de cada plataforma. Internamente solo
existen cinco eventos; un adaptador por plataforma los traduce.

| Evento interno  | Meta, chat directo | Meta, web y landing | TikTok             | Google Ads                                         |
| --------------- | ------------------ | ------------------- | ------------------ | -------------------------------------------------- |
| lead.created    | Meta ya lo cuenta  | Contact             | Contact            | No se envía                                        |
| lead.qualified  | QualifiedLead      | Lead                | Lead               | Conversión offline «Lead calificado»               |
| order.confirmed | Purchase con valor | Purchase con valor  | Purchase con valor | Conversión offline «Pedido» con valor y `order_id` |
| order.canceled  | OrderCanceled      | No se envía         | No se envía        | Ajuste RETRACTION del pedido, dentro de 55 días    |
| order.paid      | Solo interno       | Solo interno        | Solo interno       | Solo interno                                       |

Los nombres están verificados en la documentación de cada plataforma (30 de octubre de 2026):

- **Meta:** QualifiedLead y OrderCanceled están en la lista de eventos que acepta la Conversions API
  para mensajes de negocio.
- **TikTok:** Purchase y Lead son los nombres vigentes; CompletePayment, SubmitForm y PlaceAnOrder
  quedaron en desuso. Cada evento lleva el teléfono y el correo con hash y el ttclid.
- **Google Ads:** el pedido se sube con `order_id`, que es obligatorio para poder retractarlo
  después con `ConversionAdjustmentUploadService`.

## Arquitectura de métricas

Las métricas van en tres capas, y cada una responde una pregunta distinta. La primera manda: si la
señal no es confiable, el tablero marca el periodo y no se decide con esos datos.

**Capa 1. Calidad de señal: ¿podemos confiar en los datos?**

| Métrica                 | Cálculo                                                   | Umbral propuesto    |
| ----------------------- | --------------------------------------------------------- | ------------------- |
| Fichas con origen       | Leads con touchpoint / leads totales                      | 90 % o más          |
| Eventos aceptados       | Envíos aceptados / envíos totales, por plataforma         | 98 % o más          |
| Retraso de envío        | Minutos entre el cambio de etapa y el envío               | Menos de 60         |
| Calidad de coincidencia | Puntaje de coincidencia que reporta Meta para eventos web | Revisar cada semana |
| Procesos al día         | Tareas programadas que corrieron sin error / esperadas    | 100 %               |

**Capa 2. Embudo del cliente: ¿qué anuncios traen ventas?**

Son las métricas del ANEXO B: costo por conversación, tasa de calificación, tasa de cierre, costo
por pedido, retorno, días de clic a pedido y motivo de pérdida. Todas por cliente, campaña, anuncio,
ruta y tipo de producto.

**Capa 3. Negocio del servicio: ¿el servicio es rentable?**

| Métrica                          | Qué indica                                    |
| -------------------------------- | --------------------------------------------- |
| Ingreso mensual recurrente       | Cuánto entra cada mes por operación           |
| Clientes activos y cancelaciones | Si los clientes se quedan                     |
| Horas por implementación         | Si el checklist y la automatización funcionan |
| Días del alta al primer evento   | Qué tan rápido se entrega valor               |
| Margen por cliente               | Ingreso menos horas y costos de proveedores   |

Cada métrica de las tres capas vive en el diccionario (regla 10): nombre, definición, fórmula en
SQL, fuente y frecuencia.

## Ruta hacia la venta

Fechas propuestas; cada etapa avanza solo si cumple su criterio. Los días de agente son la
estimación de la revisión técnica.

| Etapa                                  | Fechas         | Días de agente | Qué se hace                                                                        | Avanza cuando                                                      |
| -------------------------------------- | -------------- | -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0 · Celebra-me como cliente cero       | Nov 2026       | 6 a 8          | Núcleo, cola con arrendamiento, cifrado de tokens, Meta CAPI y gasto de Meta       | 4 semanas con señal en umbral y sin fallas silenciosas             |
| 1 · CEJ como segundo cliente           | Dic 2026       | 4 a 5          | Mismo código; webhook de WhatsApp con Tech Provider propio y aviso de desconexión  | Alta en 5 días hábiles sin código exclusivo de CEJ                 |
| 2 · Piloto con 1 o 2 clientes externos | Ene y feb 2027 | 7 a 9          | TikTok, Google Ads y alertas activas; precio reducido por un caso de estudio       | Hay un caso con cifras de antes y después                          |
| 3 · Oferta abierta                     | Desde mar 2027 | 5 a 6          | Diccionario completo, alta automatizada, página del servicio y paquetes con precio | Se vigila: ingreso recurrente, horas por alta y margen por cliente |
| Total                                  |                | 22 a 28        |                                                                                    |                                                                    |

Notas de la ruta:

- **La etapa 0 valida la tubería, no la venta.** La medición de Celebra-me (ANEXO B, tareas T460 y
  T461) se construye ya dentro del proyecto Celebra-me. Prueba que los eventos llegan bien, pero
  Celebra-me no es un cliente que pague: la prueba comercial empieza en la etapa 2.
- **La etapa 1 es la prueba real del diseño:** si dar de alta a CEJ exige código propio, el núcleo
  todavía no está listo para vender.
- **El trámite de Tech Provider empieza en la etapa 0.** El alta y la revisión de la app ante Meta
  toman semanas; si se retrasa, la ruta de landing ya mide mientras tanto.
- **Antes del piloto se investigan precios** de diagnóstico, implementación, operación y landing en
  México. Las cifras de la revisión de Gemini quedan solo como referencia.
- **Objetivo de campaña según la ruta:** las campañas a la landing usan el objetivo de conversiones
  web; las que abren el chat directo usan el objetivo de mensajes con optimización por compra.
- **Costos y alcance de Operación:** los mensajes de WhatsApp y las herramientas de cada cliente se
  cobran aparte, al costo. La mensualidad incluye respuesta en 24 a 48 horas hábiles y dos ajustes
  menores por mes.

## Decisiones del dueño (30 de octubre de 2026)

| #   | Decisión                 | Elegido                                                                              |
| --- | ------------------------ | ------------------------------------------------------------------------------------ |
| 1   | Dónde vive el código     | Monorepo nuevo, separado de Celebra-me                                               |
| 2   | Cómo se conecta WhatsApp | Tech Provider propio ante Meta desde el inicio, no un proveedor por cliente          |
| 3   | Dónde se marcan etapas   | Panel propio, pensado para celular                                                   |
| 4   | Nombre y marca           | Marca propia del servicio, separada de Celebra-me                                    |
| 5   | Contrato y datos         | Solo términos del servicio en línea, sin acuerdo de tratamiento de datos por cliente |
| 6   | Precios                  | Investigar el mercado de México antes del piloto                                     |
| 7   | Venta que se manda       | Purchase al pedido confirmado, con OrderCanceled si se cae; anticipo opcional        |
| 8   | Paquete web              | Landing de conversión integrada en lugar de sitio web completo                       |
| 9   | Medición de Celebra-me   | T460 y T461 se quedan en el proyecto Celebra-me y se construyen ya                   |

Riesgos que acepta el dueño con estas decisiones:

- **Decisión 2:** el alta como Tech Provider y la revisión de la app ante Meta toman semanas y piden
  verificación del negocio. Mientras no esté lista, la ruta directa al chat no trae ctwa_clid.
- **Decisión 5:** sin acuerdo de tratamiento de datos, quedan sin definir por escrito los papeles de
  responsable y encargado que pide la LFPDPPP. Conviene revisarlo antes del primer cliente externo.

## Registro de cambios

Versión final, 30 de octubre de 2026. Integra la revisión de Gemini (H1 a H12) y la revisión técnica
(C1 a C4).

**Aceptados**

| Hallazgo | Cambio                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| H1       | TikTok usa Purchase y Lead; verificado en la guía de TikTok de eventos estándar actualizados  |
| H2       | Los eventos de TikTok llevan teléfono y correo con hash y el ttclid                           |
| H3       | Google Ads sube el pedido con `order_id` y lo retracta con RETRACTION dentro de 55 días       |
| H5       | Objetivo de campaña según la ruta: conversiones web en landing, mensajes en chat directo      |
| H8       | El paquete de sitio completo se cambia por landing de conversión (decisión 8)                 |
| H9       | Costos de terceros al costo y alcance de Operación: 24 a 48 horas hábiles, dos ajustes al mes |
| H11      | La etapa 0 valida la tubería; la prueba comercial empieza en el piloto                        |
| C1       | Arrendamiento en la cola: `claim_id`, `claimed_at`, `claim_expires_at` de 120 segundos        |
| C2       | Tokens cifrados con AES-256-GCM en `connections`                                              |
| C3       | La captura de ttclid y gclid se agrega a Celebra-me (ANEXO B, fase 1); hoy no se capturan     |
| C4       | Alertas activas y revisión de `job_runs` con ventana de 26 horas                              |
| Ruta     | Estimación de 22 a 28 días de agente, repartida por etapa                                     |

**No aceptados o aceptados en parte**

| Hallazgo | Qué se hizo y por qué                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4       | Rechazado. Meta sí acepta QualifiedLead y OrderCanceled en la Conversions API para mensajes de negocio; se verificó en su documentación.                |
| H6       | En parte. La venta sigue siendo el pedido confirmado con OrderCanceled; el anticipo queda opcional por cliente (decisión 7).                            |
| H7       | En parte. Se adopta el aviso de desconexión tras unos 14 días sin uso; no se usa un proveedor por cliente porque el dueño eligió Tech Provider propio.  |
| H10      | No adoptado. Los precios propuestos quedan como referencia; primero se investiga el mercado de México (decisión 6).                                     |
| H12      | En parte. El hash se trata como dato personal (regla 5); no se adopta el acuerdo de tratamiento de datos porque el dueño eligió solo términos en línea. |
| Técnica  | La revisión técnica también respaldaba H4; se rechaza por la misma verificación. Su propuesta de monorepo separado coincide con la decisión 1.          |
