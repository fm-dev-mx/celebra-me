-- ============================================================================
-- Continuation-safe patch: Valentina Hernández — XV Invitation
--
-- Sets up the full invitation data pipeline with state-aware logic:
--   1. invitation_projects  — explicit UPDATE or INSERT (no ON CONFLICT)
--   2. published_invitation_content  — explicit UPDATE (active), resurrect (soft-deleted), or INSERT
--   3. events  — explicit UPDATE (active), resurrect (soft-deleted), or INSERT
--   4. event_memberships  — explicit abort on conflicting owner, INSERT if missing
--
-- Runs safely when 0 or 1 active rows already exist per table.
-- Does NOT use ON CONFLICT — all decisions are made by explicit SELECT-and-branch.
-- Version is bumped on each update to signal a patch was applied, so this patch
-- is NOT strictly idempotent. Re-runs intentionally increment version on
-- published_invitation_content for cache invalidation.
--
-- REQUIRED before execution:
--   1. Replace the __OWNER_USER_ID__ placeholder in the set_config block
--      with the actual admin UUID from auth.users (run: SELECT id FROM auth.users LIMIT 1)
--   2. Verify the content payload below matches
--      .agent/plans/active/xv-valentina-hernandez-db-payload.json
--   3. Take and verify a production DB backup
--   4. Validate on local/staging environment first
--   5. Obtain explicit Paco approval
--
-- Preflight checks (state-aware):
--   - At most 1 active invitation_projects row with slug 'valentina-hernandez'
--   - At most 1 active published_invitation_content row with slug 'valentina-hernandez'
--   - At most 1 active events row with slug 'valentina-hernandez'
--   - No conflicting owner membership on the event (if an event exists)
--   - Owner UUID resolves to an active auth.users row
--   - NOT an error if exactly 1 row already exists (continuation case)
-- ============================================================================

-- @script-id: 20260626_valentina_hernandez_xv
-- @purpose: Create or update Valentina Hernández Almaguer's XV invitation — continuation-safe, constraint-independent
-- @env: production
-- @ticket: spec audit at .agent/plans/active/valentina-editorial-magazine-real-invitation.spec.md
-- @tables: invitation_projects, published_invitation_content, events, event_memberships
-- @operation: insert, update
-- @expected-rows-min: 0
-- @expected-rows-max: 4
-- @requires-backup: true
-- @dry-run-query:
--   SELECT id, slug, title, status, theme_id, deleted_at
--   FROM public.invitation_projects
--   WHERE slug = 'valentina-hernandez';
--   SELECT id, slug, event_type, version, published_at, deleted_at
--   FROM public.published_invitation_content
--   WHERE slug = 'valentina-hernandez';
--   SELECT id, slug, event_type, status, invitation_project_id, deleted_at
--   FROM public.events
--   WHERE slug = 'valentina-hernandez';
--   SELECT m.id, m.event_id, m.user_id, m.membership_role, m.deleted_at
--   FROM public.event_memberships m
--   JOIN public.events e ON e.id = m.event_id
--   WHERE e.slug = 'valentina-hernandez';
-- @rollback: See rollback section at bottom
-- NOTE: The content payload below is DUPLICATED from
--       .agent/plans/active/xv-valentina-hernandez-db-payload.json.
--       Keep both in sync when either is updated.

BEGIN;

-- ============================================================================
-- 0. OWNER CONFIG
-- ============================================================================
-- Set the owner user ID once so every downstream reference resolves through
-- current_setting. Change the placeholder below to the real admin UUID.
SELECT set_config(
  'app.owner_user_id',
  '__OWNER_USER_ID__',
  true
);

-- ============================================================================
-- 1. PREFLIGHT — state-aware validation
--    Does NOT abort if exactly 1 row exists (that is the continuation case).
--    Aborts only on:
--      - ambiguous state: >1 active rows per table
--      - conflicting owner membership on a pre-existing event
--      - unresolved owner UUID
-- ============================================================================
DO $$
DECLARE
  v_project_count integer;
  v_pub_count integer;
  v_event_count integer;
  v_owner_exists integer;
  v_owner_id uuid;
  v_event_id uuid;
  v_membership_user_id uuid;
  v_membership_count integer;
