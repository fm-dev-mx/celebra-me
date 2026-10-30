# ANEXO B · Plan de medición Celebra-me: del anuncio a la venta

29 de octubre de 2026 · Francisco Mendoza

## Objetivo

Que Meta aprenda a traer mamás que sí compran una invitación, no solo personas que mandan un
mensaje. Hoy los anuncios se optimizan por conversaciones; la venta ocurre después, dentro de
WhatsApp, y ese dato nunca regresa a Meta.

El plan está cumplido cuando:

- Cada conversación nueva queda registrada con la campaña y el anuncio que la trajo.
- Cada venta confirmada llega a Meta dentro de los 7 días posteriores al clic.
- Cada lunes se ve costo por clienta y ventas por campaña y creativo, sin armar nada a mano.

TikTok entra después, con el mismo registro, cuando Meta ya esté funcionando.

## Situación actual

| Pieza            | Hoy                                                                 | Qué falta                                                                                       |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Anuncios         | Instagram, Facebook y TikTok, con objetivo de mensajes por WhatsApp | Que optimicen por algo más profundo que el mensaje                                              |
| Rutas a WhatsApp | Anuncio directo al chat y landing en celebra-me.com con botón       | Saber de qué ruta, campaña y anuncio viene cada chat                                            |
| WhatsApp         | App WhatsApp Business                                               | La app sola no entrega el identificador del clic del anuncio (ctwa_clid); solo llega por la API |
| Cierre           | Tiempo variable; se cobra al terminar la invitación, sin anticipo   | Un momento de «venta» que ocurra pronto después del clic                                        |
| Registro         | Ventas sin vínculo con los anuncios                                 | Una ficha por clienta con su origen y su etapa                                                  |

Meta solo atribuye una conversión de WhatsApp al anuncio si ocurre dentro de los 7 días posteriores
al clic. Con cierres largos y pago al final, esperar al cobro dejaría fuera muchas ventas.

## Embudo y eventos

La venta que se manda a Meta es el pedido confirmado, no el cobro.

| Etapa                 | Cuándo se marca                                      | Evento, ruta directa al chat             | Evento, ruta de landing                  | Uso                                 |
| --------------------- | ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Conversación iniciada | Llega el primer mensaje                              | Meta ya la cuenta sola                   | Contact al tocar el botón de WhatsApp    | Lo que se optimiza hoy              |
| Lead calificado       | Dio tipo de evento y fecha, y pidió ver diseños      | QualifiedLead                            | Lead                                     | Medir calidad de cada anuncio       |
| Pedido confirmado     | Dijo que sí y mandó los datos para empezar el diseño | Purchase con el valor del paquete en MXN | Purchase con el valor del paquete en MXN | El evento para optimizar por compra |
| Pedido cancelado      | Se cayó después de confirmar                         | OrderCanceled                            | Solo interno                             | Corregir el conteo de ventas        |
| Pagado y entregado    | Invitación terminada y cobrada                       | Solo interno                             | Solo interno                             | Ingreso real en el tablero          |

Los eventos de la ruta directa al chat están en la lista que Meta acepta para conversiones dentro de
WhatsApp, y Meta indica que la optimización por compra está disponible para anuncios que abren
WhatsApp. Meta no elimina duplicados en estos eventos, así que cada etapa se manda una sola vez por
clienta.

Al terminar la fase 3, las dos rutas terminan en la misma ficha: el anuncio directo al chat llega a
WhatsApp con su ctwa_clid; el anuncio a celebra-me.com pasa por la landing, que guarda fbc y crea un
código. El webhook de WhatsApp crea la ficha en Supabase; la persona que atiende marca la etapa; de
ahí salen la CAPI de mensajes (QualifiedLead y Purchase con ctwa_clid) y la CAPI web con
action_source «chat» (Lead y Purchase con fbc y teléfono cifrado).

## Fase 1: ficha y origen de cada chat (semana 1, 2 al 8 de noviembre)

1. Tabla `leads` en Supabase con una pantalla simple en el panel de Celebra-me. Campos: teléfono,
   nombre, tipo de evento (boda, XV, otro), fecha del evento, ruta (chat o landing), campaña,
   anuncio, código de referencia, fbc, fbp, ttclid, ctwa_clid, etapa, valor del paquete, motivo de
   pérdida y fecha de cada cambio de etapa.
2. Código por anuncio en la ruta directa al chat: en la plantilla de mensaje de cada anuncio, el
   mensaje precargado termina con un código corto, por ejemplo «Quiero información (A07)». La
   clienta puede borrarlo; la fase 3 elimina esa dependencia.
3. Código por visita en la ruta de landing: celebra-me.com guarda fbclid, ttclid y UTM al entrar,
   crea la ficha con un código (por ejemplo CM-4821) y abre WhatsApp con ese código en el mensaje.
4. Captura en el chat: quien responde busca el código y marca la etapa en la ficha. Las etiquetas de
   WhatsApp Business no se pueden leer por la API, ni siquiera con coexistencia; la ficha manda.

Listo cuando: todos los chats nuevos de la semana tienen ficha y origen.

## Fase 2: Conversions API para la ruta de landing (semana 2, 9 al 15 de noviembre)

- Pixel en celebra-me.com con PageView, ViewContent en la galería de diseños y Contact al tocar el
  botón de WhatsApp.
- Contact repetido desde el servidor (función en Vercel) con el mismo event_id, para que Meta lo
  cuente una sola vez.
- Cuando la ficha cambia de etapa, una función manda Lead o Purchase con action_source «chat».
  Incluye fbc, el teléfono en SHA-256 y el valor en MXN.
