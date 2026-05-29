-- Remove redundant published invitation content lookup indexes.
--
-- Public published invitation lookups are event-type-aware:
-- WHERE event_type = ? AND slug = ?
--
-- That lookup pattern is enforced and indexed by:
-- published_invitation_content_event_type_slug_key UNIQUE (event_type, slug)

drop index if exists idx_published_invitation_content_slug;
drop index if exists idx_published_invitation_content_slug_event_type;
