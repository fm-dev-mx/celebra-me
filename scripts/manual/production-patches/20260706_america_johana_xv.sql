-- ============================================================================
-- Continuation-safe patch: América Johana — XV invitation
--
-- Sets up the full invitation data pipeline with state-aware logic:
--   1. invitations  — explicit UPDATE or INSERT (no ON CONFLICT)
--   2. published_invitation_content  — explicit UPDATE (active), resurrect
--      (soft-deleted), or INSERT
--   3. events  — explicit UPDATE (active), resurrect (soft-deleted), or INSERT
--   4. event_memberships  — explicit abort on conflicting owner, INSERT if missing
--
-- Runs safely when 0 or 1 row exists per table key.
-- Does NOT use ON CONFLICT — all decisions are made by explicit SELECT-and-branch.
-- Version is bumped on each published content update to signal a patch was
-- applied, so this patch is NOT strictly idempotent. Re-runs intentionally
-- increment version on published_invitation_content for cache invalidation.
--
-- REQUIRED before execution:
--   1. Replace the __OWNER_USER_ID__ placeholder in the set_config block
--      with the actual admin UUID from auth.users.
--   2. Review the content and asset requirements in
--      docs/invitations/america-johana-asset-report.md
--   3. Take and verify a production DB backup
--   4. Validate on local/staging environment first
--   5. Obtain explicit operator approval before execution
-- ============================================================================

-- @script-id: 20260706_america_johana_xv
-- @purpose: Create or update América Johana's XV invitation and linked RSVP records from the approved DB payload
-- @env: production
-- @ticket: docs/invitations/america-johana-asset-report.md
-- @tables: public.invitations, public.published_invitation_content, public.events, public.event_memberships
-- @operation: update
-- @expected-rows-min: 0
-- @expected-rows-max: 4
-- @requires-backup: true
-- @dry-run-query: SELECT id, kind, slug, event_type, status, base_demo_id, theme_id, archived_at FROM public.invitations WHERE slug = 'america-johana' AND event_type = 'xv'; SELECT id, slug, event_type, version, published_at, deleted_at FROM public.published_invitation_content WHERE slug = 'america-johana' AND event_type = 'xv'; SELECT id, slug, event_type, status, invitation_project_id, deleted_at FROM public.events WHERE slug = 'america-johana'; SELECT m.id, m.event_id, m.user_id, m.membership_role, m.deleted_at FROM public.event_memberships m JOIN public.events e ON e.id = m.event_id WHERE e.slug = 'america-johana';
-- @rollback: See rollback section at bottom. Restore from verified production backup or run the targeted delete sequence only after confirming that all América Johana rows must be removed.
-- NOTE: The content payload below is the repository source used by
--       tests/content/xv-america-johana.test.ts.
--
-- MUSIC PRESERVATION:
--   If published_invitation_content already has content.music, this patch
--   preserves that existing music config instead of overwriting/removing it.
--   The payload below ships with the Coldplay Viva la Vida MP3 URL on
--   Cloudinary as the default music track.

BEGIN;

-- ============================================================================
-- 0. OWNER CONFIG
-- ============================================================================
SELECT set_config(
  'app.owner_user_id',
  '__OWNER_USER_ID__',
  true
);

-- ============================================================================
-- 1. PREFLIGHT — fail on ambiguous state or missing owner
-- ============================================================================
DO $$
DECLARE
  v_invitation_count integer;
  v_pub_count integer;
  v_event_count integer;
  v_owner_exists integer;
  v_owner_id uuid;
  v_owner_setting text;
  v_event_id uuid;
  v_membership_count integer;
