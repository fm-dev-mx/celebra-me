alter table public.intake_requests
add column if not exists origin text not null default 'client';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intake_requests_origin_check'
  ) then
    alter table public.intake_requests
    add constraint intake_requests_origin_check
    check (origin in ('client', 'internal'));
  end if;
end $$;

update public.intake_requests
set origin = 'internal'
where token_hash = 'internal-edit'
   or token_hash like 'admin-created-%';

create index if not exists idx_intake_requests_project_origin_created
on public.intake_requests(invitation_project_id, origin, created_at desc);

comment on column public.intake_requests.origin is
'client = optional external capture link; internal = dashboard source-data editing context.';
