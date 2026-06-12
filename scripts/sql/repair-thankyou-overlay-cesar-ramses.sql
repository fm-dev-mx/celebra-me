-- ============================================================================
-- One-off data repair: restore thankYou overlay fields for cesar-ramses
-- ============================================================================
-- 
-- Why: The mapThankYouSection() mapper dropped focalPoint, overlayAnchor,
-- and overlaySafeArea during a previous publish. These fields are required
-- by the sacred-keepsake variant for subject-aware image positioning.
-- 
-- Root cause fix: draft-to-published.mapper.ts now preserves these fields.
-- This SQL repairs the existing published row so that the subject-aware
-- overlay renders correctly without waiting for the next re-publish.
--
-- Applied: 2026-06-12 (production)
-- Scope:   single row identified by id
-- ============================================================================

UPDATE published_invitation_content
SET content = jsonb_set(
  jsonb_set(
    jsonb_set(
      content,
      '{thankYou,focalPoint}',
      '"50% 42%"'
    ),
    '{thankYou,overlayAnchor}',
      '"left"'
  ),
  '{thankYou,overlaySafeArea}',
  '{"x": 0.5, "y": 0.31, "width": 0.21, "height": 0.24}'
)
WHERE id = '35d92ee5-d2ef-4307-ad28-59914920bdc4';