BEGIN
  v_owner_setting := current_setting('app.owner_user_id', true);

  IF v_owner_setting IS NULL
    OR v_owner_setting = ''
    OR v_owner_setting = '__OWNER_USER_ID__'
  THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Replace __OWNER_USER_ID__ with the actual admin UUID before running this patch.';
  END IF;

  BEGIN
    v_owner_id := v_owner_setting::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: app.owner_user_id value "%" is not a valid UUID.',
      v_owner_setting;
  END;

  SELECT count(*) INTO v_invitation_count
  FROM public.invitations
  WHERE slug = 'america-johana'
    AND event_type = 'xv';

  IF v_invitation_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % invitations row(s) for slug america-johana event_type xv. Expected 0 or 1.',
      v_invitation_count;
  END IF;

  SELECT count(*) INTO v_pub_count
  FROM public.published_invitation_content
  WHERE slug = 'america-johana'
    AND event_type = 'xv';

  IF v_pub_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % published_invitation_content row(s) for slug america-johana event_type xv. Expected 0 or 1.',
      v_pub_count;
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.events
  WHERE slug = 'america-johana';

  IF v_event_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % events row(s) for slug america-johana. Expected 0 or 1.',
      v_event_count;
  END IF;

  SELECT count(*) INTO v_owner_exists
  FROM auth.users
  WHERE id = v_owner_id;

  IF v_owner_exists = 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Owner user ID % not found in auth.users. Verify the value passed to set_config(''app.owner_user_id'').',
      v_owner_id;
  END IF;

  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.slug = 'america-johana'
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    SELECT count(*) INTO v_membership_count
    FROM public.event_memberships
    WHERE event_id = v_event_id
      AND membership_role = 'owner'
      AND deleted_at IS NULL
      AND user_id <> v_owner_id;

    IF v_membership_count > 0 THEN
      RAISE EXCEPTION
        'PREFLIGHT_ABORT: Found % active owner membership(s) on event % for user(s) other than configured owner %. Resolve ownership manually before running this patch.',
        v_membership_count, v_event_id, v_owner_id;
    END IF;
  END IF;

  RAISE NOTICE
    'Preflight OK: invitations=%, pub_content=%, events=%. Owner % resolved.',
    v_invitation_count, v_pub_count, v_event_count, v_owner_id;
END $$;

-- ============================================================================
-- 2. UPSERT INVITATION
-- ============================================================================
DO $$
DECLARE
  v_invitation_id uuid;
  v_owner_id uuid;
  v_archived_at timestamptz;
BEGIN
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  SELECT id, archived_at INTO v_invitation_id, v_archived_at
  FROM public.invitations
  WHERE slug = 'america-johana'
    AND event_type = 'xv'
  LIMIT 1;

  IF v_invitation_id IS NULL THEN
    INSERT INTO public.invitations (
      kind,
      source_invitation_id,
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
      created_by,
      archived_at,
      created_at,
      updated_at
    ) VALUES (
      'client',
      NULL,
      'america-johana',
      'XV América Johana',
      'xv',
      'published',
      'demo-xv-celestial-blue',
      'celestial-blue',
      '{
        "id": "demo-xv-celestial-blue",
        "eventType": "xv",
        "displayName": "XV Años • América Johana",
        "themeId": "celestial-blue",
        "defaultSections": ["quote", "family", "gallery", "countdown", "location", "itinerary", "rsvp", "gifts", "thankYou"],
        "supportedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "recommendedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "requiredAssets": ["hero", "portrait", "family", "gallery01", "gallery02", "gallery03"],
        "previewSlug": "demo-xv-celestial-blue"
      }'::jsonb,
      'Paulina Soto / América Johana',
      '',
      '',
      true,
      v_owner_id,
      NULL,
      now(),
      now()
    )
    RETURNING id INTO v_invitation_id;

    RAISE NOTICE 'INSERTED invitations: id=% slug=america-johana', v_invitation_id;
  ELSE
    UPDATE public.invitations
    SET
      kind = 'client',
      slug = 'america-johana',
      title = 'XV América Johana',
      event_type = 'xv',
      status = 'published',
      base_demo_id = 'demo-xv-celestial-blue',
      theme_id = 'celestial-blue',
      snapshot = '{
        "id": "demo-xv-celestial-blue",
        "eventType": "xv",
        "displayName": "XV Años • América Johana",
        "themeId": "celestial-blue",
        "defaultSections": ["quote", "family", "gallery", "countdown", "location", "itinerary", "rsvp", "gifts", "thankYou"],
        "supportedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "recommendedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "requiredAssets": ["hero", "portrait", "family", "gallery01", "gallery02", "gallery03"],
        "previewSlug": "demo-xv-celestial-blue"
      }'::jsonb,
      client_name = 'Paulina Soto / América Johana',
      client_email = '',
      client_whatsapp = '',
      photos_received = true,
      created_by = COALESCE(created_by, v_owner_id),
      archived_at = NULL,
      updated_at = now()
    WHERE id = v_invitation_id;

    IF v_archived_at IS NULL THEN
      RAISE NOTICE 'UPDATED invitations: id=% slug=america-johana', v_invitation_id;
    ELSE
      RAISE NOTICE 'RESURRECTED invitations: id=% slug=america-johana', v_invitation_id;
    END IF;
  END IF;

  PERFORM set_config('app.invitation_id', v_invitation_id::text, true);
