import {
	canTransitionValentinaMemoriesMedia,
	isValentinaMemoriesSignatureValid,
	isValidSha256Hex,
	parseBoundedVideoDurationSeconds,
	VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES,
	VALENTINA_MEMORIES_ARCHIVE_MAX_FILES,
} from '@/data/valentina-memories-media.contract';
import {
	calculateFileSha256Hex,
	createEncryptedMemoriesZip,
	generateBulkZipPassphrase,
} from '@/lib/memories/valentina-memories-client';
import {
	assertValentinaOrganizerAccess,
	completeGuestMemoryItem,
	getMediaObjectForPrivateRetrieval,
	registerGuestMemoryItem,
} from '@/lib/memories/valentina-memories.service';

import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
	SupabaseHttpError: class SupabaseHttpError extends Error {
		constructor(
			public readonly status: number,
			public readonly body: string,
			public readonly code: string | null,
		) {
			super(body);
		}
	},
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	findMembershipByEventForHost: jest.fn(),
}));

jest.mock('@/lib/memories/valentina-memories-retrieval', () => ({
	inspectValentinaMemoryObject: jest.fn(),
	retrieveValentinaMemoryObject: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { inspectValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';

const mockSupabase = supabaseRestRequest as jest.Mock;
const mockFindEvent = findEventBySlugService as jest.Mock;
const mockFindMembership = findMembershipByEventForHost as jest.Mock;
const mockInspect = inspectValentinaMemoryObject as jest.Mock;

const SESSION_ROW = {
	id: '11111111-1111-4111-8111-111111111111',
	event_key: 'valentina',
	token_hash: 'tokenhash',
	recovery_code_hash: 'rechash',
	created_at: new Date().toISOString(),
	last_seen_at: new Date().toISOString(),
	expires_at: new Date(Date.now() + 86400000).toISOString(),
	revoked_at: null,
};

const SAMPLE_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SAMPLE_OBJECT_KEY = 'events/valentina/550e8400-e29b-41d4-a716-446655440000.jpg';

describe('Valentina Media Lifecycle & Contracts', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Bounded Signature Validation (Magic Bytes)', () => {
		it('identifies JPEG magic bytes', () => {
			const jpeg = new Uint8Array([
				0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
			]);
			expect(isValentinaMemoriesSignatureValid(jpeg, 'image/jpeg')).toBe(true);
			expect(isValentinaMemoriesSignatureValid(jpeg, 'image/png')).toBe(false);
		});

		it('identifies PNG magic bytes', () => {
			const png = new Uint8Array([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
			]);
			expect(isValentinaMemoriesSignatureValid(png, 'image/png')).toBe(true);
			expect(isValentinaMemoriesSignatureValid(png, 'image/jpeg')).toBe(false);
		});

		it('identifies WebP magic bytes (RIFF...WEBP)', () => {
			const webp = new Uint8Array([
				0x52,
				0x49,
				0x46,
				0x46, // RIFF
				0x20,
				0x00,
				0x00,
				0x00,
				0x57,
				0x45,
				0x42,
				0x50, // WEBP
			]);
			expect(isValentinaMemoriesSignatureValid(webp, 'image/webp')).toBe(true);
			expect(isValentinaMemoriesSignatureValid(webp, 'image/png')).toBe(false);
		});

		it('identifies MP4 / ISO BMFF container magic bytes', () => {
			const mp4 = new Uint8Array([
				0x00,
				0x00,
				0x00,
				0x20, // length = 32
				0x66,
				0x74,
				0x79,
				0x70, // 'ftyp'
				0x69,
				0x73,
				0x6f,
				0x6d, // 'isom'
			]);
			expect(isValentinaMemoriesSignatureValid(mp4, 'video/mp4')).toBe(true);
		});

		it('identifies HEIC container magic bytes', () => {
			const heic = new Uint8Array([
				0x00,
				0x00,
				0x00,
				0x20,
				0x66,
				0x74,
				0x79,
				0x70, // 'ftyp'
				0x68,
				0x65,
				0x69,
				0x63, // 'heic'
			]);
			expect(isValentinaMemoriesSignatureValid(heic, 'image/heic')).toBe(true);
		});

		it('rejects short or corrupted byte sequences', () => {
			expect(
				isValentinaMemoriesSignatureValid(new Uint8Array([0x00, 0x01]), 'image/jpeg'),
			).toBe(false);
			expect(isValentinaMemoriesSignatureValid(new Uint8Array(12), 'image/jpeg')).toBe(false);
		});
	});

	describe('Bounded Video Container Duration Parsing', () => {
		it('parses duration from an MP4 moov/mvhd atom (version 0)', () => {
			const buffer = new Uint8Array(48);
			const view = new DataView(buffer.buffer);
			view.setUint32(0, 48);
			buffer[4] = 0x6d;
			buffer[5] = 0x6f;
			buffer[6] = 0x6f;
			buffer[7] = 0x76; // 'moov'

			view.setUint32(8, 40);
			buffer[12] = 0x6d;
			buffer[13] = 0x76;
			buffer[14] = 0x68;
			buffer[15] = 0x64; // 'mvhd'
			view.setUint8(16, 0); // version 0
			view.setUint32(28, 1000); // timescale = 1000 Hz
			view.setUint32(32, 15000); // duration = 15000 ms -> 15.0 seconds

			const parsed = parseBoundedVideoDurationSeconds(buffer);
			expect(parsed).toBe(15);
		});

		it('returns null for malformed or truncated video headers', () => {
			expect(parseBoundedVideoDurationSeconds(new Uint8Array(16))).toBeNull();
		});

		it('parses a moov atom from a tail range with a partial leading atom', () => {
			const buffer = new Uint8Array(64);
			const view = new DataView(buffer.buffer);
			const moovOffset = 16;
			view.setUint32(moovOffset, 48);
			buffer.set([0x6d, 0x6f, 0x6f, 0x76], moovOffset + 4);
			view.setUint32(moovOffset + 8, 40);
			buffer.set([0x6d, 0x76, 0x68, 0x64], moovOffset + 12);
			view.setUint8(moovOffset + 16, 0);
			view.setUint32(moovOffset + 28, 1000);
			view.setUint32(moovOffset + 32, 15000);

			expect(parseBoundedVideoDurationSeconds(buffer)).toBe(15);
		});
	});

	describe('State Transitions & Status Invariants', () => {
		it('enforces canonical transitions including duplicate and rejected', () => {
			expect(canTransitionValentinaMemoriesMedia('uploading', 'validating')).toBe(true);
			expect(canTransitionValentinaMemoriesMedia('validating', 'accepted')).toBe(true);
			expect(canTransitionValentinaMemoriesMedia('validating', 'duplicate')).toBe(true);
			expect(canTransitionValentinaMemoriesMedia('validating', 'rejected')).toBe(true);
			expect(canTransitionValentinaMemoriesMedia('duplicate', 'deleted')).toBe(true);
			expect(canTransitionValentinaMemoriesMedia('accepted', 'uploading')).toBe(false);
			expect(canTransitionValentinaMemoriesMedia('duplicate', 'accepted')).toBe(false);
		});

		it('validates SHA-256 hex format', () => {
			expect(isValidSha256Hex(SAMPLE_SHA256)).toBe(true);
			expect(isValidSha256Hex('12345')).toBe(false);
			expect(isValidSha256Hex('')).toBe(false);
			expect(isValidSha256Hex(null)).toBe(false);
		});
	});

	describe('Registration', () => {
		it('creates new item and stores checksumSha256', async () => {
			mockSupabase
				.mockResolvedValueOnce([]) // existing count
				.mockResolvedValueOnce([
					{
						id: '33333333-3333-4333-8333-333333333333',
						event_key: 'valentina',
						session_id: SESSION_ROW.id,
						object_key: SAMPLE_OBJECT_KEY,
						mime_type: 'image/jpeg',
						size_bytes: 2048,
						checksum_sha256: SAMPLE_SHA256,
						duration_seconds: null,
						caption: '',
						status: 'uploading',
						duplicate_of_id: null,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						accepted_at: null,
						rejected_at: null,
						deleted_at: null,
					},
				])
				.mockResolvedValueOnce([]); // audit log

			const item = await registerGuestMemoryItem({
				session: SESSION_ROW,
				objectKey: SAMPLE_OBJECT_KEY,
				mimeType: 'image/jpeg',
				sizeBytes: 2048,
				checksumSha256: SAMPLE_SHA256,
			});

			expect(item.id).toBe('33333333-3333-4333-8333-333333333333');
			expect(item.checksumSha256).toBe(SAMPLE_SHA256);
		});

		it('requires a SHA-256 checksum', async () => {
			await expect(
				registerGuestMemoryItem({
					session: SESSION_ROW,
					objectKey: SAMPLE_OBJECT_KEY,
					mimeType: 'image/jpeg',
					sizeBytes: 2048,
					checksumSha256: '',
				}),
			).rejects.toMatchObject({ status: 400, code: 'bad_request' });
		});
	});

	describe('Automatic Acceptance, Validation & Deduplication', () => {
		const uploadingRow = {
			id: 'item-1',
			event_key: 'valentina',
			session_id: SESSION_ROW.id,
			object_key: SAMPLE_OBJECT_KEY,
			mime_type: 'image/jpeg',
			size_bytes: 1024,
			checksum_sha256: SAMPLE_SHA256,
			duration_seconds: null,
			caption: '',
			status: 'uploading',
			duplicate_of_id: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			accepted_at: null,
			rejected_at: null,
			deleted_at: null,
		};

		it('automatically accepts item when technical validation succeeds and content is unique', async () => {
			mockSupabase
				.mockResolvedValueOnce([uploadingRow]) // findMediaById
				.mockResolvedValueOnce([{ ...uploadingRow, status: 'validating' }]) // claim validation
				.mockResolvedValueOnce([]) // appendAudit
				.mockResolvedValueOnce([]) // check existing accepted duplicate
				.mockResolvedValueOnce([
					{ ...uploadingRow, status: 'accepted', accepted_at: new Date().toISOString() },
				]) // accept
				.mockResolvedValueOnce([]); // audit log

			mockInspect.mockResolvedValueOnce({
				exists: true,
				sizeBytes: 1024,
				checksumSha256: SAMPLE_SHA256,
				signatureValid: true,
				durationSeconds: null,
			});

			const result = await completeGuestMemoryItem({
				session: SESSION_ROW,
				mediaItemId: 'item-1',
			});

			expect(result.status).toBe('accepted');
			expect(result.acceptedAt).toBeTruthy();
		});

		it('resumes inspection from validating without claiming the item again', async () => {
			const validatingRow = { ...uploadingRow, status: 'validating' as const };
			mockSupabase
				.mockResolvedValueOnce([validatingRow]) // findMediaById
				.mockResolvedValueOnce([]) // check existing accepted duplicate
				.mockResolvedValueOnce([
					{ ...validatingRow, status: 'accepted', accepted_at: new Date().toISOString() },
				]) // accept
				.mockResolvedValueOnce([]); // audit log
			mockInspect.mockResolvedValueOnce({
				exists: true,
				sizeBytes: 1024,
				checksumSha256: SAMPLE_SHA256,
				signatureValid: true,
				durationSeconds: null,
			});

			await expect(
				completeGuestMemoryItem({ session: SESSION_ROW, mediaItemId: 'item-1' }),
			).resolves.toMatchObject({ status: 'accepted' });
			expect(mockSupabase.mock.calls[1]?.[0]?.method).toBeUndefined();
		});

		it('atomically transitions to duplicate when an exact checksum is already accepted', async () => {
			const existingAcceptedRow = {
				id: 'item-winner',
				event_key: 'valentina',
				checksum_sha256: SAMPLE_SHA256,
				status: 'accepted',
			};

			mockSupabase
				.mockResolvedValueOnce([uploadingRow]) // findMediaById
				.mockResolvedValueOnce([{ ...uploadingRow, status: 'validating' }]) // claim validation
				.mockResolvedValueOnce([]) // audit
				.mockResolvedValueOnce([existingAcceptedRow]) // duplicate check returns existing accepted item!
				.mockResolvedValueOnce([
					{
						...uploadingRow,
						status: 'duplicate',
						duplicate_of_id: 'item-winner',
					},
				])
				.mockResolvedValueOnce([]); // audit

			mockInspect.mockResolvedValueOnce({
				exists: true,
				sizeBytes: 1024,
				checksumSha256: SAMPLE_SHA256,
				signatureValid: true,
				durationSeconds: null,
			});

			const result = await completeGuestMemoryItem({
				session: SESSION_ROW,
				mediaItemId: 'item-1',
			});

			expect(result.status).toBe('duplicate');
			expect(result.duplicateOfId).toBe('item-winner');
		});

		it('fails closed and rejects item when bounded signature inspection fails', async () => {
			mockSupabase
				.mockResolvedValueOnce([uploadingRow]) // findMediaById
				.mockResolvedValueOnce([{ ...uploadingRow, status: 'validating' }]) // claim validation
				.mockResolvedValueOnce([]) // audit
				.mockResolvedValueOnce([
					{
						...uploadingRow,
						status: 'rejected',
						rejected_at: new Date().toISOString(),
					},
				])
				.mockResolvedValueOnce([]); // audit

			mockInspect.mockResolvedValueOnce({
				exists: true,
				sizeBytes: 1024,
				checksumSha256: SAMPLE_SHA256,
				signatureValid: false, // INVALID MAGIC BYTES
				durationSeconds: null,
			});

			const result = await completeGuestMemoryItem({
				session: SESSION_ROW,
				mediaItemId: 'item-1',
			});

			expect(result.status).toBe('rejected');
			expect(result.rejectedAt).toBeTruthy();
		});

		it('does not overwrite an item deleted during inspection', async () => {
			const deletedRow = {
				...uploadingRow,
				status: 'deleted',
				deleted_at: new Date().toISOString(),
			};
			mockSupabase
				.mockResolvedValueOnce([uploadingRow])
				.mockResolvedValueOnce([{ ...uploadingRow, status: 'validating' }])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([deletedRow]);
			mockInspect.mockResolvedValueOnce({
				exists: true,
				sizeBytes: 1024,
				checksumSha256: SAMPLE_SHA256,
				signatureValid: true,
				durationSeconds: null,
			});

			await expect(
				completeGuestMemoryItem({ session: SESSION_ROW, mediaItemId: 'item-1' }),
			).resolves.toMatchObject({ status: 'deleted' });
			expect(String(mockSupabase.mock.calls[4]?.[0]?.pathWithQuery)).toContain(
				'status=eq.validating',
			);
		});
	});

	describe('Organizer Authorization & Private Retrieval Security', () => {
		it('allows organizer owner access', async () => {
			mockFindEvent.mockResolvedValueOnce({ id: 'event-1' });
			mockFindMembership.mockResolvedValueOnce({ membershipRole: 'owner' });

			await expect(
				assertValentinaOrganizerAccess({ accessToken: 'host-token', isSuperAdmin: false }),
			).resolves.toBeUndefined();
		});

		it('allows superadmin break-glass access', async () => {
			mockFindEvent.mockResolvedValueOnce({ id: 'event-1' });

			await expect(
				assertValentinaOrganizerAccess({ accessToken: 'admin-token', isSuperAdmin: true }),
			).resolves.toBeUndefined();
		});

		it.each([
			{ label: 'manager', membership: { membershipRole: 'manager' } },
			{ label: 'guest', membership: { membershipRole: 'guest' } },
			{ label: 'non-member', membership: null },
		])('blocks $label organizer access', async ({ membership }) => {
			mockFindEvent.mockResolvedValueOnce({ id: 'event-1' });
			mockFindMembership.mockResolvedValueOnce(membership);

			await expect(
				assertValentinaOrganizerAccess({
					accessToken: 'blocked-token',
					isSuperAdmin: false,
				}),
			).rejects.toMatchObject({ status: 403, code: 'forbidden' });
		});

		it('blocks retrieval of duplicate, rejected, or unaccepted items from organizer', async () => {
			const duplicateRow = {
				id: 'item-dup',
				event_key: 'valentina',
				session_id: 'session-other',
				object_key: SAMPLE_OBJECT_KEY,
				mime_type: 'image/jpeg',
				size_bytes: 1024,
				checksum_sha256: SAMPLE_SHA256,
				status: 'duplicate',
				caption: '',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				accepted_at: null,
				rejected_at: null,
				deleted_at: null,
			};

			mockSupabase.mockResolvedValueOnce([duplicateRow]);

			await expect(getMediaObjectForPrivateRetrieval('item-dup')).rejects.toThrow(
				/no disponible/i,
			);
		});

		it('isolates guest retrieval to own session items', async () => {
			const guestRow = {
				id: 'item-guest',
				event_key: 'valentina',
				session_id: 'session-owner-1',
				object_key: SAMPLE_OBJECT_KEY,
				mime_type: 'image/jpeg',
				size_bytes: 1024,
				checksum_sha256: SAMPLE_SHA256,
				status: 'validating',
				caption: '',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				accepted_at: null,
				rejected_at: null,
				deleted_at: null,
			};

			mockSupabase.mockResolvedValueOnce([guestRow]);

			await expect(
				getMediaObjectForPrivateRetrieval('item-guest', 'session-foreign-2'),
			).rejects.toThrow(/no encontrado/i);
		});
	});

	describe('Client-Side Encrypted Bulk Export & Archive Limits', () => {
		it('generates a 16-character format passphrase locally', () => {
			const pass = generateBulkZipPassphrase();
			expect(pass).toMatch(
				/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
			);
		});

		it('calculates SHA-256 in the browser without server roundtrip', async () => {
			const file = new File([new Uint8Array([1, 2, 3, 4])], 'test.jpg', {
				type: 'image/jpeg',
			});
			const hash = await calculateFileSha256Hex(file);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});

		it('enforces the 100-file archive limit', async () => {
			const items = Array.from(
				{ length: VALENTINA_MEMORIES_ARCHIVE_MAX_FILES + 1 },
				(_, i) => ({
					id: `item-${i}`,
					mimeType: 'image/jpeg',
					sizeBytes: 100,
					createdAt: new Date().toISOString(),
				}),
			);

			await expect(
				createEncryptedMemoriesZip({
					items,
					passphrase: 'TEST-PASS-WORD-1234',
					fetchItemBlob: async () => new Blob(['x']),
				}),
			).rejects.toThrow(/supera el límite de 100 archivos/i);
		});

		it('enforces the 128 MiB archive size limit', async () => {
			const items = [
				{
					id: 'huge-item',
					mimeType: 'video/mp4',
					sizeBytes: VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES + 1,
					createdAt: new Date().toISOString(),
				},
			];

			await expect(
				createEncryptedMemoriesZip({
					items,
					passphrase: 'TEST-PASS-WORD-1234',
					fetchItemBlob: async () => new Blob(['x']),
				}),
			).rejects.toThrow(/supera el límite de 128 MiB/i);
		});
	});
});
