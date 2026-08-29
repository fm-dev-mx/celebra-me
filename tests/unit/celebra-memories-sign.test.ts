import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

Object.defineProperty(globalThis, 'crypto', {
	configurable: true,
	value: webcrypto,
});
import {
	VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN,
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS,
	VALENTINA_MEMORIES_SIGN_PATH,
} from '@/data/valentina-memories-upload.contract';
import { handleMemoriesSignRequest } from '../../workers/celebra-memories-sign/src/index';
import type { MemoriesSignEnv } from '../../workers/celebra-memories-sign/src/env';

const DURING_WINDOW = new Date('2026-08-29T21:45:00.000Z');
const BEFORE_WINDOW = new Date('2026-08-27T05:59:59.999Z');
const AFTER_WINDOW = new Date('2026-09-04T06:00:00.000Z');
const OBJECT_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ROOT = 'workers/celebra-memories-sign/src';
const VALID_CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function createEnv(
	overrides: Partial<MemoriesSignEnv> = {},
	limit = async () => ({ success: true }),
): MemoriesSignEnv {
	return {
		R2_ACCOUNT_ID: 'test-account-id',
		R2_ACCESS_KEY_ID: 'test-access-key-id',
		R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
		R2_BUCKET: 'celebra-memories',
		SIGN_RATE_LIMITER: { limit },
		...overrides,
	};
}

function signRequest(init: {
	method?: string;
	path?: string;
	origin?: string | null;
	body?: unknown;
	ip?: string;
}): Request {
	const headers = new Headers();
	if (init.origin !== null) {
		headers.set('Origin', init.origin ?? VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN);
	}
	if (init.ip) headers.set('CF-Connecting-IP', init.ip);
	if (init.body !== undefined) headers.set('Content-Type', 'application/json');

	return new Request(
		`https://memories.celebra-me.com${init.path ?? VALENTINA_MEMORIES_SIGN_PATH}`,
		{
			method: init.method ?? 'POST',
			headers,
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
		},
	);
}

async function sign(
	init: Parameters<typeof signRequest>[0] = {},
	options: { now?: Date; env?: MemoriesSignEnv } = {},
) {
	return handleMemoriesSignRequest(signRequest(init), options.env ?? createEnv(), {
		now: options.now ?? DURING_WINDOW,
		randomUUID: () => OBJECT_ID,
	});
}

async function readJson(response: Response) {
	return response.json() as Promise<Record<string, unknown>>;
}

function readWorkerSources(): string {
	return ['index.ts', 'http.ts', 'env.ts', 'presign-r2-put.ts']
		.map((file) => readFileSync(path.join(process.cwd(), WORKER_ROOT, file), 'utf8'))
		.join('\n');
}

