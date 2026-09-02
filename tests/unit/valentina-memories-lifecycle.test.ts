import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	canTransitionValentinaMemoriesMedia,
	isValentinaMemoriesSignatureValid,
	isValidSha256Hex,
	parseBoundedVideoDurationSeconds,
	type ValentinaMemoriesMediaPublicItem,
} from '@/data/valentina-memories-media.contract';
import {
	calculateFileSha256Hex,
	generateBulkZipPassphrase,
	optimizeValentinaMemoriesImage,
	partitionMemoriesExport,
} from '@/lib/memories/valentina-memories-client';
import {
	assertValentinaOrganizerAccess,
	listGuestMemoryItems,
	listOrganizerMemoryItems,
} from '@/lib/memories/valentina-memories.service';
import { calculateValentinaMemoriesGuestQuota } from '@/lib/memories/valentina-memories-quota';
import { VALENTINA_MEMORIES_EVENT_ID } from '@/data/valentina-memories-upload.contract';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
	SupabaseHttpError: class SupabaseHttpError extends Error {},
}));
jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
}));
jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	findMembershipByEventForHost: jest.fn(),
}));

import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockFindEvent = findEventBySlugService as jest.Mock;
const mockFindMembership = findMembershipByEventForHost as jest.Mock;
const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('Valentina media lifecycle contracts', () => {
	beforeEach(() => jest.clearAllMocks());

	it('recognizes bounded media signatures and duration metadata', () => {
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(isValentinaMemoriesSignatureValid(jpeg, 'image/jpeg')).toBe(true);
		expect(isValentinaMemoriesSignatureValid(jpeg, 'image/png')).toBe(false);

		const mp4 = new Uint8Array(48);
		const view = new DataView(mp4.buffer);
		view.setUint32(0, 48);
		mp4.set([0x6d, 0x6f, 0x6f, 0x76], 4);
		view.setUint32(8, 40);
		mp4.set([0x6d, 0x76, 0x68, 0x64], 12);
		view.setUint8(16, 0);
		view.setUint32(28, 1000);
		view.setUint32(32, 15_000);
		expect(parseBoundedVideoDurationSeconds(mp4)).toBe(15);
	});

	it('allows technical acceptance once and never restores rejected or deleted media', () => {
		expect(canTransitionValentinaMemoriesMedia('uploading', 'validating')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('validating', 'accepted')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('validating', 'duplicate')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('accepted', 'rejected')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('rejected', 'accepted')).toBe(false);
		expect(canTransitionValentinaMemoriesMedia('deleted', 'validating')).toBe(false);
		expect(isValidSha256Hex(SHA256)).toBe(true);
	});

	it('keeps browser DTOs free of storage, checksum, session, and duplicate identifiers', () => {
		const item: ValentinaMemoriesMediaPublicItem = {
			id: 'public-media-id',
			mimeType: 'image/jpeg',
			sizeBytes: 1,
			durationSeconds: null,
			caption: '',
			status: 'accepted',
			createdAt: '2026-08-29T00:00:00.000Z',
			updatedAt: '2026-08-29T00:00:00.000Z',
			acceptedAt: '2026-08-29T00:00:00.000Z',
			rejectedAt: null,
			deletedAt: null,
		};
		const serialized = JSON.stringify(item);
		expect(serialized).not.toMatch(/objectKey|checksum|sessionId|duplicateOfId/i);
	});

	it('reports remaining guest quota from resident rows without exposing catalog fields', () => {
		const quota = calculateValentinaMemoriesGuestQuota([
			{
				mime_type: 'video/mp4',
				size_bytes: 100,
				status: 'uploading',
				object_deleted_at: null,
			},
			{
				mime_type: 'image/jpeg',
				size_bytes: 200,
				status: 'deleted',
				object_deleted_at: '2026-08-29T00:00:00.000Z',
			},
		]);
		expect(quota.files).toMatchObject({ used: 1, remaining: 19, limit: 20 });
		expect(quota.videos).toMatchObject({ used: 1, remaining: 4, limit: 5 });
		expect(quota.bytes.used).toBe(100);
		expect(quota.inFlight.used).toBe(1);
		expect(JSON.stringify(quota)).not.toMatch(/object_deleted_at|mime_type|session|objectKey/i);
	});

	it('hides deleted guest items without releasing their resident quota', async () => {
		const baseRow = {
			id: 'accepted-id',
			event_key: VALENTINA_MEMORIES_EVENT_ID,
			session_id: 'session-id',
			object_key: 'events/valentina/11111111-1111-4111-8111-111111111111.jpg',
			mime_type: 'image/jpeg',
			size_bytes: 10,
			checksum_sha256: SHA256,
			duration_seconds: null,
			caption: '',
			status: 'accepted',
			duplicate_of_id: null,
			created_at: '2026-08-29T12:00:00.000Z',
			updated_at: '2026-08-29T12:00:00.000Z',
			accepted_at: '2026-08-29T12:00:00.000Z',
			rejected_at: null,
			deleted_at: null,
			idempotency_key: null,
			cleanup_after: null,
			cleanup_claimed_at: null,
			cleanup_lease_id: null,
			object_deleted_at: null,
		};
		mockRestRequest.mockResolvedValue([
			baseRow,
			{
				...baseRow,
				id: 'deleted-id',
				status: 'deleted',
				deleted_at: '2026-08-29T12:01:00.000Z',
			},
		] as never);

		const result = await listGuestMemoryItems({ id: 'session-id' } as never);

		expect(result.items.map((item) => item.id)).toEqual(['accepted-id']);
		expect(result.quota.files.used).toBe(2);
		expect(result.quota.bytes.used).toBe(20);
	});

	it('authorizes only the event owner, including when the caller has another global role', async () => {
		mockFindEvent.mockResolvedValue({ id: 'event-id' });
		mockFindMembership.mockResolvedValueOnce({ membershipRole: 'owner' });
		await expect(
			assertValentinaOrganizerAccess({ userId: 'owner-user', accessToken: 'owner-token' }),
		).resolves.toBeUndefined();

		for (const membership of [
			{ membershipRole: 'manager' },
			{ membershipRole: 'guest' },
			null,
		]) {
			mockFindMembership.mockResolvedValueOnce(membership);
			await expect(
				assertValentinaOrganizerAccess({ userId: 'other-user', accessToken: 'non-owner-token' }),
			).rejects.toMatchObject({ status: 403, code: 'forbidden' });
		}
	});

	it('validates and applies organizer catalog filters before paginating the full relation', async () => {
		mockRestRequest.mockResolvedValue([
			{
				id: 'media-id',
				event_key: VALENTINA_MEMORIES_EVENT_ID,
				session_id: 'session-id',
				object_key: 'events/valentina/11111111-1111-4111-8111-111111111111.jpg',
				mime_type: 'image/jpeg',
				size_bytes: 10,
				checksum_sha256: SHA256,
				duration_seconds: null,
				caption: '',
				status: 'accepted',
				duplicate_of_id: null,
				created_at: '2026-08-29T12:00:00.000Z',
				updated_at: '2026-08-29T12:00:00.000Z',
				accepted_at: '2026-08-29T12:00:00.000Z',
				rejected_at: null,
				deleted_at: null,
				idempotency_key: null,
				cleanup_after: null,
				cleanup_claimed_at: null,
				cleanup_lease_id: null,
				object_deleted_at: null,
				uploader: { display_name: 'Tía Ana', guest_alias: 't-a1' },
			},
		] as never);

		const result = await listOrganizerMemoryItems({
			page: 1,
			status: 'accepted',
			uploader: 'Tía Ana',
			createdFrom: '2026-08-29T06:00:00.000Z',
			createdTo: '2026-08-30T06:00:00.000Z',
		});
		expect(result.items[0].uploader.displayName).toBe('Tía Ana');
		const request = mockRestRequest.mock.calls[0][0];
		const url = new URL(`https://supabase.test/${request.pathWithQuery}`);
		expect(url.searchParams.get('status')).toBe('eq.accepted');
		expect(url.searchParams.get('offset')).toBe('50');
		expect(url.searchParams.get('select')).toContain('valentina_memory_sessions!inner');
		expect(url.searchParams.get('uploader.or')).toContain('display_name.ilike.*Tía Ana*');
		expect(url.searchParams.getAll('created_at')).toEqual([
			'gte.2026-08-29T06:00:00.000Z',
			'lt.2026-08-30T06:00:00.000Z',
		]);
		await expect(
			listOrganizerMemoryItems({ uploader: 'Ana,or(status.eq.deleted)' }),
		).rejects.toMatchObject({ status: 400, code: 'bad_request' });
		await expect(listOrganizerMemoryItems({ status: 'deleted' })).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
		});
		await expect(
			listOrganizerMemoryItems({
				createdFrom: '2026-08-30T00:00:00.000Z',
				createdTo: '2026-08-29T00:00:00.000Z',
			}),
		).rejects.toMatchObject({ status: 400, code: 'bad_request' });
	});

	it('excludes deleted organizer items before pagination by default', async () => {
		mockRestRequest.mockResolvedValue([]);

		await listOrganizerMemoryItems();

		const request = mockRestRequest.mock.calls[0][0];
		const url = new URL(`https://supabase.test/${request.pathWithQuery}`);
		expect(url.searchParams.get('status')).toBe('neq.deleted');
	});

	it('implements atomic quota, deduplication, least privilege, and reclaimable cleanup in SQL', () => {
		const migration = readFileSync(
			path.join(
				process.cwd(),
				'supabase/migrations/20260829000200_valentina_memories_production_readiness.sql',
			),
			'utf8',
		);
		expect(migration).toContain('pg_advisory_xact_lock');
		expect(migration).toContain('reserve_valentina_memory_item');
		expect(migration).toContain('finalize_valentina_memory_item');
		expect(migration).toContain('claim_valentina_memory_cleanup');
		expect(migration).toMatch(/for update skip locked/i);
		expect(migration).toMatch(/REVOKE ALL[\s\S]+FROM public, anon, authenticated/i);
		expect(migration).toMatch(/GRANT EXECUTE[\s\S]+TO service_role/i);
		const videoQuotaMigration = readFileSync(
			path.join(
				process.cwd(),
				'supabase/migrations/20260829171814_valentina_memories_video_quota.sql',
			),
			'utf8',
		);
		expect(videoQuotaMigration).toContain('p_max_session_videos integer');
		expect(videoQuotaMigration).toContain('memories_session_video_quota');
		expect(videoQuotaMigration).not.toMatch(/p_max_session_videos\s*:?=\s*5/i);
	});

	it('hashes in the browser and partitions encrypted exports at canonical limits', async () => {
		await expect(
			calculateFileSha256Hex(new NodeBlob([new Uint8Array([1, 2, 3, 4])]) as unknown as Blob),
		).resolves.toBe('9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a');
		expect(generateBulkZipPassphrase()).toMatch(
			/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
		);
		const items = Array.from({ length: 101 }, (_, index) => ({
			id: `item-${index}`,
			mimeType: 'image/jpeg',
			sizeBytes: 1,
			createdAt: '2026-08-29T00:00:00.000Z',
		}));
		expect(partitionMemoriesExport(items).map((batch) => batch.length)).toEqual([100, 1]);
	});

	it('reorients, bounds, strips source metadata, and releases image resources', async () => {
		const originalCreateImageBitmap = globalThis.createImageBitmap;
		const originalCreateElement = document.createElement.bind(document);
		const close = jest.fn();
		const drawImage = jest.fn();
		const bitmap = { width: 4000, height: 2000, close } as unknown as ImageBitmap;
		const createImageBitmapMock = jest.fn().mockResolvedValue(bitmap);
		Object.defineProperty(globalThis, 'createImageBitmap', {
			configurable: true,
			value: createImageBitmapMock,
		});
		const canvas = {
			width: 0,
			height: 0,
			getContext: jest.fn(() => ({ drawImage })),
			toBlob: (callback: BlobCallback, type?: string) =>
				callback(new Blob([new Uint8Array(10)], { type })),
		} as unknown as HTMLCanvasElement;
		jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
			tagName === 'canvas'
				? canvas
				: originalCreateElement(tagName)) as typeof document.createElement);

		try {
			const source = new File([new Uint8Array(100)], 'photo.jpg', {
				type: 'image/jpeg',
				lastModified: 123,
			});
			const optimized = await optimizeValentinaMemoriesImage(source);
			expect(createImageBitmapMock).toHaveBeenCalledWith(source, {
				imageOrientation: 'from-image',
			});
			expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2560, 1280);
			expect(optimized).not.toBe(source);
			expect(optimized.size).toBe(10);
			expect(optimized.type).toBe('image/jpeg');
			expect(close).toHaveBeenCalledTimes(1);
			expect(canvas.width).toBe(0);
			expect(canvas.height).toBe(0);
		} finally {
			jest.restoreAllMocks();
			Object.defineProperty(globalThis, 'createImageBitmap', {
				configurable: true,
				value: originalCreateImageBitmap,
			});
		}
	});

	it('retains unsupported images and compatible originals when encoding would grow them', async () => {
		const heic = new File([new Uint8Array(10)], 'photo.heic', { type: 'image/heic' });
		await expect(optimizeValentinaMemoriesImage(heic)).resolves.toBe(heic);

		const originalCreateImageBitmap = globalThis.createImageBitmap;
		const originalCreateElement = document.createElement.bind(document);
		Object.defineProperty(globalThis, 'createImageBitmap', {
			configurable: true,
			value: jest.fn().mockResolvedValue({ width: 10, height: 10, close: jest.fn() }),
		});
		const canvas = {
			width: 0,
			height: 0,
			getContext: jest.fn(() => ({ drawImage: jest.fn() })),
			toBlob: (callback: BlobCallback, type?: string) =>
				callback(new Blob([new Uint8Array(20)], { type })),
		} as unknown as HTMLCanvasElement;
		jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
			tagName === 'canvas'
				? canvas
				: originalCreateElement(tagName)) as typeof document.createElement);

		try {
			const jpeg = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
			await expect(optimizeValentinaMemoriesImage(jpeg)).resolves.toBe(jpeg);
		} finally {
			jest.restoreAllMocks();
			Object.defineProperty(globalThis, 'createImageBitmap', {
				configurable: true,
				value: originalCreateImageBitmap,
			});
		}
	});

	it('fails closed when Web Crypto is unavailable', () => {
		const originalCrypto = globalThis.crypto;
		try {
			Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
			expect(() => generateBulkZipPassphrase()).toThrow(/Web Crypto/i);
		} finally {
			Object.defineProperty(globalThis, 'crypto', {
				configurable: true,
				value: originalCrypto,
			});
		}
	});
});
