-- ============================================================================
-- RESTORE: Restore real César-Ramses gallery to draft + published content
--
-- Context: The gallery was incorrectly removed during demo-leakage cleanup.
-- This was REAL content (6 items with unique captions/focal points), not
-- demo-originated. See investigation in session logs.
--
-- Safe: Transactional with pre/post checks. Idempotent (uses jsonb_set with
-- create_if_missing=true, so re-running replaces with same payload).
-- Do NOT run on production without review.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PRE-CHECK: Confirm current gallery state before restoring
-- ============================================================================
SELECT 'PRE-CHECK' AS phase;

SELECT 'draft' AS source, id, content->'gallery' AS gallery
FROM invitation_content_drafts
WHERE invitation_project_id IN (
  SELECT id FROM invitations WHERE slug = 'cesar-ramses'
);

SELECT 'published' AS source, id, content->'gallery' AS gallery
FROM published_invitation_content
WHERE slug = 'cesar-ramses'
  AND event_type = 'bautizo';

-- ============================================================================
-- RESTORE GALLERY PAYLOAD
--
-- Confirmed real César-Ramses content from original cesar-ramses.json.
-- NOT from demo-bautismo-angelic-presence — captions and focal points differ.
-- ============================================================================
-- ============================================================================

-- RESTORE DRAFT GALLERY
UPDATE invitation_content_drafts
SET content = jsonb_set(
  COALESCE(content, '{}'::jsonb),
  '{gallery}',
  '{
    "title": "Instantes de luz",
    "subtitle": "Una memoria serena de este día sagrado",
    "items": [
      {
        "image": {"type": "internal", "key": "gallery01"},
        "caption": "Pureza y ternura",
        "focalPoint": "50% 45%"
      },
      {
        "image": {"type": "internal", "key": "gallery02"},
        "caption": "La luz del sacramento",
        "focalPoint": "50% 56%"
      },
      {
        "image": {"type": "internal", "key": "gallery03"},
        "caption": "Bendición en familia",
        "focalPoint": "52% 42%"
      },
      {
        "image": {"type": "internal", "key": "gallery04"},
        "caption": "Felicidad que nos llena",
        "focalPoint": "50% 41%"
      },
      {
        "image": {"type": "internal", "key": "gallery05"},
        "caption": "Inocencia y pureza",
        "focalPoint": "49% 45%"
      },
      {
        "image": {"type": "internal", "key": "gallery06"},
        "caption": "Un año de bendiciones",
        "focalPoint": "50% 44%"
      }
    ]
  }'::jsonb,
  true
)
WHERE invitation_project_id IN (
  SELECT id FROM invitations WHERE slug = 'cesar-ramses'
);

-- RESTORE PUBLISHED GALLERY
UPDATE published_invitation_content
SET content = jsonb_set(
  COALESCE(content, '{}'::jsonb),
  '{gallery}',
  '{
    "title": "Instantes de luz",
    "subtitle": "Una memoria serena de este día sagrado",
    "items": [
      {
        "image": {"type": "internal", "key": "gallery01"},
        "caption": "Pureza y ternura",
        "focalPoint": "50% 45%"
      },
      {
        "image": {"type": "internal", "key": "gallery02"},
        "caption": "La luz del sacramento",
        "focalPoint": "50% 56%"
      },
      {
        "image": {"type": "internal", "key": "gallery03"},
        "caption": "Bendición en familia",
        "focalPoint": "52% 42%"
      },
      {
        "image": {"type": "internal", "key": "gallery04"},
        "caption": "Felicidad que nos llena",
        "focalPoint": "50% 41%"
      },
      {
        "image": {"type": "internal", "key": "gallery05"},
        "caption": "Inocencia y pureza",
        "focalPoint": "49% 45%"
      },
      {
        "image": {"type": "internal", "key": "gallery06"},
        "caption": "Un año de bendiciones",
        "focalPoint": "50% 44%"
      }
    ]
  }'::jsonb,
  true
)
WHERE slug = 'cesar-ramses'
  AND event_type = 'bautizo';

-- ============================================================================
-- POST-CHECK: Confirm gallery was restored
-- ============================================================================
SELECT 'POST-CHECK' AS phase;

SELECT 'draft' AS source, id, content->'gallery' AS gallery
FROM invitation_content_drafts
WHERE invitation_project_id IN (
  SELECT id FROM invitations WHERE slug = 'cesar-ramses'
);

SELECT 'published' AS source, id, content->'gallery' AS gallery
FROM published_invitation_content
WHERE slug = 'cesar-ramses'
  AND event_type = 'bautizo';

COMMIT;