BEGIN
  -- invitation_projects: allow 0 or 1. Abort on ambiguity (>1).
  SELECT count(*) INTO v_project_count
  FROM public.invitation_projects
  WHERE slug = 'valentina-hernandez'
    AND deleted_at IS NULL;

  IF v_project_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % active invitation_projects row(s) for slug valentina-hernandez. Expected 0 or 1.',
      v_project_count;
  END IF;

  -- published_invitation_content: allow 0 or 1. Abort on ambiguity (>1).
  SELECT count(*) INTO v_pub_count
  FROM public.published_invitation_content
  WHERE slug = 'valentina-hernandez'
    AND deleted_at IS NULL;

  IF v_pub_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % active published_invitation_content row(s) for slug valentina-hernandez. Expected 0 or 1.',
      v_pub_count;
  END IF;

  -- events: allow 0 or 1. Abort on ambiguity (>1).
  SELECT count(*) INTO v_event_count
  FROM public.events
  WHERE slug = 'valentina-hernandez'
    AND deleted_at IS NULL;

  IF v_event_count > 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Found % active events row(s) for slug valentina-hernandez. Expected 0 or 1.',
      v_event_count;
  END IF;

  -- Resolve and verify owner
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  SELECT count(*) INTO v_owner_exists
  FROM auth.users
  WHERE id = v_owner_id;

  IF v_owner_exists = 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Owner user ID % not found in auth.users. Verify the value passed to set_config(''app.owner_user_id'').',
      v_owner_id;
  END IF;

  -- Check for conflicting owner membership if the event already exists
  -- Abort if any active owner membership on this event points to a different user.
  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.slug = 'valentina-hernandez'
    AND e.deleted_at IS NULL
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
        'PREFLIGHT_ABORT: Found % active owner membership(s) on event % for user(s) other than the configured owner %. Conflicting ownership detected — manual resolution required.',
        v_membership_count, v_event_id, v_owner_id;
    END IF;
  END IF;

  RAISE NOTICE
    'Preflight OK: projects=%, pub_content=%, events=%. Owner % resolved.',
    v_project_count, v_pub_count, v_event_count, v_owner_id;
END $$;

-- ============================================================================
-- 2. UPSERT INVITATION PROJECT
--    If an active row exists for slug valentina-hernandez: UPDATE intended fields.
--    If none exists (or only archived): INSERT a new row.
--    created_by is preserved if already set (COALESCE).
-- ============================================================================
DO $$
DECLARE
  v_project_id uuid;
  v_owner_id uuid;
  v_archived_at timestamptz;
