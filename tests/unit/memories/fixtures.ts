/**
 * Shared fixtures for the event memories test suites. Not matched by
 * `testMatch` because the file name does not end with `.test.ts`.
 */

import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';
import type { MediaRow, SessionRow } from '@/lib/memories/server/catalog.repository';

export const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';
export const SESSION_ID = 'a0000000-0000-4000-8000-000000000002';
export const ITEM_ID = 'b0000000-0000-4000-8000-000000000003';
export const OBJECT_ID = 'c0000000-0000-4000-8000-000000000004';
export const CLIENT_REQUEST_ID = 'd0000000-0000-4000-8000-000000000005';
export const OWNER_USER_ID = 'f0000000-0000-4000-8000-000000000006';
export const ADMIN_USER_ID = 'f0000000-0000-4000-8000-000000000007';
export const OTHER_SESSION_ID = 'a0000000-0000-4000-8000-000000000008';

export const PUBLIC_SLUG = 'victoria-y-roberto';
export const GUEST_ALIAS = 'invitado-3f9a1c7e';
export const RECOVERY_CODE = 'ABCD-EFGH-JKLM';

/** SHA-256 of the empty string: a realistic lowercase hex digest. */
export const CHECKSUM_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const OBJECT_KEY = `events/${EVENT_ID}/${OBJECT_ID}.jpg`;

/** Inside the upload window of `buildSpace()`. */
export const NOW = new Date('2026-10-24T12:00:00.000Z');

export function buildSpace(overrides: Partial<MemoriesSpaceRecord> = {}): MemoriesSpaceRecord {
	return {
		eventId: EVENT_ID,
		eventSlug: PUBLIC_SLUG,
		eventTitle: 'Victoria y Roberto',
		publicSlug: PUBLIC_SLUG,
		enabled: true,
		timeZone: 'America/Mazatlan',
		uploadStartsAt: '2026-10-16T07:00:00.000Z',
		uploadEndsAt: '2026-10-31T07:00:00.000Z',
		retentionEndsAt: '2026-12-30T07:00:00.000Z',
		...MEMORIES_LIMIT_PROFILES.standard,
		entitlement: 'package',
		createdAt: '2026-09-01T15:00:00.000Z',
		updatedAt: '2026-09-01T15:00:00.000Z',
		...overrides,
	};
}

export function buildSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
	return {
		id: SESSION_ID,
		event_id: EVENT_ID,
		created_at: '2026-10-24T10:00:00.000Z',
		last_seen_at: '2026-10-24T10:00:00.000Z',
		expires_at: '2026-12-30T07:00:00.000Z',
		revoked_at: null,
		anonymized_at: null,
		display_name: 'Tía Ana',
		guest_alias: GUEST_ALIAS,
		...overrides,
	};
}

export function buildMediaRow(overrides: Partial<MediaRow> = {}): MediaRow {
	return {
		id: ITEM_ID,
		event_id: EVENT_ID,
		session_id: SESSION_ID,
		object_key: OBJECT_KEY,
		mime_type: 'image/jpeg',
		size_bytes: 1_048_576,
		checksum_sha256: CHECKSUM_SHA256,
		duration_seconds: null,
		caption: '',
		status: 'uploading',
		duplicate_of_id: null,
		created_at: '2026-10-24T11:00:00.000Z',
		updated_at: '2026-10-24T11:00:00.000Z',
		accepted_at: null,
		rejected_at: null,
		deleted_at: null,
		idempotency_key: CLIENT_REQUEST_ID,
		cleanup_after: null,
		cleanup_claimed_at: null,
		cleanup_lease_id: null,
		object_deleted_at: null,
		...overrides,
	};
}

export function buildUploadCapability() {
	return {
		uploadUrl: 'https://memories-upload.example.invalid/upload',
		requiredHeaders: {
			Authorization: 'Bearer capability-token-0123456789abcdef',
			'Content-Type': 'image/jpeg',
			'x-amz-checksum-sha256': '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
		},
		expiresAt: '2026-10-24T12:05:00.000Z',
	};
}
