-- Published invitation content: composite unique constraint for route identity
-- Phase 3.4: public route keys are (event_type, slug), not slug alone.

alter table public.published_invitation_content
  drop constraint if exists published_invitation_content_slug_key;

drop index if exists published_invitation_content_slug_key;

alter table public.published_invitation_content
  drop constraint if exists published_invitation_content_event_type_slug_key;

alter table public.published_invitation_content
  add constraint published_invitation_content_event_type_slug_key
  unique (event_type, slug);

comment on constraint published_invitation_content_event_type_slug_key
  on public.published_invitation_content is
  'Unique route identity: one published row per (event_type, slug) pair.';
