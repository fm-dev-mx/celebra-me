begin;

alter table public.invitation_assets
  add column if not exists validation_version integer not null default 0,
  add column if not exists original_mime_type text,
  add column if not exists original_file_size integer;

-- Reconcile constraints that may already exist from previous manual runs.
alter table public.invitation_assets
  drop constraint if exists invitation_assets_dimensions_positive,
  drop constraint if exists invitation_assets_height_positive,
  drop constraint if exists invitation_assets_file_size_positive,
  drop constraint if exists invitation_assets_validated_metadata_complete;

alter table public.invitation_assets
  add constraint invitation_assets_dimensions_positive
    check (width is null or width > 0) not valid,
  add constraint invitation_assets_height_positive
    check (height is null or height > 0) not valid,
  add constraint invitation_assets_file_size_positive
    check (file_size is null or file_size > 0) not valid,
  add constraint invitation_assets_validated_metadata_complete
    check (
      validation_version = 0
      or (
        mime_type = 'image/webp'
        and width is not null
        and height is not null
        and file_size is not null
        and original_mime_type is not null
        and original_file_size is not null
      )
    ) not valid;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'invitation-assets'
  ) then
    raise exception 'Storage bucket invitation-assets does not exist';
  end if;
end;
$$;

update storage.buckets
set file_size_limit = 8388608
where id = 'invitation-assets';

comment on column public.invitation_assets.validation_version is
  'Zero identifies legacy assets. Positive versions identify server-decoded and normalized uploads.';

commit;
