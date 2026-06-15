-- @script-id: 20260615_prepare_luna_y_estrella_primera_comunion
-- @purpose: Prepare Luna y Estrella Primera Comunión invitation as DB-published content
-- @env: production
-- @ticket: CELEBRA-LUNA-ESTRELLA
-- @tables: public.invitations, public.events, public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 3
-- @expected-rows-max: 3
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.invitations where slug = 'luna-y-estrella' and event_type = 'primera-comunion';
-- @rollback: restore the previous invitations, events, and published_invitation_content rows for slug luna-y-estrella from backup; if this is the first publish, archive the invitation and event rows and soft-delete the published content row.

begin;

do $$
declare
  -- BLOCKER: Replace with the real auth.users.id for the invitation owner before execution.
  v_owner_user_id uuid := null::uuid;

  v_slug constant text := 'luna-y-estrella';
  v_event_type constant text := 'primera-comunion';
  v_title constant text := 'Primera Comunión de Luna y Estrella';
  v_base_demo_id constant text := 'demo-bautismo-angelic-presence';
  v_theme_id constant text := 'angelic-presence';
  v_asset_slug constant text := 'luna-y-estrella-primera-comunion';
  v_invitation_id uuid;
  v_event_id uuid;
  v_existing_invitation record;
  v_existing_event record;
  v_content jsonb;