describe('celebra memories sign worker', () => {
	it('accepts an allowed image request', async () => {
		const response = await sign({
			body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM },
		});
		const body = await readJson(response);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('Vary')).toBe('Origin');
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN,
		);
		expect(body.objectKey).toBe(`${VALENTINA_MEMORIES_OBJECT_PREFIX}${OBJECT_ID}.jpg`);
		expect(body.expiresAt).toBe('2026-08-29T21:50:00.000Z');
		expect(typeof body.uploadUrl).toBe('string');
	});

	it('accepts an allowed video request', async () => {
		const response = await sign({
			body: {
				mimeType: 'video/mp4',
				sizeBytes: 8 * 1024 * 1024,
				checksumSha256: VALID_CHECKSUM,
			},
		});
		const body = await readJson(response);

		expect(response.status).toBe(200);
		expect(body.objectKey).toBe(`${VALENTINA_MEMORIES_OBJECT_PREFIX}${OBJECT_ID}.mp4`);
	});

	it('rejects an unsupported MIME type', async () => {
		const response = await sign({
			body: { mimeType: 'application/pdf', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM },
		});
		const body = await readJson(response);

		expect(response.status).toBe(400);
		expect(body).toMatchObject({ error: { code: 'unsupported_mime' } });
	});

	it('rejects an oversized declared image or video', async () => {
		const image = await sign({
			body: {
				mimeType: 'image/png',
				sizeBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES + 1,
				checksumSha256: VALID_CHECKSUM,
			},
		});
		const video = await sign({
			body: {
				mimeType: 'video/quicktime',
				sizeBytes: VALENTINA_MEMORIES_MAX_VIDEO_BYTES + 1,
				checksumSha256: VALID_CHECKSUM,
			},
		});

		expect(image.status).toBe(400);
		expect(video.status).toBe(400);
		expect(await readJson(image)).toMatchObject({ error: { code: 'file_too_large' } });
		expect(await readJson(video)).toMatchObject({ error: { code: 'file_too_large' } });
	});

	it('rejects malformed or missing fields', async () => {
		const cases = [
			{},
			{ mimeType: 'image/jpeg' },
			{ sizeBytes: 1024 },
			{ mimeType: 'image/jpeg', sizeBytes: 1024, extra: true },
			{
				mimeType: 'image/jpeg',
				sizeBytes: 1024,
				checksumSha256: VALID_CHECKSUM,
				extra: true,
			},
			{ mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: 'not-a-hash' },
			{ mimeType: 'image/jpeg', sizeBytes: 1.5 },
			{ mimeType: 'image/jpeg', sizeBytes: 0 },
			{ mimeType: '', sizeBytes: 1024 },
		];

		for (const body of cases) {
			const response = await sign({ body });
			expect(response.status).toBe(400);
			expect(await readJson(response)).toMatchObject({ error: { code: 'invalid_request' } });
		}
	});

	it('rejects requests before and after the event window', async () => {
		const before = await sign(
			{ body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM } },
			{ now: BEFORE_WINDOW },
		);
		const after = await sign(
			{ body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM } },
			{ now: AFTER_WINDOW },
		);

		expect(before.status).toBe(403);
		expect(after.status).toBe(403);
		expect(await readJson(before)).toMatchObject({ error: { code: 'upload_window_closed' } });
		expect(await readJson(after)).toMatchObject({ error: { code: 'upload_window_closed' } });
	});

	it('rejects a disallowed or missing origin', async () => {
		const disallowed = await sign({
			origin: 'https://celebra-me.com',
			body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM },
		});
		const missing = await sign({
			origin: null,
			body: { mimeType: 'image/jpeg', sizeBytes: 1024 },
		});

		expect(disallowed.status).toBe(403);
		expect(missing.status).toBe(403);
		expect(disallowed.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(await readJson(disallowed)).toMatchObject({ error: { code: 'invalid_origin' } });
		expect(await readJson(missing)).toMatchObject({ error: { code: 'invalid_origin' } });
	});

	it('rejects unsupported methods and routes', async () => {
		const getSign = await sign({ method: 'GET', body: undefined });
		const deleteSign = await sign({ method: 'DELETE', body: undefined });
		const otherRoute = await sign({
			method: 'POST',
			path: '/objects',
			body: { mimeType: 'image/jpeg', sizeBytes: 1024 },
		});
		const listRoute = await sign({ method: 'GET', path: '/', body: undefined });

		expect(getSign.status).toBe(405);
		expect(deleteSign.status).toBe(405);
		expect(getSign.headers.get('Allow')).toBe('OPTIONS, POST');
		expect(otherRoute.status).toBe(404);
		expect(listRoute.status).toBe(404);
	});

	it('accepts CORS preflight only from the production origin', async () => {
		const allowed = await sign({ method: 'OPTIONS', body: undefined });
		const blocked = await sign({
			method: 'OPTIONS',
			origin: 'https://example.com',
			body: undefined,
		});

		expect(allowed.status).toBe(204);
		expect(allowed.headers.get('Access-Control-Allow-Methods')).toBe('OPTIONS, POST');
		expect(blocked.status).toBe(403);
	});

	it('signs a PUT-only URL with bound Content-Type and a 5-minute TTL', async () => {
		const response = await sign({
			body: { mimeType: 'image/webp', sizeBytes: 2048, checksumSha256: VALID_CHECKSUM },
		});
		const body = await readJson(response);
		const uploadUrl = new URL(String(body.uploadUrl));

		expect(uploadUrl.origin).toBe('https://test-account-id.r2.cloudflarestorage.com');
		expect(uploadUrl.pathname).toBe(
			`/celebra-memories/${VALENTINA_MEMORIES_OBJECT_PREFIX}${OBJECT_ID}.webp`,
		);
		expect(uploadUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
		expect(Number(uploadUrl.searchParams.get('X-Amz-Expires'))).toBe(
			VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS,
		);
		expect(Number(uploadUrl.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(300);
		expect(uploadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
		expect(uploadUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
		expect(uploadUrl.href).not.toMatch(/GetObject|DeleteObject|ListObjects|x-id=GET/i);
	});

	it('keeps object keys free of guest PII and uses the contract prefix', async () => {
		const response = await sign({
			body: { mimeType: 'image/heic', sizeBytes: 4096, checksumSha256: VALID_CHECKSUM },
		});
		const body = await readJson(response);

		expect(body.objectKey).toBe(`${VALENTINA_MEMORIES_OBJECT_PREFIX}${OBJECT_ID}.heic`);
		expect(String(body.objectKey)).not.toMatch(/@|phone|whatsapp|rsvp-|guest-/i);
		expect(String(body.objectKey).startsWith(VALENTINA_MEMORIES_OBJECT_PREFIX)).toBe(true);
	});

	it('applies the coarse rate-limit binding', async () => {
		const response = await sign(
			{
				body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM },
				ip: '203.0.113.10',
			},
			{ env: createEnv({}, async () => ({ success: false })) },
		);

		expect(response.status).toBe(429);
		expect(await readJson(response)).toMatchObject({ error: { code: 'rate_limited' } });
	});

	it('exposes no list, read, or delete API surface', async () => {
		const source = readWorkerSources();

		expect(source).not.toMatch(/ListObjects|GetObject|DeleteObject|createMultipartUpload/);
		expect(source).not.toMatch(/bucket\.(list|get|delete)\(/i);
		expect(source).not.toMatch(/method:\s*'GET'|method:\s*'DELETE'/);
		expect(source).toContain("'PUT'");
	});

	it('does not depend on production credentials', async () => {
		const source = readWorkerSources();
		expect(source).not.toMatch(/PUBLIC_R2_|PUBLIC_VALENTINA_MEMORIES/);
		expect(createEnv().R2_ACCESS_KEY_ID).toBe('test-access-key-id');
		expect(createEnv().R2_SECRET_ACCESS_KEY).toBe('test-secret-access-key');
	});

	it('fails closed when the configured bucket is not the contract bucket', async () => {
		const response = await sign(
			{ body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: VALID_CHECKSUM } },
			{ env: createEnv({ R2_BUCKET: 'another-bucket' }) },
		);

		expect(response.status).toBe(500);
		expect(await readJson(response)).toMatchObject({ error: { code: 'sign_failed' } });
	});

	it('binds valid SHA-256 checksum into presigned PUT and rejects malformed checksums', async () => {
		const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
		const valid = await sign({
			body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: validHash },
		});
		expect(valid.status).toBe(200);
		const validBody = await readJson(valid);
		const uploadUrl = new URL(String(validBody.uploadUrl));
		expect(uploadUrl.searchParams.get('X-Amz-Content-Sha256')).toBe(validHash);

		const invalid = await sign({
			body: { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: 'not-a-valid-sha256' },
		});
		expect(invalid.status).toBe(400);
		expect(await readJson(invalid)).toMatchObject({ error: { code: 'invalid_request' } });
	});
});
