-- Prepare the real Leah Lexa Baby Shower invitation as DB-published content.
--
-- DO NOT RUN UNTIL:
-- 1. A real owner_user_id has been selected and substituted below.
-- 2. supabase/migrations/20260612000000_add_baby_shower_event_type.sql has been applied.
-- 3. The operator has confirmed this route should be published from DB content:
--    /baby-shower/leah-lexa
--
-- This script is intentionally guarded and transactional. It creates or reuses
-- only the intended Leah Lexa invitation rows and refuses to overwrite unrelated
-- invitations, RSVP events, or published content.

begin;

do $$
declare
  -- REQUIRED: replace this placeholder with the invitation owner's auth.users.id.
  v_owner_user_id uuid := null::uuid;

  v_slug constant text := 'leah-lexa';
  v_event_type constant text := 'baby-shower';
  v_title constant text := 'Baby Shower de Leah Lexa';
  v_base_demo_id constant text := 'demo-baby-shower-celestial';
  v_theme_id constant text := 'celestial-blue';
  v_invitation_id uuid;
  v_existing_invitation record;
  v_existing_event record;
  v_existing_published record;
  v_event_type_check text;
  v_content jsonb;
  v_snapshot jsonb;
begin
  if v_owner_user_id is null then
    raise exception 'OWNER_USER_ID_REQUIRED: replace the placeholder UUID before running this script.';
  end if;

  if not exists (select 1 from auth.users where id = v_owner_user_id) then
    raise exception 'OWNER_USER_ID_NOT_FOUND: % does not exist in auth.users.', v_owner_user_id;
  end if;

  select pg_get_constraintdef(oid)
    into v_event_type_check
  from pg_constraint
  where conrelid = 'public.invitations'::regclass
    and conname = 'invitations_event_type_check';

  if coalesce(v_event_type_check, '') not like '%baby-shower%' then
    raise exception 'BABY_SHOWER_INVITATION_CONSTRAINT_MISSING: apply supabase/migrations/20260612000000_add_baby_shower_event_type.sql first.';
  end if;

  select pg_get_constraintdef(oid)
    into v_event_type_check
  from pg_constraint
  where conrelid = 'public.events'::regclass
    and conname = 'events_event_type_check';

  if coalesce(v_event_type_check, '') not like '%baby-shower%' then
    raise exception 'BABY_SHOWER_EVENT_CONSTRAINT_MISSING: apply supabase/migrations/20260612000000_add_baby_shower_event_type.sql first.';
  end if;

  select *
    into v_existing_invitation
  from public.invitations
  where slug = v_slug
  limit 1;

  if found then
    if v_existing_invitation.archived_at is not null
      or v_existing_invitation.kind <> 'client'
      or v_existing_invitation.event_type <> v_event_type
      or v_existing_invitation.created_by is distinct from v_owner_user_id
    then
      raise exception 'UNSAFE_INVITATION_CONFLICT: invitation slug % belongs to another or archived record (%).', v_slug, v_existing_invitation.id;
    end if;
    v_invitation_id := v_existing_invitation.id;
  else
    v_snapshot := jsonb_build_object(
      'id', v_base_demo_id,
      'eventType', v_event_type,
      'displayName', 'Baby Shower - Celestial Demo',
      'themeId', v_theme_id,
      'defaultSections', jsonb_build_array('quote', 'family', 'gallery', 'location', 'gifts', 'rsvp', 'thankYou'),
      'supportedBlocks', jsonb_build_array('event-details', 'main-people', 'date-locations', 'photos', 'rsvp-config', 'music', 'gifts', 'special-messages'),
      'recommendedBlocks', jsonb_build_array('event-details', 'main-people', 'date-locations', 'photos', 'rsvp-config', 'gifts', 'special-messages'),
      'previewSlug', 'demo-baby-shower-celestial'
    );

    insert into public.invitations (
      kind,
      slug,
      title,
      event_type,
      status,
      base_demo_id,
      theme_id,
      snapshot,
      client_name,
      client_email,
      client_whatsapp,
      photos_received,
      created_by
    )
    values (
      'client',
      v_slug,
      v_title,
      v_event_type,
      'published',
      v_base_demo_id,
      v_theme_id,
      v_snapshot,
      'Hugo y Fernanda',
      '',
      '',
      false,
      v_owner_user_id
    )
    returning id into v_invitation_id;
  end if;

  select *
    into v_existing_event
  from public.events
  where slug = v_slug
  limit 1;

  if found then
    if v_existing_event.deleted_at is not null
      or v_existing_event.event_type <> v_event_type
      or v_existing_event.owner_user_id <> v_owner_user_id
      or v_existing_event.invitation_project_id is distinct from v_invitation_id
    then
      raise exception 'UNSAFE_EVENT_CONFLICT: event slug % belongs to another or deleted record (%).', v_slug, v_existing_event.id;
    end if;
  else
    insert into public.events (
      owner_user_id,
      slug,
      event_type,
      title,
      status,
      invitation_project_id
    )
    values (
      v_owner_user_id,
      v_slug,
      v_event_type,
      v_title,
      'published',
      v_invitation_id
    );
  end if;

  v_content := jsonb_build_object(
    'eventType', v_event_type,
    'isDemo', false,
    'title', v_title,
    'description', 'Invitacion real para celebrar el Baby Shower de Leah Lexa. Los recursos visuales de ultrasonido y perritos son provisionales hasta recibir originales del cliente.',
    '_assetSlug', v_slug,
    'theme', jsonb_build_object(
      'fontFamily', 'serif',
      'preset', v_theme_id
    ),
    'eventTiming', jsonb_build_object(
      'localDateTime', '2026-06-21T14:00',
      'timeZone', 'America/Mexico_City',
      'startsAtUtc', '2026-06-21T20:00:00.000Z'
    ),
    'sectionOrder', jsonb_build_array(
      'quote',
      'family',
      'gallery',
      'location',
      'gifts',
      'personalizedAccess',
      'rsvp',
      'thankYou'
    ),
    'sectionStyles', jsonb_build_object(
      'location', jsonb_build_object('showFlourishes', true),
      'rsvp', jsonb_build_object(
        'labels', jsonb_build_object(
          'name', 'Tu nombre',
          'guestCount', 'Personas que asistirán',
          'attendance', '¿Me acompañas?',
          'confirmButton', 'Confirmar asistencia'
        )
      )
    ),
    'hero', jsonb_build_object(
      'name', 'Leah Lexa',
      'label', 'Mi Baby Shower',
      'date', '2026-06-21T20:00:00.000Z',
      'backgroundImage', 'https://images.unsplash.com/photo-1518893883800-45cd0954574b?w=1200&q=80'
    ),
    'quote', jsonb_build_object(
      'text', 'Los tiempos de Dios son perfectos, y Dios les dio la dicha a mis papis de hacer crecer nuestra familia.',
      'author', 'Leah Lexa'
    ),
    'family', jsonb_build_object(
      'parents', jsonb_build_object(
        'father', 'Hugo',
        'mother', 'Fernanda'
      ),
      'parentsOrder', 'father-first',
      'focalPoint', '50% 50%',
      'labels', jsonb_build_object(
        'sectionTitle', 'Mis papis',
        'sectionSubtitle', 'Hugo y Fernanda',
        'parentsTitle', 'Con mucho amor',
        'sectionMessage', 'Mis papis, Hugo y Fernanda, quieren compartir con ustedes mi Baby Shower. Desde la pancita de mamá, ya siento el cariño con el que me esperan.'
      )
    ),
    'gallery', jsonb_build_object(
      'eyebrow', 'Mi familia de cuatro patas',
      'title', 'Mis hermanos perruños',
      'subtitle', 'Ellos también me esperan con mucho amor y están listos para recibirme en casa.',
      'items', jsonb_build_array(
        jsonb_build_object(
          'caption', 'Imagen provisional de referencia. Reemplazar por assets originales del cliente antes de publicación final.'
        )
      )
    ),
    'location', jsonb_build_object(
      'introEyebrow', 'Nos vemos para celebrar',
      'introHeading', 'Domingo, 21 de junio de 2026',
      'introLede', 'A las 2:00 PM quiero compartir este día tan especial con ustedes.',
      'indicationsHeading', 'Detalles para mis invitados',
      'venues', jsonb_build_array(
        jsonb_build_object(
          'type', 'custom',
          'id', 'baby-shower',
          'venueEvent', 'Baby Shower',
          'venueName', 'Casa de mi familia',
          'address', 'Calle 22, Manzana 1, Lote 20, Col. Guadalupe Proletaria, C.P. 07670',
          'city', 'Ciudad de México',
          'date', 'domingo, 21 de junio de 2026',
          'time', '2:00 PM',
          'mapUrl', 'https://www.google.com/maps/search/?api=1&query=Calle%2022%2C%20Manzana%201%2C%20Lote%2020%2C%20Col.%20Guadalupe%20Proletaria%2C%20C.P.%2007670'
        )
      ),
      'indications', jsonb_build_array(
        jsonb_build_object(
          'iconName', 'MapLocation',
          'styleVariant', 'default',
          'text', 'Referencia: <strong>Casa color naranja al final de la calle, cerca de una capilla.</strong>'
        ),
        jsonb_build_object(
          'iconName', 'DressCode',
          'styleVariant', 'reserved',
          'text', 'Código de vestimenta: <strong>Ropa casual en colores pastel.</strong>'
        )
      )
    ),
    'gifts', jsonb_build_object(
      'title', 'Mesa de regalos',
      'subtitle', 'Si desean tener un detalle para mí, mis papis prepararon una mesa de regalos en Liverpool.',
      'items', jsonb_build_array(
        jsonb_build_object(
          'type', 'store',
          'title', 'Mesa de regalos Liverpool',
          'url', 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/51975133'
        )
      )
    ),
    'rsvp', jsonb_build_object(
      'title', 'Confirma tu asistencia',
      'subcopy', 'RSVP real pendiente de configuración final por el propietario.',
      'guestCap', 4,
      'accessMode', 'personalized-only',
      'confirmationMessage', 'Gracias por confirmar. Mis papis y yo nos ponemos muy felices de saber que nos acompañarán.',
      'confirmationMode', 'api'
    ),
    'thankYou', jsonb_build_object(
      'message', 'Gracias por acompañarnos en este momento tan especial. Me emociona saber que muy pronto podré conocerlos y recibir todo su cariño.',
      'closingName', 'Leah Lexa'
    ),
    'envelope', jsonb_build_object(
      'disabled', false,
      'sealStyle', 'wax',
      'sealIcon', 'monogram',
      'sealInitials', 'LL',
      'sealVariant', 'premium-rose',
      'microcopy', 'Toca para abrir mi invitación',
      'documentLabel', 'Baby Shower',
      'stampText', 'Leah Lexa',
      'stampYear', '2026',
      'closedPalette', jsonb_build_object(
        'primary', 'surfacePrimary',
        'accent', 'actionAccent',
        'background', 'surfacePrimary'
      )
    ),
    'sharing', jsonb_build_object(
      'whatsappTemplate', 'Hola {name}, soy Leah Lexa. Te comparto la invitación a mi Baby Shower: {inviteUrl}',
      'ogDescription', 'Acompáñame en mi Baby Shower el domingo, 21 de junio de 2026, a las 2:00 PM.'
    )
  );

  select *
    into v_existing_published
  from public.published_invitation_content
  where event_type = v_event_type
    and slug = v_slug
  limit 1;

  if found then
    if v_existing_published.deleted_at is not null
      or v_existing_published.invitation_project_id is distinct from v_invitation_id
      or v_existing_published.is_demo is distinct from false
    then
      raise exception 'UNSAFE_PUBLISHED_CONTENT_CONFLICT: published route %/% belongs to another or deleted record (%).', v_event_type, v_slug, v_existing_published.id;
    end if;

    update public.published_invitation_content
    set content = v_content,
        is_demo = false,
        version = version + 1,
        published_at = now()
    where id = v_existing_published.id;
  else
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
    );
  end if;

  update public.invitations
  set status = 'published'
  where id = v_invitation_id;
end;
$$;

commit;
