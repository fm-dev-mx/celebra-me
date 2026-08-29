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
	partitionMemoriesExport,
} from '@/lib/memories/valentina-memories-client';
import { assertValentinaOrganizerAccess } from '@/lib/memories/valentina-memories.service';

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

const mockFindEvent = findEventBySlugService as jest.Mock;
const mockFindMembership = findMembershipByEventForHost as jest.Mock;
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

	it('authorizes only the event owner, including when the caller has another global role', async () => {
		mockFindEvent.mockResolvedValue({ id: 'event-id' });
		mockFindMembership.mockResolvedValueOnce({ membershipRole: 'owner' });
		await expect(
			assertValentinaOrganizerAccess({ accessToken: 'owner-token' }),
		).resolves.toBeUndefined();

		for (const membership of [
			{ membershipRole: 'manager' },
			{ membershipRole: 'guest' },
			null,
		]) {
			mockFindMembership.mockResolvedValueOnce(membership);
			await expect(
				assertValentinaOrganizerAccess({ accessToken: 'non-owner-token' }),
			).rejects.toMatchObject({ status: 403, code: 'forbidden' });
		}
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