BEGIN
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  -- The underlying table is public.invitations; the invitation_projects view
  -- maps archived_at to deleted_at. We work through the view for consistency.
  SELECT id, deleted_at INTO v_project_id, v_archived_at
  FROM public.invitation_projects
  WHERE slug = 'valentina-hernandez'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    -- Insert new project
    INSERT INTO public.invitation_projects (
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
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      'valentina-hernandez',
      'XV Años — Valentina Hernández Almaguer',
      'xv',
      'published',
      'demo-xv-editorial-magazine',
      'editorial-magazine',
      '{
        "id": "demo-xv-editorial-magazine",
        "eventType": "xv",
        "displayName": "XV Años — Revista Editorial",
        "themeId": "editorial-magazine",
        "defaultSections": ["quote", "family", "gallery", "countdown", "location", "itinerary", "rsvp", "gifts", "thankYou"],
        "supportedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "recommendedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "requiredAssets": ["hero", "portrait", "gallery01", "gallery02", "gallery03"],
        "previewSlug": "demo-xv-editorial-magazine"
      }'::jsonb,
      'Valentina Hernández Almaguer',
      '',
      '',
      false,
      v_owner_id,
      now(),
      now(),
      NULL
    )
    RETURNING id INTO v_project_id;

    RAISE NOTICE 'INSERTED invitation_projects: id=% slug=valentina-hernandez', v_project_id;
  ELSE
    -- Row exists (active or archived). Update fields in-place.
    -- If the row was archived (deleted_at IS NOT NULL), this un-archives it
    -- by clearing deleted_at.
    UPDATE public.invitation_projects
    SET
      title = 'XV Años — Valentina Hernández Almaguer',
      event_type = 'xv',
      status = 'published',
      base_demo_id = 'demo-xv-editorial-magazine',
      theme_id = 'editorial-magazine',
      snapshot = '{
        "id": "demo-xv-editorial-magazine",
        "eventType": "xv",
        "displayName": "XV Años — Revista Editorial",
        "themeId": "editorial-magazine",
        "defaultSections": ["quote", "family", "gallery", "countdown", "location", "itinerary", "rsvp", "gifts", "thankYou"],
        "supportedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "recommendedBlocks": ["event-details", "main-people", "date-locations", "photos", "rsvp-config", "music", "gifts", "special-messages"],
        "requiredAssets": ["hero", "portrait", "gallery01", "gallery02", "gallery03"],
        "previewSlug": "demo-xv-editorial-magazine"
      }'::jsonb,
      client_name = 'Valentina Hernández Almaguer',
      client_email = '',
      client_whatsapp = '',
      photos_received = false,
      created_by = COALESCE(created_by, v_owner_id),
      updated_at = now(),
      deleted_at = NULL
    WHERE id = v_project_id;

    IF v_archived_at IS NULL THEN
      RAISE NOTICE 'UPDATED invitation_projects: id=% slug=valentina-hernandez', v_project_id;
    ELSE
      RAISE NOTICE 'RESURRECTED (un-archived) invitation_projects: id=% slug=valentina-hernandez', v_project_id;
    END IF;
  END IF;

  -- Store project_id via set_config so downstream statements can reference it
  PERFORM set_config('app.invitation_project_id', v_project_id::text, true);
END $$;

-- ============================================================================
-- 3. UPSERT PUBLISHED INVITATION CONTENT
--    Explicit state-aware logic (no ON CONFLICT):
--      1. If an active row exists (deleted_at IS NULL): UPDATE it.
--      2. If a soft-deleted row exists (deleted_at IS NOT NULL): resurrect it.
--      3. If no row exists at all: INSERT.
--    On every update, version is incremented to signal that a patch was applied
--    (cache invalidation downstream).
--    published_at is preserved if already set (COALESCE).
-- ============================================================================
DO $$
DECLARE
  v_pub_id uuid;
  v_pub_deleted_at timestamptz;
  v_project_id uuid;
  v_new_content jsonb;
