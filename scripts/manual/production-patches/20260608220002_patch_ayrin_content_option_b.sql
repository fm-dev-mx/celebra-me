-- ============================================================================
-- Option B (revised): Full published content replacement
--   ayrin-samantha-lerma-castro
--
-- Strategy:
--   1. Capture production-specific values into _ayrin_prod_preserved
--      BEFORE any write.
--   2. Replace full content JSON with authoritative local snapshot.
--   3. Re-insert captured production values via jsonb_set.
--
-- Preserved fields (production values kept):
--   - hero.backgroundImage
--   - hero.backgroundImageMobile
--   - _assetSlug (unresolved, preserved as-is)
--   - envelope.sealInitials (unresolved, preserved as-is)
--   - sharing.whatsappTemplate (unresolved, preserved as-is)
--
-- Requirements before execution:
--   1. Run 20260608220000_preflight_ayrin_content.sql against production
--   2. Run pnpm db:prod:backup
--   3. Review this file and obtain explicit approval
--
-- Excluded from this patch:
--   - invitation_content_drafts (separate schema-aware patch needed)
--   - guest_invitations
--   - events, invitations metadata rows
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Identify the target invitation
-- ============================================================================
CREATE TEMP TABLE _ayrin_invitation ON COMMIT DROP AS
SELECT id FROM public.invitations
WHERE slug = 'ayrin-samantha-lerma-castro'
  AND base_demo_id = 'demo-xv-enchanted-rose';

-- ============================================================================
-- 2. Capture production values BEFORE overwriting
-- ============================================================================
CREATE TEMP TABLE _ayrin_prod_preserved ON COMMIT DROP AS
SELECT
  pc.content #> '{hero,backgroundImage}' AS hero_background_image,
  pc.content #> '{hero,backgroundImageMobile}' AS hero_background_image_mobile,
  pc.content -> '_assetSlug' AS asset_slug,
  pc.content #> '{envelope,sealInitials}' AS envelope_seal_initials,
  pc.content #> '{sharing,whatsappTemplate}' AS sharing_whatsapp_template
FROM public.published_invitation_content pc
JOIN _ayrin_invitation ai ON ai.id = pc.invitation_project_id
WHERE pc.slug = 'ayrin-samantha-lerma-castro';

-- ============================================================================
-- 3. PREFLIGHT: Verify preconditions
-- ============================================================================
DO $$
DECLARE
  inv_count integer;
  preserved_count integer;
  missing_asset boolean;
BEGIN
  SELECT count(*) INTO inv_count FROM _ayrin_invitation;
  IF inv_count <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: Expected exactly 1 invitation, found %', inv_count;
  END IF;

  SELECT count(*) INTO preserved_count FROM _ayrin_prod_preserved;
  IF preserved_count <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: Expected exactly 1 preserved production content row, found %', preserved_count;
  END IF;

  SELECT
    (p.hero_background_image IS NULL
     OR p.hero_background_image_mobile IS NULL
     OR p.asset_slug IS NULL) INTO missing_asset
  FROM _ayrin_prod_preserved p;
  IF missing_asset THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: One or more production asset values are NULL';
  END IF;

  RAISE NOTICE 'Preflight OK: 1 invitation, production values captured';
END $$;

