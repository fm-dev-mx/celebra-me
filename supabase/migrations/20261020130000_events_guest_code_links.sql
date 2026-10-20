-- Which invitations share guest links as /{slug}/{guest_code} (expand).
--
-- The new link form applies to every invitation created from 2026-10-20 on, plus the two
-- invitations the owner moved to it on that date: america and olivia-y-antonio. Every other
-- existing invitation keeps sending /i/{short_id} links, and /{slug}/{guest_code} answers 404
-- for it, so guests of past invitations see no change.
--
-- The column is added with default false, so every existing row is opted out; the default then
-- turns true, so every event created afterwards is opted in. guest_invitations.guest_code stays
-- assigned on every guest (migration 20261020120000); this flag only decides whether links use it.
begin;

alter table public.events
  add column guest_code_links boolean not null default false;

alter table public.events
  alter column guest_code_links set default true;

update public.events
set guest_code_links = true
where slug in ('america', 'olivia-y-antonio');

comment on column public.events.guest_code_links is
  'True when guest links are shared as /{slug}/{guest_code}. Defaults to true for events created from 2026-10-20, false for older ones except america and olivia-y-antonio.';

commit;
