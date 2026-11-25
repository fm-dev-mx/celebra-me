import { describe, expect, it, jest } from '@jest/globals';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';
import type { TargetAssetRecord } from '../../scripts/provision/asset-reconciliation.ts';
import { probeStorageStates } from '../../scripts/provision/invitation-import-engine.ts';

const mockAsset: InvitationPackageAsset = {
	key: 'hero',
	displayName: 'Hero Image',
	defaultAltText: 'Hero',
	bucket: 'invitation-assets',
	storagePath: 'managed/demo/hero.webp',
	mimeType: 'image/webp',
	width: 800,
	height: 600,
	fileSize: 50000,
	validationVersion: 1,
	originalMimeType: 'image/jpeg',
	originalFileSize: 120000,
	sha256: 'a'.repeat(64),
	dataBase64: 'mock',
};

const mockTargetDbRecord: TargetAssetRecord = {
	id: 'asset-1',
	displayName: 'Hero Image',
	storagePath: 'managed/demo/hero.webp',
	bucket: 'invitation-assets',
	mimeType: 'image/webp',
	fileSize: 50000,
	width: 800,
	height: 600,
	validationVersion: 1,
	sha256: 'a'.repeat(64),
};

describe('probeStorageStates', () => {
	it('records present=true when fetch succeeds with 200', async () => {
		const originalFetch = global.fetch;
		const fakeBuffer = new Uint8Array([1, 2, 3]).buffer;
		global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
			ok: true,
			status: 200,
			arrayBuffer: async () => fakeBuffer,
		} as Response);

		try {
			const res = await probeStorageStates(
				[mockAsset],
				[mockTargetDbRecord],
				'https://storage.local',
			);
			expect(res.observedStorage[mockAsset.storagePath]?.present).toBe(true);
			expect(res.observedStorage[mockAsset.storagePath]?.sha256).toBeDefined();
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('records present=false when fetch returns 404 (absent file)', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
			ok: false,
			status: 404,
		} as Response);

		try {
			const res = await probeStorageStates(
				[mockAsset],
				[mockTargetDbRecord],
				'https://storage.local',
			);
			expect(res.observedStorage[mockAsset.storagePath]).toEqual({
				present: false,
				sha256: null,
				httpStatus: 404,
			});
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('records present=false for a new asset when Supabase Storage reports the missing object as HTTP 400', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				statusCode: '404',
				error: 'not_found',
				message: 'Object not found',
			}),
		} as Response);

		try {
			const res = await probeStorageStates([mockAsset], [], 'https://storage.local');
			expect(res.observedStorage[mockAsset.storagePath]).toEqual({
				present: false,
				sha256: null,
				httpStatus: 400,
			});
		} finally {
			global.fetch = originalFetch;
		}
	});

	it.each([
		[
			'a missing bucket',
			async () => ({
				statusCode: '404',
				error: 'Bucket not found',
				message: 'Bucket not found',
			}),
		],
		['an empty JSON body', async () => null],
		[
			'a non-JSON body',
			async () => {
				throw new SyntaxError('Unexpected token <');
			},
		],
	])('records present=unknown on HTTP 400 with %s', async (_label, json) => {
		const originalFetch = global.fetch;
		global.fetch = jest
			.fn<typeof fetch>()
			.mockResolvedValue({ ok: false, status: 400, json } as Response);

		try {
			const res = await probeStorageStates([mockAsset], [], 'https://storage.local');
			expect(res.observedStorage[mockAsset.storagePath]).toEqual({
				present: 'unknown',
				sha256: null,
				httpStatus: 400,
				error: 'HTTP 400',
			});
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('records present=unknown on network error or exception', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest
			.fn<typeof fetch>()
			.mockRejectedValue(new Error('fetch failed (ECONNREFUSED)'));

		try {
			const res = await probeStorageStates(
				[mockAsset],
				[mockTargetDbRecord],
				'https://storage.local',
			);
			expect(res.observedStorage[mockAsset.storagePath]).toEqual({
				present: 'unknown',
				sha256: null,
				error: 'fetch failed (ECONNREFUSED)',
			});
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('records present=unknown on 500 or other non-404 HTTP errors', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
			ok: false,
			status: 503,
		} as Response);

		try {
			const res = await probeStorageStates(
				[mockAsset],
				[mockTargetDbRecord],
				'https://storage.local',
			);
			expect(res.observedStorage[mockAsset.storagePath]).toEqual({
				present: 'unknown',
				sha256: null,
				httpStatus: 503,
				error: 'HTTP 503',
			});
		} finally {
			global.fetch = originalFetch;
		}
	});
});
