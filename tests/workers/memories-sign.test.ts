import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { MEMORIES_PRESIGN_TTL_SECONDS } from '@/lib/memories/contract/limits';
import {
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
} from '@/lib/memories/contract/media-policy';
import { buildMemoriesObjectKey } from '@/lib/memories/contract/object-key';
import {
	MEMORIES_SIGN_PATH,
	MEMORIES_UPLOAD_PATH,
	MEMORIES_UPLOAD_REQUEST_AUDIENCE,
} from '@/lib/memories/contract/private-request';
import { createMemoriesPrivateRequestHeaders } from '@/lib/memories/server/private-request';
import signWorker, {
	handleMemoriesSignRequest,
	handleMemoriesUploadRequest,
} from '../../workers/celebra-memories-sign/src/index';
import type { MemoriesSignEnv } from '../../workers/celebra-memories-sign/src/env';
import {
	createUploadCapability,
	verifyUploadCapability,
} from '../../workers/celebra-memories-sign/src/capability';
import { decodeBase64, encodeBase64Url, sha256HexToBase64 } from '../../workers/shared/encoding';
import { parseAllowedOrigins, parseStorageTarget } from '../../workers/shared/http';
import { TestFixedLengthStream, streamOf } from './memories-stack';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

Object.defineProperty(globalThis, 'FixedLengthStream', {
	configurable: true,
	value: TestFixedLengthStream,
});

const NOW = new Date('2026-10-03T21:45:00.000Z');
const SIGNING_KEY_ENV = 'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY';
const WORKER_ORIGIN = 'https://memories.celebra-me.com';
const ALLOWED_ORIGIN = 'https://www.celebra-me.com';
const SECRET = 'test-capability-secret';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const OBJECT_KEY = buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'jpg');
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const EMPTY_SHA256_BASE64 = '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
const FOUR_BYTES = new Uint8Array([1, 2, 3, 4]);
const FOUR_BYTES_SHA256 = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a';
const NONCE = 'upload-nonce-123456';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

type Bucket = MemoriesSignEnv['MEMORIES_BUCKET'];
type NonceGuard = NonNullable<MemoriesSignEnv['NONCE_GUARD']>;

function createNonceGuard(replayKeys: Set<string>): NonceGuard {
	return {
		idFromName: (name: string) => ({ toString: () => name }),
		get: () => ({
			fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
				const claim = JSON.parse(String(init?.body)) as { key: string };
				if (replayKeys.has(claim.key)) return new Response(null, { status: 409 });
				replayKeys.add(claim.key);
				return new Response(null, { status: 204 });
			},
		}),
	};
}

function createHarness(options: { limitSuccess?: boolean; env?: Partial<MemoriesSignEnv> } = {}) {
	const replayKeys = new Set<string>();
	const put = jest.fn<Promise<unknown>, Parameters<Bucket['put']>>(() => Promise.resolve({}));
	const limit = jest.fn<Promise<{ success: boolean }>, [{ key: string }]>(() =>
		Promise.resolve({ success: options.limitSuccess ?? true }),
	);
	const env: MemoriesSignEnv = {
		MEMORIES_BUCKET: {
			put,
			get: jest.fn<Promise<null>, Parameters<Bucket['get']>>(() => Promise.resolve(null)),
			delete: jest.fn<Promise<void>, Parameters<Bucket['delete']>>(() => Promise.resolve()),
		},
		NONCE_GUARD: createNonceGuard(replayKeys),
		MEMORIES_UPLOAD_CAPABILITY_SECRET: SECRET,
		MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: PUBLIC_KEY,
		MEMORIES_STORAGE_TARGET: 'production',
		MEMORIES_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
		SIGN_RATE_LIMITER: { limit },
		...options.env,
	};
	return { env, put, limit, replayKeys };
}

type Harness = ReturnType<typeof createHarness>;

function fakeRequest(init: {
	method: string;
	url: string;
	headers?: HeadersInit;
	body?: Uint8Array | string | null;
}): Request {
	const body = init.body === null ? null : streamOf(init.body ?? '');
	return {
		method: init.method,
		url: init.url,
		headers: new Headers(init.headers),
		body,
	} as unknown as Request;
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		objectKey: OBJECT_KEY,
		sessionId: SESSION_ID,
		mimeType: 'image/jpeg',
		sizeBytes: 1024,
		checksumSha256: EMPTY_SHA256,
		...overrides,
	};
}

