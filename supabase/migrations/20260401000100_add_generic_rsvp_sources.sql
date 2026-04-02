begin;

alter table public.guest_invitations
  add column if not exists entry_source text not null default 'dashboard';

update public.guest_invitations
set entry_source = 'dashboard'
where entry_source is null;

alter table public.guest_invitations
  drop constraint if exists guest_invitations_entry_source_check;

alter table public.guest_invitations
  add constraint guest_invitations_entry_source_check
  check (entry_source in ('dashboard', 'generic_public'));

alter table public.guest_invitations
  drop constraint if exists guest_invitations_last_response_source_check;

alter table public.guest_invitations
  add constraint guest_invitations_last_response_source_check
  check (last_response_source in ('link', 'admin', 'generic_link'));

commit;