END $$;

-- ============================================================================
-- 3. UPSERT PUBLISHED INVITATION CONTENT
-- ============================================================================
DO $$
DECLARE
  v_pub_id uuid;
  v_pub_deleted_at timestamptz;
  v_invitation_id uuid;
  v_new_content jsonb;
  v_existing_music jsonb;
  v_has_existing_music boolean := false;
BEGIN
  v_invitation_id := current_setting('app.invitation_id')::uuid;

  SELECT id, deleted_at INTO v_pub_id, v_pub_deleted_at
  FROM public.published_invitation_content
  WHERE slug = 'america-johana'
    AND event_type = 'xv'
  LIMIT 1;

  v_new_content := '{
    "eventType": "xv",
    "isDemo": false,
    "templateId": "xv-celestial-blue",
    "visualProfileId": "america-johana",
    "title": "XV América Johana",
    "description": "XV años de América Johana, con fotografía natural, vestido rojo, marfil cálido, verde profundo y acentos champagne.",
    "_assetSlug": "xv-america-johana",
    "theme": {
      "fontFamily": "serif",
      "preset": "celestial-blue"
    },
    "eventTiming": {
      "localDateTime": "2026-08-29T17:30",
      "timeZone": "America/Mexico_City",
      "startsAtUtc": "2026-08-29T23:30:00.000Z"
    },
    "sectionStyles": {
      "location": {
        "showFlourishes": true
      },
      "rsvp": {}
    },
    "hero": {
      "name": "América",
      "label": "AMÉRICA · XV AÑOS",
      "date": "2026-08-29T23:30:00.000Z",
      "backgroundImage": "hero",
      "backgroundImageDesktop": "heroDesktop",
      "backgroundImageMobile": "hero",
      "portrait": "portrait",
      "focalPoint": "52% 45%",
      "focalPointMobile": "52% 38%",
      "focalPointDesktop": "52% 42%"
    },
    "quote": {
      "text": "Hay días que se guardan para siempre. Este será uno de ellos.",
      "author": "América Johana"
    },
    "family": {
      "featuredImage": "family",
      "presentation": "with-photo",
      "labels": {
        "sectionTitle": "Con todo mi amor",
        "sectionSubtitle": "Mi familia",
        "parentsTitle": "Con todo mi amor",
        "godparentsTitle": "Acompañada por sus padrinos",
        "sectionMessage": "Con el corazón lleno de gratitud, comparto esta noche con mi familia y con quienes han acompañado mi historia."
      },
      "groups": [
        {
          "title": "Con todo mi amor",
          "items": [
            {
              "name": "Gloria Paulina Soto Pérez",
              "role": "Mamá"
            },
            {
              "name": "Luz María Pérez Cardoso",
              "role": "Abuelita"
            }
          ]
        }
      ],
      "godparents": [
        {
          "name": "Mónica Mayela Alcantar Molinar",
          "role": "Madrina"
        },
        {
          "name": "Rafael Luque Altamirano",
          "role": "Padrino"
        }
      ],
      "focalPoint": "50% 36%"
    },
    "countdown": {
      "title": "La celebración comienza en",
      "footerText": "Ciudad de México"
    },
    "itinerary": {
      "title": "Programa",
      "items": [
        {
          "iconName": "Church",
          "label": "Ceremonia",
          "time": "17:30",
          "description": "Misa de acción de gracias en la Rectoría San Antonio de Padua."
        },
        {
          "iconName": "Reception",
          "label": "Recepción",
          "time": "20:00",
          "description": "Recepción y celebración en Gran Salón Del Prado."
        },
        {
          "iconName": "Waltz",
          "label": "Vals",
          "time": "21:00",
          "description": "Un momento especial para celebrar mis XV años."
        },
        {
          "iconName": "Party",
          "label": "Celebración",
          "time": "21:30",
          "description": "Baile y convivencia con familia y amigos."
        }
      ]
    },
    "location": {
      "introEyebrow": "Nos vemos en Ciudad de México",
      "introHeading": "Sábado, 29 de agosto de 2026",
      "introLede": "Será una alegría compartir contigo esta celebración.",
      "indicationsHeading": "Detalles para mis invitados",
      "ceremony": {
        "venueEvent": "Ceremonia",
        "venueName": "Rectoría San Antonio de Padua",
        "address": "Av. División del Nte. 3430, Xotepingo, Coyoacán",
        "city": "Ciudad de México",
        "date": "29 de agosto de 2026",
        "time": "5:30 p.m.",
        "googleMapsUrl": "https://maps.app.goo.gl/ViMYiHRgQ5HLaqGe8",
        "coordinates": {
          "lat": 19.3278767,
          "lng": -99.1468354
        }
      },
      "reception": {
        "venueEvent": "Recepción",
        "venueName": "Gran Salón Del Prado",
        "address": "División del Norte 4515 Prados Coapa, 3a. Sección, Tlalpan",
        "city": "Ciudad de México",
        "date": "29 de agosto de 2026",
        "time": "8:00 p.m.",
        "googleMapsUrl": "https://maps.app.goo.gl/6xwP3zGbBPEsrTjn9",
        "coordinates": {
          "lat": 19.291035,
          "lng": -99.1314772
        }
      },
      "indications": [
        {
          "iconName": "DressCode",
          "styleVariant": "reserved",
          "text": "Código de vestimenta: <strong>formal</strong>. El color rojo está reservado para la quinceañera."
        },
        {
          "iconName": "CheckSeal",
          "styleVariant": "default",
          "text": "Acceso únicamente con pase. Aplica para adultos y niños."
        },
        {
          "iconName": "Calendar",
          "styleVariant": "default",
          "text": "Agradecemos confirmar tu asistencia antes del 1 de agosto de 2026."
        }
      ]
    },
    "gallery": {
      "eyebrow": "UNA HISTORIA CONTADA EN FOTOS.",
      "title": "MOMENTOS QUE SE QUEDAN PARA SIEMPRE.",
      "subtitle": "Junto a las personas que más quiero.",
      "items": [
        {
          "image": "gallery01",
          "caption": "La actitud de un espíritu joven.",
          "focalPoint": "50% 36%"
        },
        {
          "image": "gallery02",
          "caption": "Entre verde, rojo y luz.",
          "focalPoint": "50% 35%"
        },
        {
          "image": "gallery04",
          "caption": "Celebrar rodeada de amigas.",
          "focalPoint": "50% 42%"
        },
        {
          "image": "gallery05",
          "caption": "La alegría de compartir.",
          "focalPoint": "50% 44%"
        },
        {
          "image": "gallery06",
          "caption": "Con mi familia.",
          "focalPoint": "50% 36%"
        },
        {
          "image": "gallery07",
          "caption": "Un recuerdo con quienes me acompañan.",
          "focalPoint": "52% 48%"
        },
        {
          "image": "gallery08",
          "caption": "Cariño que se queda.",
          "focalPoint": "50% 42%"
        },
        {
          "image": "gallery09",
          "caption": "Amigos y familia en el jardín.",
          "focalPoint": "50% 48%"
        },
        {
          "image": "gallery10",
          "caption": "La emoción antes de la gran noche.",
          "focalPoint": "50% 46%"
        }
      ]
    },
    "gifts": {
      "title": "Mesa de regalos",
      "variant": "celestial-blue",
      "subtitle": "Tu presencia es mi mejor regalo. Si deseas tener un detalle conmigo, te comparto estas opciones.",
      "items": [
        {
          "type": "store",
          "title": "Mesa de regalos",
          "description": "Puedes consultar mis listas en Sears y Liverpool.",
          "links": [
            {
              "label": "Sears",
              "url": "https://www.sears.com.mx/Mesa-de-Regalos/237993/te-invito-a-mi-xv-anos-america"
            },
            {
              "label": "Liverpool",
              "url": "https://mesaderegalos.liverpool.com.mx/milistaderegalos/52006296"
            }
          ]
        },
        {
          "type": "cash",
          "title": "Lluvia de sobres",
          "text": "También contaremos con un espacio especial durante la recepción."
        }
      ]
    },
    "rsvp": {
      "title": "Confirma tu asistencia",
      "subcopy": "Este pase corresponde a tu grupo. Preséntalo al ingresar al evento. Tu confirmación nos ayuda a recibirte con mucho cariño.",
      "guestCap": 6,
      "accessMode": "hybrid",
      "confirmationMessage": "Gracias por confirmar. Me dará mucha alegría compartir esta noche contigo.",
      "confirmationMode": "api",
      "personalizedAccess": {
        "title": "Pase de acceso",
        "subtitle": "Este pase muestra los accesos asignados para ingresar al evento.",
        "footerText": "Acceso válido para adultos y niños. Preséntalo al llegar."
      }
    },
    "thankYou": {
      "message": "Gracias por acompañarme en mis XV años. Su presencia y cariño harán que esta noche sea un recuerdo para siempre.",
      "closingName": "América Johana",
      "image": "thankYouPortrait",
      "focalPoint": "50% 34%"
    },
    "interludes": [
      {
        "image": "interlude01",
        "afterSection": "location",
        "alt": "América con globos dorados en el jardín",
        "height": "screen",
        "focalPoint": "50% 42%",
        "lightX": "52%",
        "lightY": "34%"
      },
      {
        "image": "interlude02",
        "afterSection": "family",
        "alt": "América de espalda con vestido rojo y globos de XV",
        "height": "screen",
        "focalPoint": "50% 42%",
        "lightX": "48%",
        "lightY": "38%"
      },
      {
        "image": "interlude03",
        "afterSection": "itinerary",
        "alt": "América en el jardín",
        "height": "medium",
        "focalPoint": "50% 50%",
        "lightX": "50%",
        "lightY": "44%"
      },
      {
        "image": "interlude04",
        "afterSection": "rsvp",
        "alt": "América con vestido blanco y acentos color rojo",
        "height": "screen",
        "focalPoint": "50% 34%",
        "lightX": "46%",
        "lightY": "38%"
      }
    ],
    "envelope": {
      "disabled": false,
      "revealVariant": "celestial-blue",
      "coverEdition": "XV",
      "coverVolume": "1",
      "coverIssue": "2026",
      "sealStyle": "wax",
      "sealIcon": "flower",
      "sealInitials": "A·J",
      "sealVariant": "premium-rose",
      "microcopy": "Abrir invitación",
      "documentLabel": "XV AÑOS · 2026",
      "cardLabel": "XV AÑOS · 2026",
      "cardTagline": "Una noche para recordar",
      "stampText": "América Johana",
      "stampYear": "2026",
      "closedPalette": {
        "primary": "surfaceDark",
        "accent": "actionAccent",
        "background": "surfaceDark"
      }
    },
    "music": {
      "url": "https://res.cloudinary.com/dusxvauvj/video/upload/v1783457980/Coldplay_-_Viva_La_Vida_dqvlpj.mp3",
      "autoPlay": false,
      "title": "Viva la Vida — Coldplay",
      "revealMode": "envelope"
    },
    "sharing": {
      "whatsappTemplate": "Hola {name}, te comparto tu invitación a los XV América Johana\n\n{inviteUrl}\n\n Ábrela y confirma tu asistencia. ¡Será un gusto verte!",
      "ogImage": "portrait",
      "ogDescription": "XV años • América Johana"
    }
  }'::jsonb;

  IF v_pub_id IS NOT NULL THEN
    SELECT
      content ? 'music',
      content -> 'music'
    INTO
      v_has_existing_music,
      v_existing_music
    FROM public.published_invitation_content
    WHERE id = v_pub_id;

    IF v_has_existing_music THEN
      v_new_content := jsonb_set(v_new_content, '{music}', v_existing_music, true);
      RAISE NOTICE 'PRESERVED existing music config on published_invitation_content: id=%', v_pub_id;
    ELSE
      RAISE NOTICE 'No existing music config found on published_invitation_content: id=%', v_pub_id;
    END IF;
  END IF;

  IF v_pub_id IS NULL THEN
    INSERT INTO public.published_invitation_content (
      invitation_project_id,
      slug,
      event_type,
      is_demo,
      content,
      version,
      published_at,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      v_invitation_id,
      'america-johana',
      'xv',
      false,
      v_new_content,
      1,
      now(),
      now(),
      now(),
      NULL
    );

    RAISE NOTICE 'INSERTED published_invitation_content: slug=america-johana event_type=xv';
  ELSIF v_pub_deleted_at IS NULL THEN
    UPDATE public.published_invitation_content
    SET
      invitation_project_id = v_invitation_id,
      event_type = 'xv',
      is_demo = false,
      content = v_new_content,
      version = version + 1,
      published_at = COALESCE(published_at, now()),
      updated_at = now()
    WHERE id = v_pub_id;

    RAISE NOTICE 'UPDATED published_invitation_content: id=% version incremented', v_pub_id;
  ELSE
    UPDATE public.published_invitation_content
    SET
      invitation_project_id = v_invitation_id,
      event_type = 'xv',
      is_demo = false,
      content = v_new_content,
      version = version + 1,
      published_at = COALESCE(published_at, now()),
      updated_at = now(),
      deleted_at = NULL
    WHERE id = v_pub_id;

    RAISE NOTICE 'RESURRECTED published_invitation_content: id=% (was soft-deleted at %)', v_pub_id, v_pub_deleted_at;
  END IF;
