-- Add nullable FK from events to invitation_projects.
-- RSVP events become a module of an invitation project.
-- Partial unique index enforces at most one event per project when linked.

alter table public.events
  add column invitation_project_id uuid null
  references public.invitation_projects(id) on delete set null;

create index if not exists idx_events_invitation_project_id
  on public.events(invitation_project_id);

-- Partial unique index: at most one RSVP event per project.
-- Stage 0 audit confirmed zero projects with >1 event.
create unique index if not exists idx_events_unique_invitation_project
  on public.events(invitation_project_id)
  where invitation_project_id is not null;

comment on column public.events.invitation_project_id is
  'Nullable FK to invitation_projects. Set when an event is created through the invitation publishing flow or adopted from legacy RSVP data. Partial unique index enforces at most one event per project.';