BEGIN
  v_project_id := current_setting('app.invitation_project_id')::uuid;

  -- Check if ANY row exists for this content key (active or soft-deleted)
  SELECT id, deleted_at INTO v_pub_id, v_pub_deleted_at
  FROM public.published_invitation_content
  WHERE slug = 'valentina-hernandez'
    AND event_type = 'xv'
  LIMIT 1;

  v_new_content := '{
    "eventType": "xv",
    "isDemo": false,
    "title": "XV Años — Valentina Hernández Almaguer",
    "description": "Invitación editorial para los XV años de Valentina Hernández Almaguer, con una estética inspirada en revista de moda en tonos rosa, blanco y plata.",
    "_assetSlug": "xv-valentina-hernandez",
    "theme": {
        "fontFamily": "serif",
        "preset": "editorial-magazine"
    },
    "eventTiming": {
        "localDateTime": "2026-08-29T15:45",
        "timeZone": "America/Mexico_City",
        "startsAtUtc": "2026-08-29T21:45:00.000Z"
    },
    "sectionOrder": [
        "quote",
        "family",
        "countdown",
        "itinerary",
        "location",
        "gallery",
        "gifts",
        "personalizedAccess",
        "rsvp",
        "thankYou"
    ],
    "sectionStyles": {
        "hero": {
            "variant": "editorial-magazine"
        },
        "quote": {
            "variant": "editorial-magazine"
        },
        "countdown": {
            "variant": "editorial-magazine"
        },
        "family": {
            "variant": "editorial-magazine"
        },
        "location": {
            "variant": "editorial-magazine",
            "showFlourishes": false
        },
        "gallery": {
            "variant": "editorial-magazine"
        },
        "gifts": {
            "variant": "editorial-magazine"
        },
        "rsvp": {
            "variant": "editorial-magazine",
            "labels": {
                "name": "Tu nombre",
                "guestCount": "Personas que asistirán",
                "attendance": "¿Me acompañas?",
                "confirmButton": "Confirmar asistencia"
            }
        },
        "thankYou": {
            "variant": "editorial-magazine"
        }
    },
    "hero": {
        "name": "Valentina Hernández Almaguer",
        "label": "XV Edition",
        "date": "2026-08-29T21:45:00.000Z",
        "backgroundImage": "hero",
        "portrait": "portrait",
        "variant": "editorial-magazine",
        "focalPoint": "50% 38%",
        "focalPointMobile": "50% 32%"
    },
    "quote": {
        "text": "Dicen que la moda es temporal, pero los recuerdos son eternos. Acompáñame a escribir el primer capítulo de mi nueva historia...",
        "author": "Valentina Hernández Almaguer"
    },
    "family": {
        "featuredImage": "family",
        "labels": {
            "sectionTitle": "Mi familia",
            "sectionSubtitle": "Con amor y gratitud",
            "godparentsTitle": "Padrinos",
            "sectionMessage": "Con la bendición de mi familia y el cariño de quienes han acompañado mi historia, celebro este día con el corazón lleno de gratitud."
        },
        "godparents": [
            {
                "name": "César A. Pérez Monroy",
                "role": "Padrino"
            }
        ],
        "focalPoint": "50% 38%"
    },
    "countdown": {
        "title": "La celebración comienza en",
        "footerText": "29 de agosto de 2026, Texcoco, Estado de México"
    },
    "itinerary": {
        "title": "Programa",
        "items": [
            {
                "iconName": "Church",
                "label": "Ceremonia religiosa",
                "time": "15:45",
                "description": "Inicio de la celebración con una ceremonia llena de gratitud."
            },
            {
                "iconName": "Reception",
                "label": "Recepción",
                "time": "16:30",
                "description": "Recepción y celebración en Finca Las Palmas."
            }
        ]
    },
    "location": {
        "introEyebrow": "Te esperamos en Texcoco",
        "introHeading": "Sábado, 29 de agosto de 2026",
        "introLede": "Será una alegría compartir contigo esta celebración.",
        "indicationsHeading": "Detalles para mis invitados",
        "reception": {
            "venueEvent": "Recepción",
            "venueName": "Finca Las Palmas",
            "address": "4ta Cerrada de Palma s/n, San Luis Huexotla, Texcoco, México",
            "city": "Texcoco, Estado de México",
            "date": "29 de agosto de 2026",
            "time": "4:30 p.m."
        },
        "indications": [
            {
                "iconName": "DressCode",
                "styleVariant": "reserved",
                "text": "Código de vestimenta: <strong>formal</strong>. El color <strong>rosa y lila</strong> están reservados para la quinceañera."
            },
            {
                "iconName": "Calendar",
                "styleVariant": "default",
                "text": "Agradecemos confirmar asistencia con anticipación para preparar cada detalle con cariño."
            },
            {
                "iconName": "Enveloped",
                "styleVariant": "default",
                "text": "Agradecemos tu puntualidad para disfrutar juntos cada momento mágico de esta noche."
            }
        ]
    },
    "gallery": {
        "eyebrow": "Galería",
        "title": "Brillar es la actitud.",
        "subtitle": "Un recorrido visual por la magia de esta celebración única.",
        "items": [
            {
                "image": "gallery01"
            },
            {
                "image": "gallery02"
            },
            {
                "image": "gallery03"
            },
            {
                "image": "gallery04"
            },
            {
                "image": "gallery05"
            },
            {
                "image": "gallery06"
            },
            {
                "image": "gallery07"
            },
            {
                "image": "gallery08"
            }
        ]
    },
    "gifts": {
        "title": "Regalos",
        "subtitle": "Su presencia es mi mejor regalo. Si desean tener un detalle adicional, habrá un espacio especial para sobres el día del evento.",
        "items": [
            {
                "type": "cash",
                "title": "Lluvia de sobres",
                "text": "Gracias por acompañarme con tanto cariño en esta noche tan especial."
            }
        ]
    },
    "rsvp": {
        "title": "Confirma tu asistencia",
        "subcopy": "Confirma tu asistencia desde esta invitación. Me encantará saber que vienes.",
        "guestCap": 4,
        "accessMode": "hybrid",
        "confirmationMessage": "Gracias por confirmar. Me dará mucha alegría compartir esta noche contigo.",
        "confirmationMode": "api"
    },
    "thankYou": {
        "message": "Que la alegría de este día sea el inicio de un futuro lleno de luz, magia y momentos inolvidables.",
        "closingName": "Valentina Hernández Almaguer",
        "image": "thankYouPortrait",
        "focalPoint": "50% 36%"
    },
    "interludes": [
        {
            "image": "interlude01",
            "afterSection": "location",
            "alt": "Detalle editorial rosa plata con brillo",
            "height": "screen",
            "focalPoint": "50% 50%",
            "lightX": "48%",
            "lightY": "40%"
        },
        {
            "image": "interlude02",
            "afterSection": "family",
            "alt": "Marco decorativo rosa palo con acentos plateados",
            "height": "screen",
            "focalPoint": "50% 50%",
            "lightX": "55%",
            "lightY": "34%"
        },
        {
            "image": "interlude03",
            "afterSection": "itinerary",
            "alt": "Divisor decorativo con textura editorial",
            "height": "medium",
            "focalPoint": "50% 52%",
            "lightX": "50%",
            "lightY": "46%"
        },
        {
            "image": "interlude04",
            "afterSection": "rsvp",
            "alt": "Fondo decorativo rosa con destellos plateados",
            "height": "screen",
            "focalPoint": "50% 50%",
            "lightX": "46%",
            "lightY": "38%"
        }
    ],
    "envelope": {
        "disabled": false,
        "revealVariant": "editorial-cover",
        "coverEdition": "XV",
        "coverVolume": "1",
        "coverIssue": "2026",
        "sealStyle": "wax",
        "sealIcon": "flower",
        "sealInitials": "V·H",
        "sealVariant": "premium-rose",
        "microcopy": "Abrir edición XV",
        "documentLabel": "Edición XV",
        "cardLabel": "Edición XV",
        "cardTagline": "Brillar es la actitud",
        "stampText": "Valentina",
        "stampYear": "2026",
        "closedPalette": {
            "primary": "surfaceDark",
            "accent": "actionAccent",
            "background": "surfaceDark"
        }
    },
    "sharing": {
        "whatsappTemplate": "Hola {name}, te comparto con mucha ilusión la invitación a mis XV años: {inviteUrl}",
        "ogImage": "portrait",
        "ogDescription": "Acompáñame en mis XV años el sábado, 29 de agosto de 2026, en Texcoco, Estado de México."
    }
}'::jsonb;

  IF v_pub_id IS NULL THEN
    -- No row exists at all: INSERT
    INSERT INTO public.published_invitation_content (
      invitation_project_id, slug, event_type, is_demo, content, version,
      published_at, created_at, updated_at, deleted_at
    ) VALUES (
      v_project_id,
      'valentina-hernandez',
      'xv',
      false,
      v_new_content,
      1,
      now(),
      now(),
      now(),
      NULL
    );

    RAISE NOTICE 'INSERTED published_invitation_content: slug=valentina-hernandez event_type=xv';
  ELSIF v_pub_deleted_at IS NULL THEN
    -- Active row exists: UPDATE in place, bump version, preserve published_at
    UPDATE public.published_invitation_content
    SET
      invitation_project_id = v_project_id,
      event_type = 'xv',
      is_demo = false,
      content = v_new_content,
      version = version + 1,
      published_at = COALESCE(published_at, now()),
      updated_at = now()
    WHERE id = v_pub_id;

    RAISE NOTICE 'UPDATED published_invitation_content: id=% version incremented', v_pub_id;
  ELSE
    -- Soft-deleted row exists: resurrect (clear deleted_at), bump version, preserve published_at
    UPDATE public.published_invitation_content
    SET
      invitation_project_id = v_project_id,
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
--    Explicit state-aware logic (no ON CONFLICT):
--      1. If an active row exists (deleted_at IS NULL): UPDATE it.
--      2. If a soft-deleted row exists: resurrect it.
--      3. If no row exists at all: INSERT.
--    published_at is preserved if already set (COALESCE).
--    Stores event_id for the membership step.
-- ============================================================================
DO $$
DECLARE
  v_event_id uuid;
  v_event_deleted_at timestamptz;
  v_project_id uuid;
  v_owner_id uuid;
