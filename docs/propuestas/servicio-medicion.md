# ANEXO A · Propuesta: servicio de medición y campañas

29 de octubre de 2026 · Francisco Mendoza

Construirlo como un producto para varios clientes desde el primer día, usar Celebra-me y CEJ como
los dos primeros clientes, y empezar a venderlo cuando ambos lleven un mes con datos confiables.

## La oferta

Lo que se vende es certeza: saber qué anuncio trae ventas y dejar de pagar por los que no. La
configuración de campañas va incluida, pero no es el producto.

| Paquete             | Qué incluye                                                                                            | Cómo se cobra                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Diagnóstico         | Revisión de Pixel, Conversions API, cuentas y cómo llegan los chats; reporte con hallazgos y plan      | Pago único; puerta de entrada                             |
| Implementación      | Captura en el sitio, conexión de WhatsApp, ficha de clientes, eventos a Meta, TikTok y Google, tablero | Pago único por proyecto                                   |
| Operación           | Monitoreo diario, reporte semanal, ajustes de eventos y soporte                                        | Mensualidad                                               |
| Gestión de campañas | Creativos, presupuesto y optimización con los datos del tablero                                        | Mensualidad aparte, opcional                              |
| Sitio web completo  | Sitio a la medida con la captura, el Pixel y la Conversions API integrados desde el inicio             | Pago único de precio alto; mantenimiento mensual opcional |

Cliente ideal: negocios que venden por WhatsApp, con ticket alto y que ya invierten en anuncios. Por
ejemplo: constructoras, inmobiliarias, clínicas, escuelas, salones y proveedores de eventos.

Queda fuera:

- Prometer ventas o un costo por pedido. Se promete medición confiable y decisiones con datos.
- Ser dueño de las cuentas del cliente.
- Atender el WhatsApp del cliente.
- Hacer sitios web completos dentro de la implementación; se cotizan aparte como su propio paquete.

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
   salen cifrados con SHA-256; los tokens viven en un almacén de secretos, nunca en el código.
6. **Aviso y contrato antes de conectar.** Ningún cliente se conecta sin aviso de privacidad
   actualizado y un acuerdo que diga qué datos se tratan y para qué.

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
  - Webhook de WhatsApp: vía un proveedor con coexistencia; trae el ctwa_clid y el código del
    mensaje.
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
- **Vigilante:** registra cada ejecución y avisa si un envío o una ingesta falla o no corre.

**Stack.** TypeScript en un monorepo con pnpm; Supabase para la base de datos, RLS, cron y almacén
de secretos; funciones en Vercel para webhooks y envíos. Un paquete por módulo:

| Paquete  | Responsabilidad                                                  |
| -------- | ---------------------------------------------------------------- |
| capture  | Script para el sitio del cliente, más una integración para Astro |
| ingest   | Webhooks de WhatsApp, un adaptador por proveedor                 |
| core     | Esquema, migraciones y reglas de etapas                          |
| dispatch | Un adaptador por plataforma, todos con la misma interfaz         |
| spend    | Ingesta diaria de gasto por plataforma                           |
| metrics  | Vistas SQL y el diccionario de métricas                          |
| panel    | Panel de etapas y tablero por cliente                            |
| watch    | Registro de ejecuciones y alertas                                |

Agregar una plataforma nueva significa agregar un adaptador en dispatch y otro en spend; el resto no
cambia.

## Modelo de datos y contrato de eventos

Diez tablas cubren a cualquier cliente. Todas llevan `tenant_id` y políticas RLS, así un cliente
nunca ve datos de otro.

