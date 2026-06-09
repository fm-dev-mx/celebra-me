-- ============================================================================
-- Option A: Conservative JSON-path patch for ayrin-samantha-lerma-castro
--
-- This patch applies targeted jsonb_set() operations ONLY for confirmed safe
-- text/boolean changes. It does NOT replace the full content JSON.
--
-- Media/asset references preserved: hero.backgroundImage, hero.backgroundImageMobile
-- Unresolved decisions (unchanged): _assetSlug, envelope.sealInitials,
--   sharing.whatsappTemplate
--
-- Only run this against PRODUCTION after:
--   1. Taking and verifying a production DB backup
--   2. Running the preflight script and confirming expected state
--   3. Reviewing and approving this patch
--
-- Requires: PROD_DB_URL environment variable or secret file
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PREFLIGHT
-- ============================================================================
CREATE TEMP TABLE _ayrin_invitation ON COMMIT DROP AS
SELECT id FROM public.invitations
WHERE slug = 'ayrin-samantha-lerma-castro'
  AND base_demo_id = 'demo-xv-enchanted-rose';

DO $$
DECLARE
  inv_count integer;
  pub_count integer;
BEGIN
  SELECT count(*) INTO inv_count FROM _ayrin_invitation;
  IF inv_count <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: Expected 1 invitation, found %', inv_count;
  END IF;

  SELECT count(*) INTO pub_count
  FROM public.published_invitation_content pc
  JOIN _ayrin_invitation ai ON ai.id = pc.invitation_project_id
  WHERE pc.slug = 'ayrin-samantha-lerma-castro';
  IF pub_count <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: Expected 1 published row, found %', pub_count;
  END IF;

  RAISE NOTICE 'Preflight OK: 1 invitation, 1 published row';
END $$;