END $$;

-- ============================================================================
-- 4. UPSERT RSVP EVENT
-- ============================================================================
DO $$
DECLARE
  v_event_id uuid;
  v_event_deleted_at timestamptz;
  v_invitation_id uuid;
  v_owner_id uuid;
BEGIN
  v_invitation_id := current_setting('app.invitation_id')::uuid;
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  SELECT id, deleted_at INTO v_event_id, v_event_deleted_at
  FROM public.events
  WHERE slug = 'america-johana'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    INSERT INTO public.events (
      owner_user_id,
      slug,
      event_type,
      title,
      status,
      published_at,
      created_at,
      updated_at,
      deleted_at,
      invitation_project_id
    ) VALUES (
      v_owner_id,
      'america-johana',
      'xv',
      'XV América Johana',
      'published',
      now(),
      now(),
      now(),
      NULL,
      v_invitation_id
    )
    RETURNING id INTO v_event_id;

    RAISE NOTICE 'INSERTED events: id=% slug=america-johana', v_event_id;
  ELSIF v_event_deleted_at IS NULL THEN
    UPDATE public.events
    SET
      owner_user_id = v_owner_id,
      event_type = 'xv',
      title = 'XV América Johana',
      status = 'published',
      invitation_project_id = v_invitation_id,
      published_at = COALESCE(published_at, now()),
      updated_at = now()
    WHERE id = v_event_id;

    RAISE NOTICE 'UPDATED events: id=% slug=america-johana', v_event_id;
  ELSE
    UPDATE public.events
    SET
      owner_user_id = v_owner_id,
      event_type = 'xv',
      title = 'XV América Johana',
      status = 'published',
      invitation_project_id = v_invitation_id,
      published_at = COALESCE(published_at, now()),
      updated_at = now(),
      deleted_at = NULL
    WHERE id = v_event_id;

    RAISE NOTICE 'RESURRECTED events: id=% (was soft-deleted at %)', v_event_id, v_event_deleted_at;
  END IF;

  PERFORM set_config('app.event_id', v_event_id::text, true);