BEGIN
  v_project_id := current_setting('app.invitation_project_id')::uuid;
  v_owner_id := current_setting('app.owner_user_id')::uuid;

  -- Check if ANY row exists for this slug (active or soft-deleted)
  SELECT id, deleted_at INTO v_event_id, v_event_deleted_at
  FROM public.events
  WHERE slug = 'valentina-hernandez'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    -- No row exists at all: INSERT
    INSERT INTO public.events (
      owner_user_id, slug, event_type, title, status,
      published_at, created_at, updated_at, deleted_at, invitation_project_id
    ) VALUES (
      v_owner_id,
      'valentina-hernandez',
      'xv',
      'XV Años — Valentina Hernández Almaguer',
      'published',
      now(),
      now(),
      now(),
      NULL,
      v_project_id
    )
    RETURNING id INTO v_event_id;

    RAISE NOTICE 'INSERTED events: id=% slug=valentina-hernandez', v_event_id;
  ELSIF v_event_deleted_at IS NULL THEN
    -- Active row exists: UPDATE in place, preserve published_at
    UPDATE public.events
    SET
      owner_user_id = v_owner_id,
      event_type = 'xv',
      title = 'XV Años — Valentina Hernández Almaguer',
      status = 'published',
      invitation_project_id = v_project_id,
      published_at = COALESCE(published_at, now()),
      updated_at = now()
    WHERE id = v_event_id;

    RAISE NOTICE 'UPDATED events: id=% slug=valentina-hernandez', v_event_id;
  ELSE
    -- Soft-deleted row exists: resurrect (clear deleted_at), preserve published_at
    UPDATE public.events
    SET
      owner_user_id = v_owner_id,
      event_type = 'xv',
      title = 'XV Años — Valentina Hernández Almaguer',
      status = 'published',
      invitation_project_id = v_project_id,
      published_at = COALESCE(published_at, now()),
      updated_at = now(),
      deleted_at = NULL
    WHERE id = v_event_id;

    RAISE NOTICE 'RESURRECTED events: id=% (was soft-deleted at %)', v_event_id, v_event_deleted_at;
  END IF;

  -- Store event_id for the membership step
  PERFORM set_config('app.event_id', v_event_id::text, true);