type SignOptions = {
	signedAt?: Date;
	audience?: string;
	requestId?: string;
	mutateBodyAfterSigning?: boolean;
};

function signedSignRequest(body: Record<string, unknown>, options: SignOptions = {}): Request {
	const rawBody = JSON.stringify(body);
	const headers = createMemoriesPrivateRequestHeaders({
		audience: options.audience ?? MEMORIES_UPLOAD_REQUEST_AUDIENCE,
		method: 'POST',
		path: MEMORIES_SIGN_PATH,
		body: rawBody,
		privateKeyEnvName: SIGNING_KEY_ENV,
		requestId: options.requestId,
		now: options.signedAt ?? NOW,
	});
	return fakeRequest({
		method: 'POST',
		url: `${WORKER_ORIGIN}${MEMORIES_SIGN_PATH}`,
		headers,
		body: options.mutateBodyAfterSigning ? `${rawBody} ` : rawBody,
	});
}

async function sign(
	body: Record<string, unknown>,
	options: SignOptions & { harness?: Harness; now?: Date } = {},
): Promise<Response> {
	const harness = options.harness ?? createHarness();
	return handleMemoriesSignRequest(signedSignRequest(body, options), harness.env, {
		now: options.now ?? NOW,
	});
}

async function issueCapability(
	overrides: Partial<Parameters<typeof createUploadCapability>[0]> = {},
	secret = SECRET,
) {
	return createUploadCapability(
		{
			objectKey: OBJECT_KEY,
			sessionId: SESSION_ID,
			mimeType: 'image/jpeg',
			sizeBytes: FOUR_BYTES.byteLength,
			checksumSha256: FOUR_BYTES_SHA256,
			nonce: NONCE,
			...overrides,
		},
		secret,
		NOW,
	);
}

function uploadRequest(
	token: string,
	overrides: {
		origin?: string | null;
		headers?: Record<string, string>;
		bytes?: Uint8Array | null;
		method?: string;
	} = {},
): Request {
	const bytes = overrides.bytes === undefined ? FOUR_BYTES : overrides.bytes;
	const headers = new Headers({
		Authorization: `Bearer ${token}`,
		'Content-Type': 'image/jpeg',
		'x-amz-checksum-sha256': sha256HexToBase64(FOUR_BYTES_SHA256),
		'Content-Length': String(bytes?.byteLength ?? 0),
		...overrides.headers,
	});
	if (overrides.origin !== null) headers.set('Origin', overrides.origin ?? ALLOWED_ORIGIN);
	return {
		method: overrides.method ?? 'PUT',
		url: `${WORKER_ORIGIN}${MEMORIES_UPLOAD_PATH}`,
		headers,
		body: bytes ? streamOf(bytes) : null,
	} as unknown as Request;
}

function drainOnPut(harness: Harness): void {
	harness.put.mockImplementation(async (...args) => {
		const reader = (args[1] as ReadableStream<Uint8Array>).getReader();
		while (!(await reader.read()).done) {
			// Drain the fixed-length stream to exercise the byte-counting boundary.
		}
		return {};
	});
}

function flipByte(token: string, index: number): string {
	const bytes = decodeBase64(token);
	bytes[index] ^= 0x01;
	return encodeBase64Url(bytes);
}

async function errorCode(response: Response): Promise<unknown> {
	return response.json();
}

beforeAll(() => {
	process.env[SIGNING_KEY_ENV] = PRIVATE_KEY;
});

afterAll(() => {
	delete process.env[SIGNING_KEY_ENV];
});

