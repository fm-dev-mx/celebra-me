-- Forward-only catalog integrity additions for Valentina Memories.
-- Existing catalog rows retain a nullable checksum so this migration never
-- invents integrity metadata for files uploaded before checksum binding.

begin;

alter table public.valentina_memory_items
	add column if not exists checksum_sha256 text,
	add column if not exists duplicate_of_id uuid references public.valentina_memory_items(id) on delete set null;

alter table public.valentina_memory_items
	drop constraint if exists valentina_memory_items_status_check;

alter table public.valentina_memory_items
	add constraint valentina_memory_items_status_check
	check (status in ('uploading', 'validating', 'accepted', 'rejected', 'deleted', 'duplicate'));

alter table public.valentina_memory_items
	drop constraint if exists valentina_memory_items_checksum_sha256_check;

alter table public.valentina_memory_items
	add constraint valentina_memory_items_checksum_sha256_check
	check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$');

create unique index if not exists idx_valentina_memory_items_event_checksum_accepted
	on public.valentina_memory_items (event_key, checksum_sha256)
	where status = 'accepted' and checksum_sha256 is not null;

commit;
