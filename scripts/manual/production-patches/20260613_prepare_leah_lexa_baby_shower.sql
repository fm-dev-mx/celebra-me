-- Prepare the real Leah Lexa Baby Shower invitation as DB-published content.
--
-- DO NOT RUN UNTIL:
-- 1. A real owner_user_id has been selected and substituted below.
-- 2. supabase/migrations/20260612000000_add_baby_shower_event_type.sql has been applied.
-- 3. The operator has confirmed this route should be published from DB content:
--    /baby-shower/leah-lexa
--
-- @script-id: 20260613_prepare_leah_lexa_baby_shower
-- @purpose: Prepare real Leah Lexa Baby Shower invitation as DB-published content
-- @env: production
-- @ticket: CELEBRA-LEAH
-- @tables: public.invitations, public.events, public.published_invitation_content
-- @operation: update
--   Note: This patch has both an INSERT path (first application: inserts into
--   invitations, events, and published_invitation_content = 3 rows) and an UPDATE
--   path (re-runs / existing rows: updates published_invitation_content and
--   optionally invitations.status = 1-2 rows).  Per the manifest contract
--   the @operation field must be a single value, so "update" is chosen as
--   the highest-risk single value accepted by the guide (the UPDATE path
--   silently modifies published content without creating new rows).
-- @expected-rows-min: 1
-- @expected-rows-max: 3
--   Note: expected-rows-min = 1 (update/re-publish path touches 1-2 rows);
--   expected-rows-max = 3 (clean insert path creates 3 rows).
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.invitations where slug = 'leah-lexa' and event_type = 'baby-shower';
-- @rollback: restore from backup
--
-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PRODUCTION CANDIDATE — client-approved assets are now wired.  The         ║
-- ║  owner_user_id below MUST be replaced with a real auth.users.id before     ║
-- ║  execution; the script fails closed with OWNER_USER_ID_REQUIRED if null.   ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝
--
-- This script is intentionally guarded and transactional. It creates or reuses
-- only the intended Leah Lexa invitation rows and refuses to overwrite unrelated
-- invitations, RSVP events, or published content.

begin;

do $$
declare
  -- BLOCKER (production): This patch CANNOT run until a real auth.users.id for
  -- the intended owner (Hugo/Fernanda for Leah Lexa) is substituted below.
  -- Do NOT fake or infer a UUID — the script fails closed with
  -- OWNER_USER_ID_REQUIRED if null.  This is NOT production-ready.
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
      'id', v_slug,
      'eventType', v_event_type,
      'displayName', 'Baby Shower — Leah Lexa',
      'themeId', v_theme_id,
      'defaultSections', jsonb_build_array('quote', 'family', 'location', 'gifts', 'rsvp', 'gallery', 'thankYou'),
      'supportedBlocks', jsonb_build_array('event-details', 'main-people', 'date-locations', 'photos', 'rsvp-config', 'music', 'gifts', 'special-messages'),
      'recommendedBlocks', jsonb_build_array('event-details', 'main-people', 'date-locations', 'photos', 'rsvp-config', 'gifts', 'special-messages'),
      'previewSlug', 'leah-lexa-baby-shower'
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
      null::text,
      null::text,
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
    'description', 'Invitacion real para celebrar el Baby Shower de Leah Lexa. Los recursos visuales incluyen imagenes oficiales del cliente.',
    -- Must match asset directory name under src/assets/images/events/ for isValidEvent()
    '_assetSlug', 'leah-lexa-baby-shower',
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
      'location',
      'gifts',
      'personalizedAccess',
      'rsvp',
      'gallery',
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
      'backgroundImage', 'hero'
    ),
    'quote', jsonb_build_object(
      'text', 'Los tiempos de Dios son perfectos, y Dios les dio la dicha a mis papis de hacer crecer nuestra familia.',
      'author', 'Leah Lexa'
    ),
    'family', jsonb_build_object(
      'featuredImage', 'family',
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
      'variant', 'single',
      'eyebrow', 'Mis guardianes',
      'title', 'La manada también te espera',
      'subtitle', 'En casa ya hay patitas listas para recibirte con amor.',
      'items', jsonb_build_array(
        jsonb_build_object(
          'image', 'gallery03',
          'caption', 'La manada también te espera.'
        )
      )
    ),
    'interludes', jsonb_build_array(
      jsonb_build_object(
        'image', 'gallery01',
        'afterSection', 'quote',
        'height', 'medium',
        'alt', 'Antes de conocerte, ya eras nuestro sueño más bonito.'
      )
    ),
    -- NOTE (location): venue name, address, and map URL below are unverified.
    -- Requires final human validation before client delivery.
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
      'subcopy', 'Confirma tu asistencia para compartir este día tan especial con nosotros.',
      'guestCap', 100,
      'accessMode', 'personalized-only',
      'confirmationMessage', 'Gracias por confirmar. Mis papis y yo nos ponemos muy felices de saber que nos acompañarán.',
      'confirmationMode', 'api'
    ),
    'thankYou', jsonb_build_object(
      'image', 'gallery02',
      'message', 'Gracias por acompañarnos en este momento tan especial. Este ultrasonido y cada muestra de cariño serán parte de mis primeros recuerdos.',
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
      'ogImage', 'hero',
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

  if (select status from public.invitations where id = v_invitation_id) <> 'published' then
    update public.invitations
    set status = 'published'
    where id = v_invitation_id;
  end if;
end;
$$;

commit;