describe('memories sign worker: /sign', () => {
	it('issues an opaque five-minute capability for the /upload route without exposing the key', async () => {
		const response = await sign(validBody());
		const body = (await response.json()) as {
			uploadUrl: string;
			requiredHeaders: Record<string, string>;
			expiresAt: string;
			objectKey?: unknown;
		};

		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(body.objectKey).toBeUndefined();
		expect(body.expiresAt).toBe(
			new Date(NOW.getTime() + MEMORIES_PRESIGN_TTL_SECONDS * 1000).toISOString(),
		);
		expect(body.requiredHeaders).toEqual({
			Authorization: expect.stringMatching(/^Bearer [A-Za-z0-9_-]+$/),
			'Content-Type': 'image/jpeg',
			'x-amz-checksum-sha256': EMPTY_SHA256_BASE64,
		});

		const uploadUrl = new URL(body.uploadUrl);
		expect(uploadUrl.origin).toBe(WORKER_ORIGIN);
		expect(uploadUrl.pathname).toBe(MEMORIES_UPLOAD_PATH);
		expect(uploadUrl.search).toBe('');

		const token = body.requiredHeaders.Authorization.slice('Bearer '.length);
		expect(token).not.toContain('.');
		await expect(verifyUploadCapability(token, SECRET, NOW)).resolves.toMatchObject({
			objectKey: OBJECT_KEY,
			sessionId: SESSION_ID,
			mimeType: 'image/jpeg',
			sizeBytes: 1024,
			checksumSha256: EMPTY_SHA256,
		});
	});

	it('does not enforce an upload window: the app decides that before signing', async () => {
		const farAway = new Date('2027-06-15T03:00:00.000Z');
		const response = await sign(validBody(), { signedAt: farAway, now: farAway });
		expect(response.status).toBe(200);
	});

	it('rejects unsigned, wrong-audience, stale, future-dated and tampered envelopes with a code-only body', async () => {
		const unsigned = handleMemoriesSignRequest(
			fakeRequest({
				method: 'POST',
				url: `${WORKER_ORIGIN}${MEMORIES_SIGN_PATH}`,
				body: JSON.stringify(validBody()),
			}),
			createHarness().env,
			{ now: NOW },
		);
		const responses = await Promise.all([
			unsigned,
			sign(validBody(), { audience: 'wrong-audience' }),
			sign(validBody(), { signedAt: new Date(NOW.getTime() - 61_000) }),
			sign(validBody(), { signedAt: new Date(NOW.getTime() + 61_000) }),
			sign(validBody(), { mutateBodyAfterSigning: true }),
		]);

		for (const response of responses) {
			expect(response.status).toBe(401);
			expect(await errorCode(response)).toEqual({ error: { code: 'unauthorized' } });
		}
	});

	it('rejects a replayed private request id even when the signature is valid', async () => {
		const harness = createHarness();
		const first = await sign(validBody(), { harness, requestId: REQUEST_ID });
		const replay = await sign(validBody(), { harness, requestId: REQUEST_ID });

		expect(first.status).toBe(200);
		expect(replay.status).toBe(409);
		expect(await errorCode(replay)).toEqual({ error: { code: 'replay' } });
		expect(harness.replayKeys).toEqual(new Set([`private:${REQUEST_ID}`]));
	});

	it('rejects malformed payloads, legacy prefixes, MIME/key mismatches and unsupported MIME types', async () => {
		const cases: Array<[string, Record<string, unknown>]> = [
			['extra field', validBody({ extra: true })],
			[
				'missing field',
				{
					objectKey: OBJECT_KEY,
					sessionId: SESSION_ID,
					mimeType: 'image/jpeg',
					sizeBytes: 1,
				},
			],
			['legacy event prefix', validBody({ objectKey: `events/valentina/${OBJECT_ID}.jpg` })],
			[
				'key outside events/',
				validBody({ objectKey: `uploads/${EVENT_ID}/${OBJECT_ID}.jpg` }),
			],
			[
				'MIME/key mismatch',
				validBody({ objectKey: buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'png') }),
			],
			[
				'unsupported MIME',
				validBody({
					mimeType: 'application/pdf',
					objectKey: buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'pdf'),
				}),
			],
			['non-UUID session', validBody({ sessionId: 'session-1' })],
			['zero size', validBody({ sizeBytes: 0 })],
			['fractional size', validBody({ sizeBytes: 10.5 })],
			['invalid checksum', validBody({ checksumSha256: 'not-hex' })],
		];

		for (const [label, body] of cases) {
			const response = await sign(body);
			expect([label, response.status]).toEqual([label, 400]);
			expect(await errorCode(response)).toEqual({ error: { code: 'invalid_request' } });
		}
	});

	it('bounds the JSON body before any cryptography runs', async () => {
		const oversized = fakeRequest({
			method: 'POST',
			url: `${WORKER_ORIGIN}${MEMORIES_SIGN_PATH}`,
			body: JSON.stringify(validBody({ padding: 'x'.repeat(4096) })),
		});
		const response = await handleMemoriesSignRequest(oversized, createHarness().env, {
			now: NOW,
		});

		expect(response.status).toBe(400);
		expect(await errorCode(response)).toEqual({ error: { code: 'invalid_request' } });
	});

	it('enforces the global size policy per MIME category', async () => {
		const videoKey = buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'mp4');
		const oversizedImage = await sign(validBody({ sizeBytes: MEMORIES_MAX_IMAGE_BYTES + 1 }));
		const oversizedVideo = await sign(
			validBody({
				mimeType: 'video/mp4',
				objectKey: videoKey,
				sizeBytes: MEMORIES_MAX_VIDEO_BYTES + 1,
			}),
		);
		const videoAtLimit = await sign(
			validBody({
				mimeType: 'video/mp4',
				objectKey: videoKey,
				sizeBytes: MEMORIES_MAX_VIDEO_BYTES,
			}),
		);

		expect(oversizedImage.status).toBe(400);
		expect(await errorCode(oversizedImage)).toEqual({ error: { code: 'file_too_large' } });
		expect(oversizedVideo.status).toBe(400);
		expect(await errorCode(oversizedVideo)).toEqual({ error: { code: 'file_too_large' } });
		expect(videoAtLimit.status).toBe(200);
	});

	it('rate limits with the authenticated session identifier and fails closed without a limiter', async () => {
		const allowed = createHarness();
		expect((await sign(validBody(), { harness: allowed })).status).toBe(200);
		expect(allowed.limit).toHaveBeenCalledTimes(1);
		expect(allowed.limit).toHaveBeenCalledWith({ key: SESSION_ID });

		const throttled = createHarness({ limitSuccess: false });
		const limited = await sign(validBody(), { harness: throttled });
		expect(limited.status).toBe(429);
		expect(await errorCode(limited)).toEqual({ error: { code: 'rate_limited' } });

		const missingLimiter = createHarness();
		delete (missingLimiter.env as Partial<MemoriesSignEnv>).SIGN_RATE_LIMITER;
		expect((await sign(validBody(), { harness: missingLimiter })).status).toBe(429);
	});

	it('fails closed when a secret, the replay guard or a known storage target is missing', async () => {
		const missingKey = createHarness({
			env: { MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: '' },
		});
		const missingSecret = createHarness({ env: { MEMORIES_UPLOAD_CAPABILITY_SECRET: '' } });
		const unknownTarget = createHarness({ env: { MEMORIES_STORAGE_TARGET: 'preview' } });
		const missingGuard = createHarness();
		delete (missingGuard.env as Partial<MemoriesSignEnv>).NONCE_GUARD;

		for (const harness of [missingKey, missingSecret, unknownTarget, missingGuard]) {
			const response = await sign(validBody(), { harness });
			expect(response.status).toBe(503);
			expect(await errorCode(response)).toEqual({ error: { code: 'unavailable' } });
		}
	});

	it('answers 404 for other methods or paths and routes /upload through the default export', async () => {
		const harness = createHarness();
		const wrongMethod = await handleMemoriesSignRequest(
			fakeRequest({ method: 'GET', url: `${WORKER_ORIGIN}${MEMORIES_SIGN_PATH}` }),
			harness.env,
		);
		const wrongPath = await signWorker.fetch(
			fakeRequest({ method: 'POST', url: `${WORKER_ORIGIN}/presign`, body: '{}' }),
			harness.env,
		);
		const uploadWithoutOrigin = await signWorker.fetch(
			uploadRequest('opaque', { origin: null }),
			harness.env,
		);

		expect(wrongMethod.status).toBe(404);
		expect(await errorCode(wrongMethod)).toEqual({ error: { code: 'not_found' } });
		expect(wrongPath.status).toBe(404);
		expect(uploadWithoutOrigin.status).toBe(403);
	});
});

