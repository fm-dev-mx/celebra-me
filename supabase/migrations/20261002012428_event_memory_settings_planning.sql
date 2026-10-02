-- Planning inputs for event memory spaces.
--
-- The super-admin console sizes a space against its expected attendance and
-- keeps an internal note (payment reference, agreements with the client). Both
-- values are administrator-only context: the reservation RPC never reads them,
-- so they do not change any quota, window or retention decision.
--
-- Additive only. Both columns are nullable, existing rows keep NULL, and the
-- table's access boundary (forced RLS, service-role-only policy) is unchanged.

begin;

alter table public.event_memory_settings
	add column expected_guests integer null,
	add column admin_note text null;

alter table public.event_memory_settings
	add constraint event_memory_settings_expected_guests_check
		check (expected_guests is null or expected_guests between 1 and 5000),
	add constraint event_memory_settings_admin_note_check
		check (admin_note is null or char_length(admin_note) <= 500);

commit;

notify pgrst, 'reload schema';