begin
  if v_owner_user_id is null then
    raise exception 'OWNER_USER_ID_REQUIRED';
  end if;

  if v_asset_slug = v_slug then
    raise exception 'ASSET_SLUG_MUST_NOT_EQUAL_ROUTE_SLUG';
  end if;

  if v_slug = 'leah-lexa' or v_base_demo_id = 'demo-baby-shower-celestial' then
    raise exception 'UNSAFE_SOURCE_OR_SLUG';
  end if;

  select * into v_existing_invitation
  from public.invitations
  where slug = v_slug
  for update;

  if found and (
    v_existing_invitation.kind <> 'client'
    or v_existing_invitation.event_type <> v_event_type
    or v_existing_invitation.base_demo_id <> v_base_demo_id
  ) then
    raise exception 'UNSAFE_INVITATION_COLLISION slug=%', v_slug;
  end if;

  select * into v_existing_event
  from public.events
  where slug = v_slug
  for update;

  if found and v_existing_event.event_type <> v_event_type then
    raise exception 'UNSAFE_EVENT_COLLISION slug=%', v_slug;
  end if;

  v_content := $json$
{
  "eventType": "primera-comunion",
  "isDemo": false,
  "title": "Primera Comunión de Luna y Estrella",
  "description": "Invitación para la Primera Comunión de Luna Yamileth y Estrella Abigail, con una estética blanca, rosa suave, floral y ceremonial.",
  "_assetSlug": "luna-y-estrella-primera-comunion",
  "theme": { "fontFamily": "serif", "preset": "angelic-presence" },
  "eventTiming": {
    "localDateTime": "2026-08-01T14:00",
    "timeZone": "America/Mexico_City",
    "startsAtUtc": "2026-08-01T20:00:00.000Z"
  },
  "sectionOrder": ["quote", "family", "gallery", "countdown", "location", "itinerary", "gifts", "personalizedAccess", "rsvp", "thankYou"],
  "sectionStyles": {
    "location": { "showFlourishes": true },
    "rsvp": {
      "labels": {
        "name": "Nombre completo",
        "guestCount": "Personas que asistirán",
        "attendance": "¿Nos acompañará?",
        "confirmButton": "Confirmar asistencia"
      }
    }
  },
  "hero": {
    "name": "Luna Yamileth",
    "secondaryName": "Estrella Abigail",
    "label": "Primera Comunión",
    "date": "2026-08-01T20:00:00.000Z",
    "backgroundImage": "hero",
    "focalPoint": "50% 42%"
  },
  "quote": {
    "text": "Jesús es el pan de vida que llena nuestro corazón de amor y esperanza.",
    "author": "Juan 6:35"
  },
  "family": {
    "featuredImage": "family",
    "focalPoint": "50% 38%",
    "parents": {
      "father": "Juan Manuel Villa Ponce",
      "mother": "Estefanía Báez Pérez"
    },
    "parentsOrder": "father-first",
    "godparents": [
      { "name": "Emiliano Pérez Rodríguez", "role": "Padrino de Luna Yamileth" },
      { "name": "María Guadalupe Villa Ponce", "role": "Madrina de Estrella Abigail" }
    ],
    "labels": {
      "sectionTitle": "Con la bendición de Dios",
      "sectionSubtitle": "Nuestra familia",
      "parentsTitle": "Nuestros papás",
      "godparentsTitle": "Padrinos",
      "sectionMessage": "Con inmensa alegría compartimos este día de fe. Gracias por acompañar a Luna y Estrella con su cariño y sus bendiciones."
    }
  },
  "gallery": {
    "eyebrow": "Galería",
    "title": "Instantes de luz",
    "subtitle": "Detalles suaves para recordar este día de fe",
    "items": [
      { "image": "gallery01", "caption": "Un camino de bendición" },
      { "image": "gallery02", "caption": "Fe, flores y luz" }
    ]
  },
  "countdown": {
    "title": "Nos acercamos con alegría",
    "footerText": "Sábado, 1 de agosto de 2026"
  },
  "location": {
    "visibility": "after-rsvp",
    "introEyebrow": "Detalles reservados",
    "introHeading": "Ubicación",
    "introLede": "Por cuidado de la familia, compartiremos la dirección después de confirmar asistencia.",
    "indicationsHeading": "Indicaciones",
    "ceremony": {
      "venueEvent": "Celebración",
      "venueName": "Salón García",
      "address": "Victoriano Huerta 51, Col. San Francisco, Uruapan",
      "city": "Uruapan",
      "date": "2026-08-01",
      "time": "14:00",
      "image": "ceremony",
      "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=Victoriano%20Huerta%2051%20Col.%20San%20Francisco%20Uruapan"
    },
    "reception": {
      "venueEvent": "Recepción",
      "venueName": "Salón García",
      "address": "Victoriano Huerta 51, Col. San Francisco, Uruapan",
      "city": "Uruapan",
      "date": "2026-08-01",
      "time": "14:00",
      "image": "reception",
      "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=Victoriano%20Huerta%2051%20Col.%20San%20Francisco%20Uruapan"
    },
    "indications": [
      {
        "iconName": "Calendar",
        "styleVariant": "default",
        "text": "<strong>Llegada sugerida</strong> Favor de llegar con anticipación para recibir a Luna y Estrella."
      },
      {
        "iconName": "DressCode",
        "styleVariant": "reserved",
        "text": "<strong>Vestimenta</strong> Tonos claros, formales y suaves."
      }
    ]
  },
  "itinerary": {
    "title": "Programa",
    "subtitle": "Primera Comunión",
    "items": [
      { "iconName": "Reception", "label": "Bienvenida", "time": "14:00", "description": "Recepción de invitados" },
      { "iconName": "Church", "label": "Bendición", "time": "14:30", "description": "Momento de fe para Luna y Estrella" },
      { "iconName": "Dinner", "label": "Comida", "time": "15:00", "description": "Convivencia familiar" },
      { "iconName": "Cake", "label": "Pastel", "time": "16:30", "description": "Un dulce recuerdo para compartir" }
    ]
  },
  "gifts": {
    "title": "Su presencia es nuestro regalo",
    "subtitle": "Gracias por acompañarnos en este momento tan especial para Luna y Estrella.",
    "items": [
      {
        "type": "cash",
        "title": "Lluvia de sobres",
        "text": "Si desean tener un detalle, podrán hacerlo con mucho cariño el día de la celebración."
      }
    ]
  },
  "rsvp": {
    "title": "Confirma tu asistencia",
    "subcopy": "Su respuesta nos ayuda a preparar cada detalle de esta celebración de fe.",
    "guestCap": 4,
    "accessMode": "hybrid",
    "confirmationMessage": "Gracias por confirmar. Será un honor compartir este día tan especial con ustedes.",
    "confirmationMode": "api",
    "responseMessages": {
      "confirmed": {
        "title": "Gracias por acompañarnos, {guestName}.",
        "subtitle": "Su confirmación ha sido registrada."
      },
      "declined": {
        "title": "Gracias por avisarnos, {guestName}.",
        "subtitle": "Agradecemos mucho su cariño para Luna y Estrella."
      }
    }
  },
  "thankYou": {
    "message": "Gracias por compartir con nosotras este día de fe. Su presencia y sus bendiciones quedarán guardadas con mucho cariño.",
    "closingName": "Luna y Estrella",
    "image": "thankYouPortrait",
    "focalPoint": "50% 50%"
  },
  "interludes": [
    {
      "image": "interlude01",
      "afterSection": "quote",
      "alt": "Detalle floral y religioso para Primera Comunión",
      "height": "tall",
      "focalPoint": "50% 58%"
    },
    {
      "image": "interlude02",
      "afterSection": "gallery",
      "alt": "Detalle luminoso y ceremonial de Primera Comunión",
      "height": "screen",
      "focalPoint": "53% 55%"
    }
  ],
  "envelope": {
    "disabled": false,
    "sealStyle": "wax",
    "sealIcon": "flower",
    "sealInitials": "L·E",
    "microcopy": "Primera Comunión de Luna y Estrella",
    "documentLabel": "Primera Comunión",
    "cardLabel": "Primera Comunión",
    "cardTagline": "Una celebración de fe",
    "stampText": "Luna y Estrella",
    "stampYear": "2026"
  },
  "sharing": {
    "whatsappTemplate": "Hola {name}, con alegría les compartimos la invitación a la Primera Comunión de Luna y Estrella: {inviteUrl}",
    "ogImage": "hero",
    "ogDescription": "Acompáñenos en la Primera Comunión de Luna y Estrella el sábado, 1 de agosto de 2026."
  }
}
$json$::jsonb;

  if v_content ->> '_assetSlug' <> v_asset_slug then
    raise exception 'ASSET_SLUG_MISMATCH';
  end if;

  insert into public.invitations (
    slug,
    title,
    event_type,
    status,
    base_demo_id,
    theme_id,
    snapshot,
    client_name,
    created_by,
    kind
  )
  values (
    v_slug,
    v_title,
    v_event_type,
    'published',
    v_base_demo_id,
    v_theme_id,
    jsonb_build_object(
      'id', v_base_demo_id,
      'eventType', 'bautizo',
      'displayName', 'Bautizo — Angelic Presence',
      'themeId', v_theme_id,
      'previewSlug', v_base_demo_id
    ),
    'Luna y Estrella',
    v_owner_user_id,
    'client'
  )
  on conflict (slug) do update
  set
    title = excluded.title,
    event_type = excluded.event_type,
    status = excluded.status,
    base_demo_id = excluded.base_demo_id,
    theme_id = excluded.theme_id,
    snapshot = excluded.snapshot,
    client_name = excluded.client_name,
    created_by = excluded.created_by,
    kind = excluded.kind
  returning id into v_invitation_id;

  insert into public.events (
    owner_user_id,
    slug,
    event_type,
    title,
    status,
    published_at,
    invitation_project_id
  )
  values (
    v_owner_user_id,
    v_slug,
    v_event_type,
    v_title,
    'published',
    now(),
    v_invitation_id
  )
  on conflict (slug) do update
  set
    owner_user_id = excluded.owner_user_id,
    event_type = excluded.event_type,
    title = excluded.title,
    status = excluded.status,
    published_at = excluded.published_at,
    invitation_project_id = excluded.invitation_project_id
  returning id into v_event_id;

  insert into public.published_invitation_content (
    invitation_project_id,
    slug,
    event_type,
    is_demo,
    content,
    version,
    published_at
  )
  values (
    v_invitation_id,
    v_slug,
    v_event_type,
    false,
    v_content,
    1,
    now()
  )
  on conflict (event_type, slug) do update
  set
    invitation_project_id = excluded.invitation_project_id,
    is_demo = false,
    content = excluded.content,
    version = public.published_invitation_content.version + 1,
    published_at = now();
end $$;

commit;