END $$;

-- ============================================================================
-- 5. UPSERT OWNER MEMBERSHIP
-- ============================================================================
DO $$
DECLARE
  v_membership_id uuid;
  v_membership_deleted_at timestamptz;
  v_event_id uuid;
  v_owner_id uuid;
BEGIN
  v_event_id := current_setting('app.event_id')::uuid;
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  SELECT id, deleted_at INTO v_membership_id, v_membership_deleted_at
  FROM public.event_memberships
  WHERE event_id = v_event_id
    AND user_id = v_owner_id
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    INSERT INTO public.event_memberships (
      event_id,
      user_id,
      membership_role,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      v_event_id,
      v_owner_id,
      'owner',
      now(),
      now(),
      NULL
    );

    RAISE NOTICE 'INSERTED event_membership: event_id=% user_id=% role=owner', v_event_id, v_owner_id;
  ELSIF v_membership_deleted_at IS NULL THEN
    RAISE NOTICE 'PRESERVED existing event_membership: id=% event_id=% user_id=% role=owner', v_membership_id, v_event_id, v_owner_id;
  ELSE
    UPDATE public.event_memberships
    SET
      membership_role = 'owner',
      deleted_at = NULL,
      updated_at = now()
    WHERE id = v_membership_id;

    RAISE NOTICE 'RESURRECTED event_membership: id=% event_id=% user_id=% (was soft-deleted at %)',
      v_membership_id, v_event_id, v_owner_id, v_membership_deleted_at;
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

