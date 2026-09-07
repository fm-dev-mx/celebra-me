begin;

-- Preserve existing normalized WebP rows and admit only explicitly validated originals.
-- No asset bytes, invitation content, or existing rows are changed by this expansion.
alter table public.invitation_assets
  drop constraint invitation_assets_validated_metadata_complete,
  add constraint invitation_assets_validated_metadata_complete
    check (
      validation_version = 0
      or (
        (
          mime_type = 'image/webp'
          or (
            validation_version in (3, 4)
            and mime_type in ('image/jpeg', 'image/png')
            and original_mime_type = mime_type
            and original_file_size = file_size
          )
        )
        and width is not null
        and height is not null
        and file_size is not null
        and original_mime_type is not null
        and original_file_size is not null
      )
    ) not valid;

comment on column public.invitation_assets.validation_version is
  '0 legacy; 1 normalized WebP; 2 role-budgeted normalized WebP; 3 decoded original; 4 role-budgeted decoded original. Original policies retain exact validated bytes.';

commit;