-- ============================================================================
-- 4. PATCH: Full JSON replacement + dynamic production value restoration
-- ============================================================================
DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.published_invitation_content pc
  SET
    content = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              '{"hero":{"date":"2026-08-01T18:00:00Z","name":"Ayrin Samantha Lerma Castro","label":"Mis XV años","variant":"enchanted-rose","nickname":"","portrait":{"key":"portrait","type":"internal"},"secondaryName":"","backgroundImage":{"src":"http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/invitations/01548214-bc22-4141-ba61-f36c27cd8627/original/ca7109dd-82ad-4e2c-a25f-e95bc7c04a2f.png","type":"uploaded","assetId":"1ecf90d5-0d30-4555-94d7-62e78aeb94ce"},"backgroundImageMobile":{"src":"http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/invitations/01548214-bc22-4141-ba61-f36c27cd8627/original/5b3f1935-81d9-4c41-aa41-15f19ca45df2.webp","type":"uploaded","assetId":"01de1f9c-5f86-4986-9d9f-c848ff919f9a"}},"rsvp":{"title":"Confirmación de asistencia","subcopy":"Te esperamos para celebrar juntos.","guestCap":5,"accessMode":"hybrid","confirmationMode":"api","responseMessages":{"confirmed":{"title":"Gracias por acompañarnos, {guestName}.","subtitle":"Tu confirmación ha sido registrada."}},"confirmationMessage":"Gracias por confirmar. Te esperamos con alegría en esta noche tan especial."},"gifts":{"items":[{"text":"","type":"cash","title":"Lluvia de sobres"}],"title":"Mesa de regalos","subtitle":"Tu presencia es el regalo más valioso. Si deseas tener un detalle adicional, habrá un cofre para sobres el día del evento."},"music":{"url":"https://res.cloudinary.com/dusxvauvj/video/upload/v1780703235/Taylor_Swift_-_Style_compressed_r5caxg.mp3","title":"Style — Taylor Swift","autoPlay":true},"quote":{"text":"A Dios por la vida y las bendiciones, a mis padres por su amor incondicional, y por hacer mi sueño realidad.","author":"Ayrin Samantha"},"theme":{"preset":"enchanted-rose","fontFamily":"serif"},"title":"XV Años de Ayrin Samantha","family":{"labels":{"parentsTitle":"Con la bendición de","sectionTitle":"Mi Familia","sectionMessage":"Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos.","godparentsTitle":"Padrinos","sectionSubtitle":"Con amor y gratitud"},"parents":{"father":"Cristhian Jesús Lerma Higuera","mother":"Nirya Samantha Castro Martínez","fatherDeceased":false,"motherDeceased":false},"godparents":[{"name":"Wilfrido Ruiz Castros"},{"name":"María Dolores Luna Morales"}],"sectionMessage":"Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos."},"isDemo":false,"gallery":{"items":[{"image":{"key":"gallery10","type":"internal"},"caption":"Entre rosas, velas y un toque de magia."},{"image":{"key":"gallery06","type":"internal"},"caption":"Un instante envuelto en luz dorada."},{"image":{"key":"gallery03","type":"internal"},"caption":"El brillo antiguo de una noche de gala."},{"image":{"key":"gallery08","type":"internal"},"caption":"Momentos que florecen con cariño."},{"image":{"key":"gallery02","type":"internal"},"caption":"Primer plano con detalles rosados.","focalPoint":"50% 4%"},{"image":{"key":"gallery04","type":"internal"},"caption":"Cadenas doradas, flores y luz suave al fondo."},{"image":{"key":"interlude01","type":"internal"},"caption":"Un nuevo capítulo entre rosas."}],"title":"Instantes de Ayrin","eyebrow":"GALERÍA","subtitle":"Una selección de momentos entre rosas, luz cálida y detalles dorados."},"sharing":{"ogImage":{"key":"portrait","type":"internal"},"whatsappTemplate":"Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}"},"envelope":{"disabled":false,"sealIcon":"flower","microcopy":"Abre tu invitación","sealStyle":"wax","sealInitials":"I·R","closedPalette":{"accent":"actionAccent","primary":"surfacePrimary","background":"surfaceDark"}},"location":{"ceremony":{"date":"2026-08-01","time":"18:00","image":{"key":"mapCeremony","type":"internal"},"mapUrl":"https://maps.app.goo.gl/jLJPcB1pTMKTJrBy7?g_st=iwb","address":"Independencia S/N, Col. Centro","venueName":"Parroquia del Santuario de Guadalupe","venueEvent":"Ceremonia"},"introLede":"Aquí encontrarás la ruta para llegar al evento.","reception":{"date":"2026-08-01","time":"20:00","image":{"key":"mapReception","type":"internal"},"mapUrl":"https://maps.app.goo.gl/chSToUcmmaN8ejWH6?g_st=awb","address":"Santos Degollado #30, Fracc. Las Fuentes","venueName":"Viñedos","venueEvent":"Recepción"},"indications":[{"text":"Tonos reservados para la quinceañera: dorado, champagne y vino.","iconName":"Sparkles","styleVariant":"default"},{"text":"Vestimenta formal","iconName":"DressCode","styleVariant":"default"}],"introEyebrow":"Punto de encuentro","introHeading":"Ceremonia y recepción","indicationsHeading":""},"thankYou":{"image":{"key":"thankYouPortrait","type":"internal"},"message":"Gracias por ser parte de este momento tan importante para mí.\nCompartir mis XV años con ustedes convierte esta noche en un recuerdo que guardaré siempre en mi corazón.","closingName":"Ayrin Lerma"},"countdown":{"title":"La celebración comienza en","footerText":"Viñedos • LOS MOCHIS, SINALOA"},"eventType":"xv","itinerary":{"items":[{"time":"18:00","label":"Ceremonia Religiosa","iconName":"Church","description":"Un momento especial para agradecer"},{"time":"20:00","label":"Recepción","iconName":"Reception","description":"Nos reuniremos en el Salón Viñedos para dar inicio a la celebración."},{"time":"21:30","label":"Vals","iconName":"Waltz","description":"Uno de los momentos más especiales de la noche."},{"time":"22:30","label":"Cena","iconName":"Dinner","description":"Cena especial en compañía de nuestros seres queridos."},{"time":"01:00","label":"Cierre","iconName":"CheckSeal","description":"Gracias por celebrar conmigo."}],"title":"Programa"},"_assetSlug":"demo-xv-enchanted-rose","interludes":[{"alt":"Detalle de palacio con espejo antiguo y rosas rojas","image":{"key":"interlude02","type":"internal"},"height":"screen","lightX":"54%","lightY":"34%","focalPoint":"50% 25%","afterSection":"family"},{"alt":"Mesa de gala con velas, detalles dorados y rosas","image":{"key":"interlude03","type":"internal"},"height":"screen","lightX":"68%","lightY":"44%","focalPoint":"54% 22%","afterSection":"gallery","overlayOpacity":"18%"}],"description":"Una invitación de palacio con rosas rojas, luz de velas y una atmósfera cálida de gala para celebrar XV años.","sectionOrder":["quote","location","countdown","family","itinerary","gallery","gifts","personalizedAccess","rsvp","thankYou"],"sectionStyles":{"location":{"showFlourishes":true}}}'::jsonb,
              '{hero,backgroundImage}',
              p.hero_background_image,
              true
            ),
            '{hero,backgroundImageMobile}',
            p.hero_background_image_mobile,
            true
          ),
          '{_assetSlug}',
          p.asset_slug,
          true
        ),
        '{envelope,sealInitials}',
        p.envelope_seal_initials,
        true
      ),
      '{sharing,whatsappTemplate}',
      p.sharing_whatsapp_template,
      true
    ),
    version = version + 1,
    updated_at = now()
  FROM _ayrin_invitation ai
  CROSS JOIN _ayrin_prod_preserved p
  WHERE pc.invitation_project_id = ai.id
    AND pc.slug = 'ayrin-samantha-lerma-castro';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'PATCH_ABORT: Expected to update exactly 1 row, updated %', updated_count;
  END IF;

  RAISE NOTICE 'PATCH_OK: Updated % row(s) for ayrin-samantha-lerma-castro', updated_count;
END $$;

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================
SELECT
  'option_b_verify' AS check_name,
  content -> 'countdown' ->> 'title' AS countdown_title,
  content -> 'countdown' ->> 'footerText' AS countdown_footer,
  content -> 'family' -> 'labels' ->> 'sectionMessage' AS family_label_msg,
  content -> 'family' ->> 'sectionMessage' AS family_msg,
  content -> 'gifts' ->> 'subtitle' AS gifts_subtitle,
  content -> 'gallery' ->> 'title' AS gallery_title,
  content -> 'gallery' ->> 'eyebrow' AS gallery_eyebrow,
  content -> 'music' ->> 'url' AS music_url,
  content -> 'music' ->> 'autoPlay' AS music_autoplay,
  content -> 'thankYou' ->> 'closingName' AS thank_you_closing,
  content #> '{hero,backgroundImage,assetId}' AS bg_asset_id_preserved,
  content #> '{hero,backgroundImageMobile,assetId}' AS bg_mobile_asset_id_preserved,
  content ->> '_assetSlug' AS asset_slug_preserved,
  content #>> '{envelope,sealInitials}' AS seal_initials_preserved,
  version
FROM public.published_invitation_content
WHERE slug = 'ayrin-samantha-lerma-castro';

COMMIT;