END $$;

-- ============================================================================
-- 5. UPSERT OWNER MEMBERSHIP
--    Conflicting-owner check already passed in preflight (step 1).
--    If an active owner membership for this (event_id, user_id) exists: preserve.
--    If missing (or only soft-deleted): INSERT.
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

  -- Check if ANY membership row exists for this (event, user) pair
  SELECT id, deleted_at INTO v_membership_id, v_membership_deleted_at
  FROM public.event_memberships
  WHERE event_id = v_event_id
    AND user_id = v_owner_id
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    -- No row exists at all: INSERT
    INSERT INTO public.event_memberships (event_id, user_id, membership_role, created_at, updated_at, deleted_at)
    VALUES (v_event_id, v_owner_id, 'owner', now(), now(), NULL);

    RAISE NOTICE 'INSERTED event_membership: event_id=% user_id=% role=owner', v_event_id, v_owner_id;
  ELSIF v_membership_deleted_at IS NULL THEN
    -- Active row exists: preserve it
    RAISE NOTICE 'PRESERVED existing event_membership: id=% event_id=% user_id=% role=owner', v_membership_id, v_event_id, v_owner_id;
  ELSE
    -- Soft-deleted row exists: resurrect (clear deleted_at)
    UPDATE public.event_memberships
    SET deleted_at = NULL, updated_at = now()
    WHERE id = v_membership_id;

    RAISE NOTICE 'RESURRECTED event_membership: id=% event_id=% user_id=% (was soft-deleted at %)',
      v_membership_id, v_event_id, v_owner_id, v_membership_deleted_at;
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

