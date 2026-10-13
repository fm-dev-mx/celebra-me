jest.mock('@/lib/invitation/access/invitation-access.repository', () => ({
	findInvitationAccessRecord: jest.fn(),
}));

import sharp from 'sharp';
import { GET } from '@/pages/vista-previa/[asset]';
import { findInvitationAccessRecord } from '@/lib/invitation/access/invitation-access.repository';
import { buildPreviewMediaPath } from '@/lib/invitation/preview/preview-media-token';

const findAccess = jest.mocked(findInvitationAccessRecord);
const INVITATION_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE = 'https://abc.supabase.co/storage/v1/object/public/invitation-assets/x/hero.webp';

function accessRecord(paymentStatus: 'paid' | 'unpaid', publicAccess: 'enabled' | 'disabled') {
	return {
		invitationId: INVITATION_ID,
		paymentStatus,
		publicAccess,
		internalNote: null,
		version: 1,
		updatedAt: '2026-10-10T00:00:00Z',
		updatedBy: null,
	};
}

/** Minimal fetch response: the jsdom Response polyfill has no arrayBuffer(). */
function upstream(status: number, bytes?: Buffer) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(bytes ? { 'content-length': String(bytes.byteLength) } : {}),
		arrayBuffer: async () =>
			bytes
				? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
				: new ArrayBuffer(0),
	};
}

/** Body bytes from a real Response or from the jsdom test polyfill (which keeps `body`). */
async function responseBytes(response: Response): Promise<Buffer> {
	if (typeof response.arrayBuffer === 'function')
		return Buffer.from(await response.arrayBuffer());
	return Buffer.from((response as unknown as { body: Uint8Array }).body);
}

function call(path: string) {
	const url = new URL(path, 'https://www.celebra-me.com');
	return GET({
		params: { asset: url.pathname.replace('/vista-previa/', '') },
		url,
		request: new Request(url),
	} as unknown as Parameters<typeof GET>[0]);
}

describe('GET /vista-previa/[asset]', () => {
	const originalFetch = global.fetch;
	const originalSecret = process.env.PREVIEW_MEDIA_SECRET;
	let photo: Buffer;

	beforeAll(async () => {
		process.env.PREVIEW_MEDIA_SECRET = 'test-preview-secret';
		// jsdom lacks AbortSignal.timeout (available in the Node and Vercel runtimes).
		if (typeof AbortSignal.timeout !== 'function') {
			Object.assign(AbortSignal, { timeout: () => new AbortController().signal });
		}
		photo = await sharp({
			create: { width: 640, height: 480, channels: 3, background: { r: 90, g: 120, b: 150 } },
		})
			.webp()
			.toBuffer();
	});
	afterAll(() => {
		global.fetch = originalFetch;
		process.env.PREVIEW_MEDIA_SECRET = originalSecret;
	});
	beforeEach(() => {
		jest.clearAllMocks();
		findAccess.mockResolvedValue(accessRecord('unpaid', 'enabled'));
		global.fetch = jest.fn().mockResolvedValue(upstream(200, photo)) as unknown as typeof fetch;
	});

	const photoPath = () =>
		buildPreviewMediaPath({ invitationId: INVITATION_ID, source: SOURCE, variant: 'photo' });

	it('serves the watermarked photo with a shared, unindexed cache policy', async () => {
		const response = await call(photoPath());

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/webp');
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=86400, s-maxage=2592000',
		);
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex, noimageindex, nofollow');
		expect(global.fetch).toHaveBeenCalledWith(new URL(SOURCE), expect.any(Object));
		const meta = await sharp(await responseBytes(response)).metadata();
		expect([meta.width, meta.height]).toEqual([640, 480]);
	});

	it('serves the social card as a 1200×630 JPEG', async () => {
		const response = await call(
			buildPreviewMediaPath({ invitationId: INVITATION_ID, source: SOURCE, variant: 'og' }),
		);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		const meta = await sharp(await responseBytes(response)).metadata();
		expect([meta.width, meta.height]).toEqual([1200, 630]);
	});

	it.each([
		['paid', accessRecord('paid', 'enabled')],
		['disabled', accessRecord('unpaid', 'disabled')],
		['missing', null],
	])('serves nothing for a %s invitation', async (_label, record) => {
		findAccess.mockResolvedValue(record);
		const response = await call(photoPath());
		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('refuses query strings that would only bust the cache', async () => {
		const response = await call(`${photoPath()}?v=2`);
		expect(response.status).toBe(400);
		expect(findAccess).not.toHaveBeenCalled();
	});

	it('refuses unsealed or foreign-source tokens', async () => {
		expect(
			(await call('/vista-previa/forged-token-value-that-is-long-enough-xx.webp')).status,
		).toBe(404);
		const foreign = buildPreviewMediaPath({
			invitationId: INVITATION_ID,
			source: 'https://evil.example.com/x.webp',
			variant: 'photo',
		});
		expect((await call(foreign)).status).toBe(404);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('answers 502 without caching when the original is unavailable', async () => {
		global.fetch = jest.fn().mockResolvedValue(upstream(404)) as unknown as typeof fetch;
		const response = await call(photoPath());
		expect(response.status).toBe(502);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});
});