| Tabla          | Qué guarda                                                                                   | Nota                                                 |
| -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| tenants        | Cada cliente del servicio                                                                    | Configuración: etapas, valores, moneda, zona horaria |
| connections    | Cuentas conectadas: dataset de Meta, WhatsApp, TikTok, Google Ads                            | Tokens en el almacén de secretos                     |
| contacts       | La persona final: teléfono y nombre                                                          | Teléfono en formato internacional y su hash          |
| leads          | Una oportunidad por contacto                                                                 | Etapa actual, valor, tipo de producto                |
| touchpoints    | Origen de cada lead: ruta, campaña, anuncio, fbc, fbp, ctwa_clid, ttclid, gclid, UTM, código | Puede haber varios por lead                          |
| stage_changes  | Historial de etapas: cuándo y quién                                                          | De aquí salen todos los eventos                      |
| outbox         | Eventos pendientes por plataforma                                                            | event_id, intentos, estado                           |
| deliveries     | Respuesta de cada plataforma a cada envío                                                    | Auditoría y calidad de señal                         |
| ad_spend_daily | Gasto e impresiones por anuncio y día                                                        | Llega de Meta Insights, TikTok y Google              |
| job_runs       | Cada ejecución de una tarea programada                                                       | Alimenta las alertas                                 |

El contrato de eventos separa el lenguaje del negocio del de cada plataforma. Internamente solo
existen cinco eventos; un adaptador por plataforma los traduce.

| Evento interno  | Meta, chat directo | Meta, web y landing | TikTok           | Google Ads                            |
| --------------- | ------------------ | ------------------- | ---------------- | ------------------------------------- |
| lead.created    | Meta ya lo cuenta  | Contact             | Contact          | No se envía                           |
| lead.qualified  | QualifiedLead      | Lead                | Lead             | Conversión offline «Lead calificado»  |
| order.confirmed | Purchase con valor | Purchase con valor  | Compra con valor | Conversión offline «Pedido» con valor |
| order.canceled  | OrderCanceled      | No se envía         | No se envía      | Ajuste de la conversión               |
| order.paid      | Solo interno       | Solo interno        | Solo interno     | Solo interno                          |

Las columnas de Meta están verificadas para Celebra-me. Los nombres exactos de TikTok y Google se
confirman en su documentación (fase 1 de la revisión).

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

Fechas propuestas; cada etapa avanza solo si cumple su criterio.

| Etapa                                  | Fechas         | Qué se hace                                                    | Avanza cuando                                                      |
| -------------------------------------- | -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0 · Celebra-me como cliente cero       | Nov 2026       | Se ejecuta el plan de medición (ANEXO B) sobre el núcleo nuevo | 4 semanas con señal en umbral y sin fallas silenciosas             |
| 1 · CEJ como segundo cliente           | Dic 2026       | Mismo código; solo configuración y cuentas conectadas          | Alta en 5 días hábiles sin código exclusivo de CEJ                 |
| 2 · Piloto con 1 o 2 clientes externos | Ene y feb 2027 | Precio reducido a cambio de un caso de estudio público         | Hay un caso con cifras de antes y después                          |
| 3 · Oferta abierta                     | Desde mar 2027 | Paquetes con precio, página del servicio y checklist de alta   | Se vigila: ingreso recurrente, horas por alta y margen por cliente |

La etapa 1 es la prueba real del diseño: si dar de alta a CEJ exige código propio, el núcleo todavía
no está listo para vender.

## Decisiones pendientes

Seis decisiones, cada una con la opción recomendada:

- [ ] **Dónde vive el código.** Recomendado: un monorepo nuevo, separado de Celebra-me, que
      Celebra-me use como su primer cliente. Dentro de Celebra-me sería más rápido hoy, pero amarra
      el servicio al producto.
- [ ] **Cómo se conecta WhatsApp.** Recomendado: un proveedor oficial por cliente al inicio.
      Registrarse como Tech Provider de Meta conviene hasta tener varios clientes, por el trámite y
      los permisos que pide.
- [ ] **Dónde se marcan las etapas.** Recomendado: un panel propio y simple, pensado para celular.
      Integrarse con el CRM de cada cliente viene después, como adaptador.
- [ ] **Nombre y marca.** Una marca propia del servicio, separada de Celebra-me, para que un cliente
      de construcción no lo asocie con invitaciones.
- [ ] **Contrato y datos.** Un contrato tipo con aviso de privacidad y acuerdo de tratamiento de
      datos, revisado por un abogado antes del primer cliente externo.
- [ ] **Precios.** Investigar cuánto se cobra hoy en México por diagnóstico, implementación,
      operación y sitio web antes de la etapa de piloto.
