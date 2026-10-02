/**
 * Synthetic memory space for browser tests. Served read-only by the canonical
 * fixture transport so `/r/<slug>` renders without a database; never a real event.
 */
import { MEMORIES_LIMIT_PROFILES } from '../../src/lib/memories/contract/limits.ts';

export const CANONICAL_MEMORIES_SLUG = 'recuerdos-fixture';
const CANONICAL_MEMORIES_EVENT_TITLE = 'Evento de prueba';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A space whose upload window is open around `now`, shaped like an `event_memory_settings` row. */
export function buildCanonicalMemorySpaceRow(now = new Date()): Record<string, unknown> {
	const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * DAY_MS).toISOString();
	const limits = MEMORIES_LIMIT_PROFILES.standard;
	return {
		event_id: 'eeeeeeee-0000-4000-8000-000000000001',
		public_slug: CANONICAL_MEMORIES_SLUG,
		enabled: true,
		time_zone: 'America/Mazatlan',
		upload_starts_at: at(-1),
		upload_ends_at: at(1),
		retention_ends_at: at(30),
		max_event_objects: limits.maxEventObjects,
		max_event_bytes: limits.maxEventBytes,
		max_session_files: limits.maxSessionFiles,
		max_session_videos: limits.maxSessionVideos,
		max_session_bytes: limits.maxSessionBytes,
		entitlement: 'addon',
		expected_guests: null,
		admin_note: null,
		created_at: at(-2),
		updated_at: at(-2),
		event: {
			slug: CANONICAL_MEMORIES_SLUG,
			title: CANONICAL_MEMORIES_EVENT_TITLE,
			deleted_at: null,
		},
	};
}