describe('memories sign worker: /upload', () => {
	it('accepts exactly one PUT per capability with matching origin, length, MIME, checksum and key', async () => {
		const harness = createHarness();
		drainOnPut(harness);
		const capability = await issueCapability();

		const accepted = await handleMemoriesUploadRequest(
			uploadRequest(capability.token),
			harness.env,
			NOW,
		);
		const replay = await handleMemoriesUploadRequest(
			uploadRequest(capability.token),
			harness.env,
			NOW,
		);

		expect(accepted.status).toBe(201);
		expect(await accepted.json()).toEqual({ uploaded: true });
		expect(accepted.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
		expect(accepted.headers.get('Cache-Control')).toBe('no-store');
		expect(replay.status).toBe(409);
		expect(await errorCode(replay)).toEqual({ error: { code: 'replay' } });
		expect(harness.put).toHaveBeenCalledTimes(1);
		expect(harness.put).toHaveBeenCalledWith(
			OBJECT_KEY,
			expect.anything(),
			expect.objectContaining({
				httpMetadata: { contentType: 'image/jpeg' },
				sha256: expect.any(ArrayBuffer),
				onlyIf: { etagDoesNotMatch: '*' },
			}),
		);
		expect(harness.replayKeys).toEqual(new Set([`upload:${NONCE}`]));
	});

	it('answers the CORS preflight only for an allowed origin', async () => {
		const harness = createHarness();
		const preflight = await handleMemoriesUploadRequest(
			uploadRequest('opaque', { method: 'OPTIONS', bytes: null }),
			harness.env,
			NOW,
		);
		const foreignPreflight = await handleMemoriesUploadRequest(
			uploadRequest('opaque', {
				method: 'OPTIONS',
				bytes: null,
				origin: 'https://attacker.example',
			}),
			harness.env,
			NOW,
		);

		expect(preflight.status).toBe(204);
		expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
		expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('OPTIONS, PUT');
		expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain(
			'x-amz-checksum-sha256',
		);
		expect(foreignPreflight.status).toBe(403);
	});

	it('rejects missing or unlisted origins before reading the capability', async () => {
		const harness = createHarness();
		const capability = await issueCapability();

		const missingOrigin = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, { origin: null }),
			harness.env,
			NOW,
		);
		const foreignOrigin = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, { origin: 'https://attacker.example' }),
			harness.env,
			NOW,
		);
		const bareHost = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, { origin: 'https://celebra-me.com' }),
			harness.env,
			NOW,
		);

		for (const response of [missingOrigin, foreignOrigin, bareHost]) {
			expect(response.status).toBe(403);
			expect(await errorCode(response)).toEqual({ error: { code: 'unauthorized' } });
			expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		}
		expect(harness.put).not.toHaveBeenCalled();
		expect(harness.replayKeys.size).toBe(0);
	});

	it('honours MEMORIES_ALLOWED_ORIGINS as a comma-separated list', async () => {
		const harness = createHarness({
			env: { MEMORIES_ALLOWED_ORIGINS: 'http://localhost:4321, http://127.0.0.1:4321' },
		});
		drainOnPut(harness);
		const capability = await issueCapability();

		const local = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, { origin: 'http://127.0.0.1:4321' }),
			harness.env,
			NOW,
		);
		const production = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, { origin: ALLOWED_ORIGIN }),
			harness.env,
			NOW,
		);

		expect(local.status).toBe(201);
		expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:4321');
		expect(production.status).toBe(403);
	});

	it('rejects declared metadata that differs from the sealed claims without consuming the capability', async () => {
		const harness = createHarness();
		drainOnPut(harness);
		const capability = await issueCapability();
		const mismatches: Array<[string, Record<string, string>]> = [
			['content length', { 'Content-Length': '3' }],
			['content type', { 'Content-Type': 'image/png' }],
			['checksum', { 'x-amz-checksum-sha256': sha256HexToBase64(EMPTY_SHA256) }],
			['bearer scheme', { Authorization: `Basic ${capability.token}` }],
		];

		for (const [label, headers] of mismatches) {
			const response = await handleMemoriesUploadRequest(
				uploadRequest(capability.token, { headers }),
				harness.env,
				NOW,
			);
			expect([label, response.status]).toEqual([label, 400]);
			expect(await errorCode(response)).toEqual({ error: { code: 'capability_invalid' } });
		}
		expect(harness.put).not.toHaveBeenCalled();
		expect(harness.replayKeys.size).toBe(0);

		const stillValid = await handleMemoriesUploadRequest(
			uploadRequest(capability.token),
			harness.env,
			NOW,
		);
		expect(stillValid.status).toBe(201);
	});

	it('rejects tampered, foreign-secret and expired capabilities', async () => {
		const harness = createHarness();
		const genuine = await issueCapability();
		const foreign = await issueCapability({}, 'another-secret');
		const expired = await issueCapability({ expiresAt: Math.floor(NOW.getTime() / 1000) - 1 });
		const tokens: Array<[string, string]> = [
			['tampered ciphertext', flipByte(genuine.token, 20)],
			['tampered iv', flipByte(genuine.token, 0)],
			['foreign secret', foreign.token],
			['expired', expired.token],
			['empty', ''],
		];

		for (const [label, token] of tokens) {
			const response = await handleMemoriesUploadRequest(
				uploadRequest(token),
				harness.env,
				NOW,
			);
			expect([label, response.status]).toEqual([label, 400]);
			expect(await errorCode(response)).toEqual({ error: { code: 'capability_invalid' } });
		}
		expect(harness.put).not.toHaveBeenCalled();
		expect(harness.replayKeys.size).toBe(0);
	});

	it('fails the upload when the stream does not deliver the declared byte count', async () => {
		const harness = createHarness();
		drainOnPut(harness);
		const capability = await issueCapability();

		const short = await handleMemoriesUploadRequest(
			uploadRequest(capability.token, {
				bytes: new Uint8Array([1, 2, 3]),
				headers: { 'Content-Length': String(FOUR_BYTES.byteLength) },
			}),
			harness.env,
			NOW,
		);

		expect(short.status).toBe(400);
		expect(await errorCode(short)).toEqual({ error: { code: 'upload_failed' } });
	});

	it('answers 412 when the object already exists so a retried PUT can go on to confirm', async () => {
		const harness = createHarness();
		harness.put.mockImplementation(async (_key, stream) => {
			const reader = (stream as ReadableStream<Uint8Array>).getReader();
			while (!(await reader.read()).done);
			return null;
		});
		const capability = await issueCapability();

		const response = await handleMemoriesUploadRequest(
			uploadRequest(capability.token),
			harness.env,
			NOW,
		);

		expect(response.status).toBe(412);
		expect(await errorCode(response)).toEqual({ error: { code: 'already_uploaded' } });
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
	});

	it('fails the upload when the R2 write itself rejects', async () => {
		const harness = createHarness();
		harness.put.mockImplementation(async (_key, stream) => {
			const reader = (stream as ReadableStream<Uint8Array>).getReader();
			while (!(await reader.read()).done);
			throw new Error('r2 unavailable');
		});
		const capability = await issueCapability();

		const response = await handleMemoriesUploadRequest(
			uploadRequest(capability.token),
			harness.env,
			NOW,
		);

		expect(response.status).toBe(400);
		expect(await errorCode(response)).toEqual({ error: { code: 'upload_failed' } });
	});
});