- Probar todo en Test Events antes de activarlo.
- Cada evento se envía el mismo día en que se marca la etapa; Meta rechaza eventos con más de 7 días
  de antigüedad.

Listo cuando: los eventos aparecen en Test Events.

## Fase 3: anuncios directo al chat con coexistencia (semana 3, 16 al 22 de noviembre)

La ruta directa al chat se atribuye bien con el ctwa_clid, y Meta solo lo entrega por la API de
WhatsApp en la nube. La coexistencia conecta el mismo número de WhatsApp Business a esa API sin
perder la app ni el historial, y está disponible en México.

- Se sigue contestando desde la app del celular; los mensajes se reflejan en la API.
- El primer mensaje que llega de un anuncio trae el ctwa_clid. Un webhook crea la ficha y lo guarda;
  si el mensaje trae un código de landing, también la enlaza.
- Al marcar etapa, se envía QualifiedLead, Purchase u OrderCanceled con action_source
  «business_messaging» y el ctwa_clid.

Requisitos: un proveedor de WhatsApp (Solution Partner o Tech Provider de Meta) que ofrezca
coexistencia, webhook hacia el servidor propio y envío de eventos de conversión para mensajes;
WhatsApp Business versión 2.24.17 o superior.

Qué cambia en el WhatsApp de Celebra-me: todos los dispositivos vinculados se desconectan y se
vuelven a vincular, excepto WhatsApp para Windows, que no es compatible (en la PC se usa WhatsApp
Web). Se desactivan listas de difusión, mensajes temporales, ver una vez y ubicación en tiempo real.
Responder desde la app sigue siendo gratis; solo se cobran los mensajes enviados por la API. Si el
celular principal pasa unos 14 días sin uso, la conexión con la API se corta.

Listo cuando: llega el primer Purchase con ctwa_clid.

## Semana 4: tablero y primera decisión (23 al 29 de noviembre)

Vista en Supabase con gasto por anuncio y eventos de TikTok. Listo cuando: sale el primer reporte,
el lunes 30 de noviembre. Después: probar una campaña optimizada por compra con los pedidos
acumulados. Si el alta del proveedor se retrasa, las fases 1 y 2 ya miden la ruta de landing y los
códigos por anuncio.

## Operación diaria

| Momento                              | Quién                  | Qué hace                                                                                     |
| ------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------- |
| Llega un chat nuevo                  | Quien atiende WhatsApp | Revisa que la ficha tenga origen; en la fase 1 copia el código, desde la fase 3 se crea sola |
| La clienta da tipo de evento y fecha | Quien atiende WhatsApp | Marca Lead calificado                                                                        |
| La clienta confirma el pedido        | Quien atiende WhatsApp | Marca Pedido confirmado y el valor del paquete                                               |
| La clienta se cae                    | Quien atiende WhatsApp | Marca Perdido con el motivo: precio, fecha, eligió otra opción o dejó de contestar           |
| Lunes, 20 minutos                    | Dueño                  | Revisa el tablero y decide qué anuncios escalar o pausar                                     |

## Métricas y tablero

| Métrica                | Cálculo                     | Qué decide                                        |
| ---------------------- | --------------------------- | ------------------------------------------------- |
| Costo por conversación | Gasto / chats nuevos        | Si el creativo atrae                              |
| Tasa de calificación   | Leads calificados / chats   | Si atrae a la clienta correcta                    |
| Tasa de cierre         | Pedidos / leads calificados | Si el problema está en el chat y no en el anuncio |
| Costo por pedido       | Gasto / pedidos confirmados | Qué escalar y qué pausar                          |
| Retorno                | Valor de pedidos / gasto    | Si la campaña se paga sola                        |
| Días de clic a pedido  | Mediana por campaña         | Cuántas ventas caen fuera de los 7 días           |
| Motivo de pérdida      | Conteo por motivo           | Qué ajustar en oferta o guion                     |

Cada métrica se ve por campaña, anuncio, ruta (chat o landing) y tipo de evento (boda o XV). El
gasto se trae de la API de Marketing de Meta; al principio basta una exportación semanal.

## Decisiones pendientes y riesgos

- [ ] Definir qué cuenta como lead calificado (propuesta: dio tipo de evento y fecha, y pidió ver
      diseños).
- [ ] Definir el valor que se manda con cada pedido: el precio del paquete elegido.
- [ ] Confirmar quién atiende el WhatsApp de Celebra-me y desde qué dispositivos.
- [ ] Elegir proveedor para la coexistencia: que opere en México, mande webhooks al servidor propio
      y envíe eventos de conversión para mensajes; comparar costo mensual.
- [ ] Agregar al aviso de privacidad de celebra-me.com el uso del Pixel de Meta y de TikTok.

Riesgos:

- Un pedido que se confirma después de los 7 días del clic no se acredita al anuncio.
- Con pocos pedidos por semana, optimizar por compra aprende despacio; mientras, se mantiene la
  campaña por mensajes.
- Un mensaje desde un dispositivo no compatible no genera webhook y no llega a la ficha.
- Si el código de un chat se pierde, la ficha se marca «origen desconocido» en lugar de adivinar.

## Fuentes

- [Meta: Conversions API para mensajes de negocio](https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging)
- [Meta: coexistencia de WhatsApp Business app con Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Meta: valores de action_source](https://developers.facebook.com/documentation/ads-commerce/conversions-api/guides/append-attribution/reference)
- [Meta: límite de 7 días para event_time](https://developers.facebook.com/documentation/ads-commerce/conversions-api/offline-events)
- [Zernio: ventana de atribución de anuncios a WhatsApp](https://docs.zernio.com/platforms/whatsapp/ctwa)
- [Chakra: coexistencia disponible en México](https://chakrahq.com/help/chat/faqs/coexistence-faqs)