SELECT
  id::text,
  kind,
  slug,
  title,
  event_type,
  status,
  base_demo_id,
  theme_id,
  snapshot ->> 'id' AS snapshot_id,
  snapshot ->> 'previewSlug' AS snapshot_preview_slug,
  client_name,
  photos_received,
  created_by::text,
  archived_at,
  created_at,
  updated_at
FROM public.invitations
WHERE slug = 'america-johana'
  AND event_type = 'xv';

SELECT
  pc.id::text AS published_content_id,
  pc.slug,
  pc.event_type,
  pc.is_demo,
  pc.content ->> '_assetSlug' AS asset_slug,
  pc.content ->> 'templateId' AS template_id,
  pc.content -> 'rsvp' ->> 'confirmationMode' AS rsvp_confirmation_mode,
  pc.content -> 'rsvp' ->> 'accessMode' AS rsvp_access_mode,
  pc.content ? 'music' AS has_music,
  pc.content -> 'music' ->> 'src' AS music_src,
  pc.content -> 'hero' ->> 'name' AS hero_name,
  pc.content -> 'hero' ->> 'label' AS hero_label,
  pc.content -> 'envelope' ->> 'documentLabel' AS envelope_document_label,
  pc.content -> 'envelope' ->> 'cardLabel' AS envelope_card_label,
  pc.content -> 'envelope' ->> 'cardTagline' AS envelope_card_tagline,
  pc.content -> 'gifts' ->> 'title' AS gifts_title,
  pc.version,
  pc.published_at,
  pc.updated_at,
  pc.deleted_at
