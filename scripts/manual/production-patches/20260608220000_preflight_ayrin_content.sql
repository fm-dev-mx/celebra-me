-- ============================================================================
-- PREFLIGHT: Ayrin content mismatch diagnostic
--
-- This script is READ-ONLY. It does not modify any data.
-- Run against production to verify the current state before applying a patch.
--
-- Expected: exactly 1 row for each SELECT, with specific stale values.
-- ============================================================================

-- 1. Verify invitation identity
SELECT
  'invitation' as check_name,
  id::text,
  slug,
  event_type,
  status,
  kind,
  base_demo_id,
  created_at::text,
  updated_at::text
FROM public.invitations
WHERE slug = 'ayrin-samantha-lerma-castro';

-- 2. Verify published content row
SELECT
  'published_content' as check_name,
  id::text,
  invitation_project_id::text,
  slug,
  event_type,
  version,
  published_at::text,
  updated_at::text,
  content -> 'countdown' ->> 'title' as countdown_title,
  content -> 'countdown' ->> 'footerText' as countdown_footer,
  content -> 'family' -> 'labels' ->> 'sectionMessage' as family_label_msg,
  content -> 'family' ->> 'sectionMessage' as family_msg,
  content -> 'gifts' ->> 'subtitle' as gifts_subtitle,
  content -> 'gallery' ->> 'title' as gallery_title,
  content -> 'gallery' ->> 'eyebrow' as gallery_eyebrow,
  content -> 'gallery' ->> 'subtitle' as gallery_subtitle,
  content -> 'location' ->> 'introEyebrow' as loc_intro_eyebrow,
  content -> 'location' ->> 'introHeading' as loc_intro_heading,
  content -> 'location' ->> 'introLede' as loc_intro_lede,
  content -> 'rsvp' ->> 'confirmationMessage' as rsvp_conf_msg,
  content -> 'music' ->> 'url' as music_url,
  content -> 'music' ->> 'autoPlay' as music_autoplay,
  content -> 'thankYou' ->> 'message' as thank_you_msg,
  content -> 'thankYou' ->> 'closingName' as thank_you_closing,
  content ->> '_assetSlug' as asset_slug,
  content -> 'envelope' ->> 'sealInitials' as seal_initials,
  content -> 'sharing' ->> 'whatsappTemplate' as whatsapp_template
FROM public.published_invitation_content
WHERE slug = 'ayrin-samantha-lerma-castro';

-- 3. Verify draft content row
SELECT
  'draft_content' as check_name,
  icd.id::text,
  icd.status,
  icd.updated_at::text,
  icd.content -> 'countdown' ->> 'title' as countdown_title,
  icd.content -> 'countdown' ->> 'footerText' as countdown_footer,
  icd.content -> 'family' ->> 'sectionMessage' as family_msg,
  icd.content -> 'gallery' ->> 'title' as gallery_title
FROM public.invitation_content_drafts icd
JOIN public.invitations i ON i.id = icd.invitation_project_id
WHERE i.slug = 'ayrin-samantha-lerma-castro';

-- 4. Check for gallery image format in draft
SELECT
  'draft_gallery_format' as check_name,
  jsonb_typeof(icd.content -> 'gallery' -> 'items' -> 0 -> 'image') as gallery_image_0_type,
  icd.content #> '{gallery,items,0,image}' as gallery_image_0_value
FROM public.invitation_content_drafts icd
JOIN public.invitations i ON i.id = icd.invitation_project_id
WHERE i.slug = 'ayrin-samantha-lerma-castro';

-- 5. Check itinerary items in published
SELECT
  'published_itinerary' as check_name,
  jsonb_array_length(content -> 'itinerary' -> 'items') as item_count
FROM public.published_invitation_content
WHERE slug = 'ayrin-samantha-lerma-castro';

-- 6. Check location indications
SELECT
  'published_indications' as check_name,
  jsonb_array_length(content -> 'location' -> 'indications') as indication_count
FROM public.published_invitation_content
WHERE slug = 'ayrin-samantha-lerma-castro';
