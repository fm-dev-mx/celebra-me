-- Published invitation content: composite index for eventType + slug lookups
-- Phase 3.4 hardening: ensure fast lookups when filtering by both slug and event_type.

create index if not exists idx_published_invitation_content_slug_event_type
  on public.published_invitation_content (slug, event_type);

comment on index idx_published_invitation_content_slug_event_type is
  'Composite index for eventType-safe public route resolution.';
