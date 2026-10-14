import { createHash } from 'node:crypto';
import sharp from 'sharp';
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
		json: async () => JSON.parse(data.toString('utf8')),
		arrayBuffer: async () =>
			data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
	} as unknown as Response;
}

const RATE_HEADERS = () => ({
	'x-featureratelimit-limit': '500',
	'x-featureratelimit-remaining': '450',
	'x-featureratelimit-reset': new Date(Date.now() + 3600_000).toUTCString(),
});

/** Admin API body with the rate-limit headers the SDK used to fold into every result. */
function adminResponse(body: unknown, status = 200): Response {
	return makeResponse(JSON.stringify(body), { status, headers: RATE_HEADERS() });
}

const ADMIN_RESOURCE_PATH = '/resources/image/upload/';
const UPLOAD_PATH = '/image/upload';

describe('migration provider verification and request counts', () => {
	const originalEnv = process.env;
	let bytes: Buffer;
	let sha: string;
	let oldId: string;
	let newId: string;
	let adminHandler: (publicId: string) => Promise<Response>;
	let uploadHandler: () => Promise<Response>;
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
	const adminCalls = () =>
		jest.mocked(fetch).mock.calls.filter(([url]) => String(url).includes(ADMIN_RESOURCE_PATH));
	const uploadCalls = () =>
		jest
			.mocked(fetch)
			.mock.calls.filter(
				([url, init]) => String(url).endsWith(UPLOAD_PATH) && init?.method === 'POST',
			);
	const deliveryCalls = () =>
		jest.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('res.cloudinary.com'));

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
		adminHandler = async (publicId) => adminResponse(resource(publicId));
		uploadHandler = async () => adminResponse(resource(newId));
		jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
			const target = String(url);
			if (target.includes('/usage')) return makeResponse('{}', { headers: RATE_HEADERS() });
			if (target.includes(ADMIN_RESOURCE_PATH)) {
				const publicId = decodeURIComponent(
					new URL(target).pathname.split(ADMIN_RESOURCE_PATH)[1] ?? '',
				);
				return adminHandler(publicId);
			}
			if (target.endsWith(UPLOAD_PATH) && init?.method === 'POST') return uploadHandler();
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
			adminHandler = async (publicId) =>
				publicId === newId && !existing
					? adminResponse({ error: { message: 'Not Found' } }, 404)
					: adminResponse(resource(publicId));
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
			expect(adminCalls()).toHaveLength(2);
			expect(uploadCalls()).toHaveLength(existing ? 0 : 1);
			expect(deliveryCalls().map(([url]) => String(url))).toEqual([
				buildCloudinaryDeliveryUrl('test', oldId, 'image/png'),
				buildCloudinaryDeliveryUrl('test', newId, 'image/png'),
			]);
			expect(JSON.stringify(result.metadata)).not.toContain('rate_limit');
		},
	);

	it('signs the upload and never sends the API secret as a field', async () => {
		adminHandler = async () => adminResponse({ error: { message: 'Not Found' } }, 404);
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(2);
		await session.copy(input());
		const [, init] = uploadCalls()[0];
		const form = init?.body as FormData;
		expect(form.get('public_id')).toBe(newId);
		expect(form.get('asset_folder')).toBe('preview/xv/example/assets');
		expect(form.get('overwrite')).toBe('0');
		expect(form.get('unique_filename')).toBe('0');
		expect(form.get('tags')).toBe('managed-invitation,example');
		expect(String(form.get('context'))).toContain(`sha256=${sha}`);
		expect(String(form.get('file'))).toMatch(/^data:image\/png;base64,/);
		expect(form.get('api_key')).toBe('test-key');
		expect(String(form.get('signature'))).toMatch(/^[a-f0-9]{40}$/);
		expect(form.has('api_secret')).toBe(false);
		expect([...form.values()].some((value) => String(value).includes('test-secret'))).toBe(
			false,
		);
	});

	it('uses one Admin lookup and one binary download for planning', async () => {
		adminHandler = async () => adminResponse(resource(oldId));
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(1);
		await session.verifySource({
			publicId: oldId,
			sha256: sha,
			mimeType: 'image/png',
			width: 2,
			height: 3,
		});
		expect(adminCalls()).toHaveLength(1);
		expect(deliveryCalls()).toHaveLength(1);
	});

	it('rejects a destination whose decoded dimensions disagree with matching provider metadata', async () => {
		adminHandler = async () => adminResponse({ ...resource(newId), width: 9 });
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(2);
		await expect(session.copy({ ...input(), width: 9 })).rejects.toThrow(
			'delivered dimensions',
		);
	});

	it('validates new-upload metadata before delivery and sanitizes upload rate limits', async () => {
		adminHandler = async () => adminResponse({ error: { message: 'Not Found' } }, 404);
		uploadHandler = async () =>
			adminResponse({ ...resource(newId), context: { custom: { sha256: 'different' } } });
		const session = createCloudinaryMigrationSession();
		await session.quota.beginInvitation(2);
		await expect(session.copy(input())).rejects.toThrow('SHA-256 context');
		uploadHandler = async () =>
			adminResponse({ error: { message: 'Rate limited; auth secret' } }, 420);
		await expect(session.copy(input())).rejects.toThrow('Cloudinary quota blocked: HTTP 420');
		await expect(session.quota.beforeRequest()).rejects.toThrow('operation stopped');
	});

	it.each([401, 403, 420, 429, 500, undefined])(
		'does not predict absence on authenticated dry-run failure %s',
		async (status) => {
			adminHandler = async () => {
				if (status === undefined) throw new Error('ECONNRESET secret');
				return adminResponse({ error: { message: 'secret' } }, status);
			};
			await expect(
				uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true }),
			).rejects.toThrow('Cloudinary API');
			try {
				await uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true });
			} catch (error) {
				expect(JSON.stringify(error)).not.toContain('secret');
				expect(String((error as Error).message)).not.toContain('secret');
			}
		},
	);

	it('predicts absence only for a confirmed 404', async () => {
		adminHandler = async () => adminResponse({ error: { message: 'Not Found' } }, 404);
		expect(
			(await uploadOrReconcileCloudinaryAsset({ ...input(), dryRun: true })).metadata
				.predicted,
		).toBe(true);
	});

	it.each(['hash', 'mime', 'dimensions', 'namespace'])(
		'blocks invalid destination %s',
		async (defect) => {
			adminHandler = async () => adminResponse(resource(newId));
			const session = createCloudinaryMigrationSession();
			await session.quota.beginInvitation(2);
			if (defect === 'namespace') adminHandler = async () => adminResponse(resource(oldId));
			if (defect === 'dimensions')
				adminHandler = async () => adminResponse({ ...resource(newId), width: 9 });
			const deliveryHandler =
				defect === 'hash'
					? () => makeResponse('changed', { headers: { 'content-type': 'image/png' } })
					: defect === 'mime'
						? () =>
								makeResponse(new Uint8Array(bytes), {
									headers: { 'content-type': 'image/jpeg' },
								})
						: undefined;
			if (deliveryHandler) {
				const previous = jest.mocked(fetch).getMockImplementation();
				jest.mocked(fetch).mockImplementation(async (url, init) =>
					String(url).includes('res.cloudinary.com')
						? deliveryHandler()
						: previous!(url, init),
				);
			}
			await expect(session.copy(input())).rejects.toThrow();
		},
	);
});
