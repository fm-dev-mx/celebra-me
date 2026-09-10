-- Administrative metadata is independent of publication and visual acceptance.
alter table public.invitations
  add column work_status text not null default 'in_progress'
    check (work_status in ('in_progress', 'completed')),
  add column owner_reviewed_at timestamptz,
  add column owner_reviewed_by uuid references auth.users(id),
  add constraint invitation_owner_review_pair check
    ((owner_reviewed_at is null) = (owner_reviewed_by is null));

-- Table-level grants would bypass the owner check in the dashboard endpoint.
-- Preserve existing client writes with column grants; new fields are server-only.
-- NOTE: the re-grant below snapshots columns at migration time. Any column added
-- by a future migration is NOT writable by authenticated unless that migration
-- grants it explicitly.
revoke insert, update on public.invitations from authenticated;
do $$
declare existing_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into existing_columns
    from pg_attribute
    where attrelid = 'public.invitations'::regclass and attnum > 0 and not attisdropped
      and attname not in ('work_status', 'owner_reviewed_at', 'owner_reviewed_by');
  execute format('grant insert (%s), update (%s) on public.invitations to authenticated',
    existing_columns, existing_columns);
end;
$$;