-- Verify invitation project
SELECT
  id::text,
  slug,
  title,
  event_type,
  status,
  base_demo_id,
  theme_id,
  snapshot ->> 'id' AS snapshot_id,
  created_at,
  updated_at
FROM public.invitation_projects
WHERE slug = 'valentina-hernandez'
  AND deleted_at IS NULL;

-- Verify published content
SELECT
  pc.id::text AS published_content_id,
  pc.slug,
  pc.event_type,
  pc.is_demo,
  pc.content ->> '_assetSlug' AS asset_slug,
  pc.content -> 'rsvp' ->> 'confirmationMode' AS rsvp_confirmation_mode,
  pc.content -> 'rsvp' ->> 'accessMode' AS rsvp_access_mode,
  pc.content -> 'hero' ->> 'name' AS hero_name,
  pc.content -> 'hero' ->> 'label' AS hero_label,
  pc.version
FROM public.published_invitation_content pc
WHERE pc.slug = 'valentina-hernandez'
  AND pc.deleted_at IS NULL;

-- Verify event
SELECT
  e.id::text AS event_id,
  e.owner_user_id::text,
  e.slug,
  e.event_type,
  e.title,
  e.status,
  e.invitation_project_id::text,
  e.created_at,
  e.updated_at
FROM public.events e
WHERE e.slug = 'valentina-hernandez'
  AND e.deleted_at IS NULL;

-- Verify membership (by event slug, includes resolved data)
SELECT
  m.id::text AS membership_id,
  m.event_id::text,
  m.user_id::text,
  m.membership_role,
  m.created_at
FROM public.event_memberships m
JOIN public.events e ON e.id = m.event_id
WHERE e.slug = 'valentina-hernandez'
  AND e.deleted_at IS NULL;

-- Final counts for validation sign-off
SELECT
  (SELECT count(*) FROM public.invitation_projects WHERE slug = 'valentina-hernandez' AND deleted_at IS NULL) AS projects,
  (SELECT count(*) FROM public.published_invitation_content WHERE slug = 'valentina-hernandez' AND deleted_at IS NULL) AS published_content,
  (SELECT count(*) FROM public.events WHERE slug = 'valentina-hernandez' AND deleted_at IS NULL) AS events,
  (SELECT count(*) FROM public.event_memberships m JOIN public.events e ON e.id = m.event_id WHERE e.slug = 'valentina-hernandez' AND e.deleted_at IS NULL) AS memberships;

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- WARNING: This rollback DESTROYS ALL DATA for slug valentina-hernandez across
-- all 4 tables. This includes published content, RSVP events, and any guest
-- invitations or claim codes linked to the event. Data removed this way
-- CANNOT be recovered without a database restore.
--
-- Before considering destructive rollback:
--   1. Take a full production DB backup.
--   2. Run the dry-run queries from the manifest to inspect current active rows.
--   3. Consider whether re-running this patch (UPDATE + resurrect) is sufficient
--      to correct the data — this patch is designed to overwrite all intended
--      fields without destroying rows.
--   4. Only proceed with DELETE if the entire Valentina invitation setup is
--      confirmed invalid and a DB restore is the fallback.
--   5. If event_memberships, guest_invitations, or event_claim_codes reference
--      this event, they will be deleted as well.
--
-- Uncomment and run only after explicit verification:
--
-- BEGIN;
--
-- DELETE FROM public.event_memberships
-- WHERE event_id IN (
--   SELECT id FROM public.events
--   WHERE slug = 'valentina-hernandez'
-- );
--
-- DELETE FROM public.events
-- WHERE slug = 'valentina-hernandez';
--
-- DELETE FROM public.published_invitation_content
-- WHERE slug = 'valentina-hernandez';
--
-- DELETE FROM public.invitation_projects
-- WHERE slug = 'valentina-hernandez';
--
-- COMMIT;
-- ============================================================================