describe('upload capability', () => {
	it('is opaque: a single base64url segment whose bytes are not readable claims', async () => {
		const capability = await issueCapability();

		expect(capability.token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(capability.token).not.toContain('.');
		expect(capability.token.split('.')).toHaveLength(1);

		const decodedText = new TextDecoder().decode(decodeBase64(capability.token));
		expect(() => JSON.parse(decodedText)).toThrow();
		const decodedBinary = Buffer.from(capability.token, 'base64url').toString('latin1');
		expect(decodedBinary).not.toContain(OBJECT_KEY);
		expect(decodedBinary).not.toContain(SESSION_ID);
		expect(decodedBinary).not.toContain(NONCE);
		expect(decodedBinary).not.toContain(FOUR_BYTES_SHA256);
	});

	it('randomizes the sealed bytes for identical claims', async () => {
		const first = await issueCapability();
		const second = await issueCapability();
		expect(first.claims).toEqual(second.claims);
		expect(first.token).not.toBe(second.token);
	});

	it('verifies with the issuing secret and returns the exact claims', async () => {
		const capability = await issueCapability();
		const claims = await verifyUploadCapability(capability.token, SECRET, NOW);

		expect(claims).toEqual(capability.claims);
		expect(claims).toEqual({
			objectKey: OBJECT_KEY,
			sessionId: SESSION_ID,
			mimeType: 'image/jpeg',
			sizeBytes: FOUR_BYTES.byteLength,
			checksumSha256: FOUR_BYTES_SHA256,
			expiresAt: Math.floor(NOW.getTime() / 1000) + MEMORIES_PRESIGN_TTL_SECONDS,
			nonce: NONCE,
		});
		expect(capability.expiresAt).toBe(new Date(claims!.expiresAt * 1000).toISOString());
	});

	it('fails with a different secret or an empty secret', async () => {
		const capability = await issueCapability();
		await expect(
			verifyUploadCapability(capability.token, 'wrong-secret', NOW),
		).resolves.toBeNull();
		await expect(verifyUploadCapability(capability.token, '', NOW)).resolves.toBeNull();
	});

	it('fails once the embedded expiry is reached', async () => {
		const capability = await issueCapability();
		const expiresAtMs = capability.claims.expiresAt * 1000;

		await expect(
			verifyUploadCapability(capability.token, SECRET, new Date(expiresAtMs - 1)),
		).resolves.not.toBeNull();
		await expect(
			verifyUploadCapability(capability.token, SECRET, new Date(expiresAtMs)),
		).resolves.toBeNull();

		const alreadyExpired = await issueCapability({
			expiresAt: Math.floor(NOW.getTime() / 1000) - 1,
		});
		await expect(verifyUploadCapability(alreadyExpired.token, SECRET, NOW)).resolves.toBeNull();
	});

	it('cannot be tampered with: any flipped, truncated or padded byte fails authentication', async () => {
		const capability = await issueCapability();
		const bytes = decodeBase64(capability.token);

		for (const index of [0, 11, 12, 20, bytes.byteLength - 1]) {
			await expect(
				verifyUploadCapability(flipByte(capability.token, index), SECRET, NOW),
			).resolves.toBeNull();
		}
		await expect(
			verifyUploadCapability(
				encodeBase64Url(bytes.slice(0, bytes.byteLength - 1)),
				SECRET,
				NOW,
			),
		).resolves.toBeNull();
		await expect(
			verifyUploadCapability(encodeBase64Url(bytes.slice(0, 12)), SECRET, NOW),
		).resolves.toBeNull();
		await expect(
			verifyUploadCapability(`${capability.token}AA`, SECRET, NOW),
		).resolves.toBeNull();
		await expect(verifyUploadCapability('not base64 at all!', SECRET, NOW)).resolves.toBeNull();
		await expect(verifyUploadCapability('A'.repeat(5000), SECRET, NOW)).resolves.toBeNull();
	});

	it('rejects sealed claims with a nonce too short to be single-use', async () => {
		const weak = await issueCapability({ nonce: 'short' });
		await expect(verifyUploadCapability(weak.token, SECRET, NOW)).resolves.toBeNull();
	});
});

describe('worker environment parsing', () => {
	it('parses MEMORIES_ALLOWED_ORIGINS as a trimmed, comma-separated set', () => {
		expect(parseAllowedOrigins('https://www.celebra-me.com')).toEqual(
			new Set(['https://www.celebra-me.com']),
		);
		expect(parseAllowedOrigins(' http://localhost:4321 ,http://127.0.0.1:4321,, ')).toEqual(
			new Set(['http://localhost:4321', 'http://127.0.0.1:4321']),
		);
		expect(parseAllowedOrigins(undefined)).toEqual(new Set());
		expect(parseAllowedOrigins('')).toEqual(new Set());
		expect(parseAllowedOrigins(['https://www.celebra-me.com'])).toEqual(new Set());
	});

	it('accepts only the three known storage targets', () => {
		expect(parseStorageTarget('local')).toBe('local');
		expect(parseStorageTarget('staging')).toBe('staging');
		expect(parseStorageTarget('production')).toBe('production');
		expect(parseStorageTarget('preview')).toBeNull();
		expect(parseStorageTarget('Production')).toBeNull();
		expect(parseStorageTarget('')).toBeNull();
		expect(parseStorageTarget(undefined)).toBeNull();
	});
});
