import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { createCloudinaryMigrationSession } from '../../scripts/provision/cloudinary-adapter';
import {
	uploadOrReconcileCloudinaryAsset,
	buildCloudinaryDeliveryUrl,
} from '../../src/lib/intake/services/cloudinary-assets';

function makeResponse(body: string | Uint8Array, init: ResponseInit = {}): Response {
	const data = Buffer.from(body);
	return {
		ok: (init.status ?? 200) < 400,
		status: init.status ?? 200,
		headers: new Headers(init.headers),
		body: { cancel: async () => undefined },
		arrayBuffer: async () =>
			data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
	} as unknown as Response;
}

describe('migration provider verification and request counts', () => {
	const originalEnv = process.env;
	let bytes: Buffer;
	let sha: string;
	let oldId: string;
	let newId: string;
	const resource = (publicId: string) => ({
		public_id: publicId,
		version: 1,
		width: 2,
		height: 3,
		bytes: bytes.length,
		format: 'png',
		resource_type: 'image',
		created_at: '2026-01-01',
		context: { custom: { sha256: sha } },
		rate_limit_allowed: 500,
		rate_limit_remaining: 450,
		rate_limit_reset_at: new Date(Date.now() + 3600_000),
	});
	const input = () => ({
		targetEnvironment: 'preview' as const,
		eventType: 'xv',
		slug: 'example',
		key: 'hero',
		displayName: 'Hero',
		alt: '',
		bytes,
		sha256: sha,
		mimeType: 'image/png',
		width: 2,
		height: 3,
	});
	beforeEach(async () => {
		jest.clearAllMocks();
		process.env = {
			...originalEnv,
			CLOUDINARY_CLOUD_NAME: 'test',
			CLOUDINARY_API_KEY: 'test-key',
			CLOUDINARY_API_SECRET: 'test-secret',
		};
		bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: 'red' } })
			.png()
			.toBuffer();
		sha = createHash('sha256').update(bytes).digest('hex');
		oldId = `xv/example/assets/hero-${sha.slice(0, 12)}`;
		newId = `preview/${oldId}`;
		jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (String(url).includes('api.cloudinary.com'))
				return makeResponse('{}', {
					headers: {
						'x-featureratelimit-limit': '500',
						'x-featureratelimit-remaining': '499',
						'x-featureratelimit-reset': new Date(Date.now() + 3600_000).toUTCString(),
					},
				});
			return makeResponse(new Uint8Array(bytes), {
				headers: { 'content-type': 'image/png' },
			});
		});
	});
	afterEach(() => {
		jest.restoreAllMocks();
		process.env = originalEnv;
	});

	it.each([true, false])(
		'uses two Admin lookups and two binary downloads (existing=%s)',
		async (existing) => {
			const admin = jest.spyOn(cloudinary.api, 'resource').mockImplementation(async (id) => {
				if (id === newId && !existing) throw { http_code: 404 };
				return resource(id);
			});
			const upload = jest
				.spyOn(cloudinary.uploader, 'upload')
				.mockResolvedValue(resource(newId) as never);
			const session = createCloudinaryMigrationSession();
			await session.quota.beginInvitation(2);
			const source = await session.verifySource({
				publicId: oldId,
				sha256: sha,
				mimeType: 'image/png',
				width: 2,
				height: 3,
			});
			expect(Buffer.from(source.bytes)).toEqual(bytes);
			const result = await session.copy({ ...input(), bytes: source.bytes });
			expect(admin).toHaveBeenCalledTimes(2);
			expect(upload).toHaveBeenCalledTimes(existing ? 0 : 1);
			expect(
				jest
					.mocked(fetch)
					.mock.calls.map(([url]) => String(url))
					.filter((url) => url.includes('res.cloudinary.com')),
			).toEqual([
				buildCloudinaryDeliveryUrl('test', oldId, 'image/png'),
				buildCloudinaryDeliveryUrl('test', newId, 'image/png'),
			]);
			expect(JSON.stringify(result.metadata)).not.toContain('rate_limit');
		},
	);

	it('uses one Admin lookup and one binary download for planning', async () => {
		const admin = jest.spyOn(cloudinary.api, 'resource').mockResolvedValue(resource(oldId));
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(1);
		await session.verifySource({
			publicId: oldId,
			sha256: sha,
			mimeType: 'image/png',
			width: 2,
			height: 3,
		});
		expect(admin).toHaveBeenCalledTimes(1);
		expect(
			jest
				.mocked(fetch)
				.mock.calls.filter(([url]) => String(url).includes('res.cloudinary.com')),
		).toHaveLength(1);
	});

	it('rejects a destination whose decoded dimensions disagree with matching provider metadata', async () => {
		jest.spyOn(cloudinary.api, 'resource').mockResolvedValue({ ...resource(newId), width: 9 });
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(2);
		await expect(session.copy({ ...input(), width: 9 })).rejects.toThrow(
			'delivered dimensions',
		);
	});

	it('validates new-upload metadata before delivery and sanitizes upload rate limits', async () => {
		jest.spyOn(cloudinary.api, 'resource').mockRejectedValue({ http_code: 404 });
		const upload = jest.spyOn(cloudinary.uploader, 'upload').mockResolvedValue({
			...resource(newId),
			context: { custom: { sha256: 'different' } },
		} as never);
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(2);
		await expect(session.copy(input())).rejects.toThrow('SHA-256 context');
		upload.mockRejectedValue({ http_code: 420, request_options: { auth: 'secret' } });
		await expect(session.copy(input())).rejects.toThrow('Cloudinary quota blocked: HTTP 420');
		await expect(session.quota.beforeRequest()).rejects.toThrow('operation stopped');
	});

	it.each([401, 403, 420, 429, 500, undefined])(
		'does not predict absence on authenticated dry-run failure %s',
		async (status) => {
			jest.spyOn(cloudinary.api, 'resource').mockRejectedValue({
				http_code: status,
				request_options: { auth: 'secret' },
				error: { message: 'secret' },
			});
			await expect(
				uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true }),
			).rejects.toThrow('Cloudinary API');
			try {
				await uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true });
			} catch (error) {
				expect(JSON.stringify(error)).not.toContain('secret');
			}
		},
	);

	it('predicts absence only for a confirmed 404', async () => {
		jest.spyOn(cloudinary.api, 'resource').mockRejectedValue({ http_code: 404 });
		expect(
			(await uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true })).metadata
				.predicted,
		).toBe(true);
	});

	it.each(['hash', 'mime', 'dimensions', 'namespace'])(
		'blocks invalid destination %s',
		async (defect) => {
			jest.spyOn(cloudinary.api, 'resource').mockResolvedValue(resource(newId));
			const session = createCloudinaryMigrationSession();
			await session.quota.beginInvitation(2);
			if (defect === 'namespace')
				jest.mocked(cloudinary.api.resource).mockResolvedValue(resource(oldId));
			if (defect === 'hash')
				jest.mocked(fetch).mockResolvedValue(
					makeResponse('changed', { headers: { 'content-type': 'image/png' } }),
				);
			if (defect === 'mime')
				jest.mocked(fetch).mockResolvedValue(
					makeResponse(new Uint8Array(bytes), {
						headers: { 'content-type': 'image/jpeg' },
					}),
				);
			if (defect === 'dimensions')
				jest.mocked(cloudinary.api.resource).mockResolvedValue({
					...resource(newId),
					width: 9,
				});
			await expect(session.copy(input())).rejects.toThrow();
		},
	);
});