FROM public.published_invitation_content pc
WHERE pc.slug = 'america-johana'
  AND pc.event_type = 'xv';

SELECT
  e.id::text AS event_id,
  e.owner_user_id::text,
  e.slug,
  e.event_type,
  e.title,
  e.status,
  e.invitation_project_id::text,
  e.published_at,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.events e
WHERE e.slug = 'america-johana';

SELECT
  m.id::text AS membership_id,
  m.event_id::text,
  m.user_id::text,
  m.membership_role,
  m.created_at,
  m.updated_at,
  m.deleted_at
FROM public.event_memberships m
JOIN public.events e ON e.id = m.event_id
WHERE e.slug = 'america-johana';

SELECT
  (SELECT count(*) FROM public.invitations WHERE slug = 'america-johana' AND event_type = 'xv' AND archived_at IS NULL) AS invitations,
  (SELECT count(*) FROM public.published_invitation_content WHERE slug = 'america-johana' AND event_type = 'xv' AND deleted_at IS NULL) AS published_content,
  (SELECT count(*) FROM public.events WHERE slug = 'america-johana' AND deleted_at IS NULL) AS events,
  (SELECT count(*) FROM public.event_memberships m JOIN public.events e ON e.id = m.event_id WHERE e.slug = 'america-johana' AND m.deleted_at IS NULL) AS memberships;

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- WARNING: This rollback DESTROYS all América Johana invitation setup data
-- created or repaired by this patch. If guests, claim codes, or other
-- operational records were added after publish, they must be reviewed before
-- deletion.
--
-- Uncomment and run only after explicit verification and backup:
--
-- BEGIN;
--
-- DELETE FROM public.event_memberships
-- WHERE event_id IN (
--   SELECT id FROM public.events
--   WHERE slug = 'america-johana'
-- );
--
-- DELETE FROM public.events
-- WHERE slug = 'america-johana';
--
-- DELETE FROM public.published_invitation_content
-- WHERE slug = 'america-johana'
--   AND event_type = 'xv';
--
-- DELETE FROM public.invitations
-- WHERE slug = 'america-johana'
--   AND event_type = 'xv';
--
-- COMMIT;
-- ============================================================================
