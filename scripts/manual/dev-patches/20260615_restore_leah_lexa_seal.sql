-- Restore Leah Lexa envelope premium fields after publish regression.
-- Merges into the existing content->envelope object rather than
-- replacing the whole envelope, so any legitimate field edits survive.
--
-- @env: local
-- @script-id: 20260615_restore_leah_lexa_seal
-- @purpose: Restore Leah Lexa Baby Shower premium envelope fields
--           after draft-to-published mapper dropped non-editable fields.
-- @tables: public.published_invitation_content
-- @operation: update
-- @idempotent: true (only patches rows where sealVariant is missing or wrong)

do $$
begin

update public.published_invitation_content
set content = jsonb_set(
  content,
  '{envelope}',
  (coalesce(content->'envelope', '{}'::jsonb) - 'sealIcon' - 'sealInitials') || jsonb_build_object(
    'disabled', coalesce(content->'envelope'->>'disabled', 'false')::boolean,
    'sealStyle', 'wax',
    'sealVariant', 'premium-rose',
    'sealImage', 'sealImage',
    'microcopy', 'Toca para abrir mi invitación',
    'documentLabel', 'Baby Shower',
    'cardLabel', coalesce(content->'envelope'->>'cardLabel', 'Baby Shower'),
    'cardTagline', coalesce(content->'envelope'->>'cardTagline', 'Una celebración celestial'),
    'stampText', 'Leah Lexa',
    'stampYear', '2026',
    'closedPalette', jsonb_build_object(
      'primary', 'surfacePrimary',
      'accent', 'actionAccent',
      'background', 'surfacePrimary'
    )
  )
)
where event_type = 'baby-shower'
  and slug = 'leah-lexa';

exception when others then
  rollback;
  raise;

end $$;