-- ============================================================================
-- 2. PATCH published_invitation_content
--    Apply targeted jsonb_set for each safe text/boolean path.
--    Start from production content, nest jsonb_set calls.
-- ============================================================================
UPDATE public.published_invitation_content
SET
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(
                                jsonb_set(
                                  jsonb_set(
                                    jsonb_set(
                                      jsonb_set(
                                        jsonb_set(
                                          jsonb_set(
                                            jsonb_set(
                                              jsonb_set(
                                                jsonb_set(
                                                  jsonb_set(
                                                    jsonb_set(
                                                      jsonb_set(
                                                        jsonb_set(
                                                          jsonb_set(
                                                            jsonb_set(
                                                              jsonb_set(
                                                                jsonb_set(
                                                                  jsonb_set(
                                                                    jsonb_set(
                                                                      content,
                                                                      '{countdown,title}',
                                                                      '"La celebración comienza en"',
                                                                      false
                                                                    ),
                                                                    '{countdown,footerText}',
                                                                    '"Viñedos · LOS MOCHIS, SINALOA"',
                                                                    false
                                                                  ),
                                                                  '{location,introEyebrow}',
                                                                  '"Punto de encuentro"',
                                                                  false
                                                                ),
                                                                '{location,introHeading}',
                                                                '"Ceremonia y recepción"',
                                                                false
                                                              ),
                                                              '{location,introLede}',
                                                              '"Aquí encontrarás la ruta para llegar al evento."',
                                                              false
                                                            ),
                                                            '{location,indications}',
                                                            '[
                                                              {"text":"Tonos reservados para la quinceañera: dorado, champagne y vino.","iconName":"Sparkles","styleVariant":"default"},
                                                              {"text":"Vestimenta formal","iconName":"DressCode","styleVariant":"default"}
                                                            ]'::jsonb,
                                                            false
                                                          ),
                                                          '{family,labels,sectionMessage}',
                                                          '"Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos."',
                                                          false
                                                        ),
                                                        '{family,sectionMessage}',
                                                        '"Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos."',
                                                        false
                                                      ),
                                                      '{gifts,subtitle}',
                                                      '"Tu presencia es el regalo más valioso. Si deseas tener un detalle adicional, habrá un cofre para sobres el día del evento."',
                                                      false
                                                    ),
                                                    '{gallery,title}',
                                                    '"Instantes de Ayrin"',
                                                    false
                                                  ),
                                                  '{gallery,eyebrow}',
                                                  '"GALERIA"',
                                                  false
                                                ),
                                                '{gallery,subtitle}',
                                                '"Una selección de momentos entre rosas, luz cálida y detalles dorados."',
                                                false
                                              ),
                                              '{gallery,items}',
                                              '[
                                                {"image":{"key":"gallery10","type":"internal"},"caption":"Entre rosas, velas y un toque de magia."},
                                                {"image":{"key":"gallery06","type":"internal"},"caption":"Un instante envuelto en luz dorada."},
                                                {"image":{"key":"gallery03","type":"internal"},"caption":"El brillo antiguo de una noche de gala."},
                                                {"image":{"key":"gallery08","type":"internal"},"caption":"Momentos que florecen con cariño."},
                                                {"image":{"key":"gallery02","type":"internal"},"caption":"Primer plano con detalles rosados.","focalPoint":"50% 4%"},
                                                {"image":{"key":"gallery04","type":"internal"},"caption":"Cadenas doradas, flores y luz suave al fondo."},
                                                {"image":{"key":"interlude01","type":"internal"},"caption":"Un nuevo capítulo entre rosas."}
                                              ]'::jsonb,
                                              false
                                            ),
                                            '{itinerary}',
                                            '{
                                              "items": [
                                                {"time":"18:00","label":"Ceremonia Religiosa","iconName":"Church","description":"Un momento especial para agradecer"},
                                                {"time":"20:00","label":"Recepción","iconName":"Reception","description":"Nos reuniremos en el Salón Viñedos para dar inicio a la celebración."},
                                                {"time":"21:30","label":"Vals","iconName":"Waltz","description":"Uno de los momentos más especiales de la noche."},
                                                {"time":"22:30","label":"Cena","iconName":"Dinner","description":"Cena especial en compañía de nuestros seres queridos."},
                                                {"time":"01:00","label":"Cierre","iconName":"CheckSeal","description":"Gracias por celebrar conmigo."}
                                              ],
                                              "title": "Programa"
                                            }'::jsonb,
                                            false
                                          ),
                                          '{rsvp,confirmationMessage}',
                                          '"Gracias por confirmar. Te esperamos con alegría en esta noche tan especial."',
                                          false
                                        ),
                                        '{rsvp,responseMessages}',
                                        '{"confirmed":{"title":"Gracias por acompañarnos, {guestName}.","subtitle":"Tu confirmación ha sido registrada."}}'::jsonb,
                                        true
                                      ),
                                      '{thankYou,message}',
                                      '"Gracias por ser parte de este momento tan importante para mí.\nCompartir mis XV años con ustedes convierte esta noche en un recuerdo que guardaré siempre en mi corazón."',
                                      false
                                    ),
                                    '{thankYou,closingName}',
                                    '"Ayrin Lerma"',
                                    false
                                  ),
                                  '{music,url}',
                                  '"https://res.cloudinary.com/dusxvauvj/video/upload/v1780703235/Taylor_Swift_-_Style_compressed_r5caxg.mp3"',
                                  false
                                ),
                                '{music,autoPlay}',
                                'true',
                                false
                              ),
                              '{description}',
                              '"Una invitación de palacio con rosas rojas, luz de velas y una atmósfera cálida de gala para celebrar XV años."',
                              false
                            ),
                            '{gallery,items,4,focalPoint}',
                            '"50% 4%"',
                            true
                          ),
                          '{itinerary,items,2,time}',
                          '"21:30"',
                          false
                        ),
                        '{itinerary,items,3,time}',
                        '"22:30"',
                        false
                      ),
                      '{itinerary,items,0,label}',
                      '"Ceremonia Religiosa"',
                      false
                    ),
                    '{itinerary,items,0,description}',
                    '"Un momento especial para agradecer"',
                    false
                  ),
                  '{itinerary,items,1,description}',
                  '"Nos reuniremos en el Salón Viñedos para dar inicio a la celebración."',
                  false
                ),
                '{itinerary,items,2,description}',
                '"Uno de los momentos más especiales de la noche."',
                false
              ),
              '{itinerary,items,3,description}',
              '"Cena especial en compañía de nuestros seres queridos."',
              false
            ),
            '{itinerary,items,4,iconName}',
            '"CheckSeal"',
            false
          ),
          '{itinerary,items,4,description}',
          '"Gracias por celebrar conmigo."',
          false
        ),
        '{itinerary,items,1,iconName}',
        '"Reception"',
        true
      ),
      '{itinerary,items,0,iconName}',
      '"Church"',
      true
    ),
    '{sectionOrder}',
    '["quote","location","countdown","family","itinerary","gallery","gifts","personalizedAccess","rsvp","thankYou"]'::jsonb,
    false
  ),
  version = version + 1,
  updated_at = now()
FROM _ayrin_invitation ai
WHERE published_invitation_content.invitation_project_id = ai.id;

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================
SELECT
  'option_a_verify' as check_name,
  content -> 'countdown' ->> 'title' as countdown_title,
  content -> 'countdown' ->> 'footerText' as countdown_footer,
  content -> 'family' -> 'labels' ->> 'sectionMessage' as family_label_msg,
  content -> 'gifts' ->> 'subtitle' as gifts_subtitle,
  content -> 'gallery' ->> 'title' as gallery_title,
  content -> 'music' ->> 'url' as music_url,
  content -> 'music' ->> 'autoPlay' as music_autoplay,
  content -> 'thankYou' ->> 'closingName' as thank_you_closing,
  content #> '{hero,backgroundImage,assetId}' as bg_asset_id_preserved,
  content #> '{hero,backgroundImageMobile,assetId}' as bg_mobile_asset_id_preserved,
  content ->> '_assetSlug' as asset_slug_unchanged
FROM public.published_invitation_content
WHERE slug = 'ayrin-samantha-lerma-castro';

COMMIT;
