import { generateKeyPairSync, webcrypto } from 'node:crypto';
import {
	ReadableStream as NodeReadableStream,
	TransformStream as NodeTransformStream,
} from 'node:stream/web';
import {
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_UPLOAD_PATH,
} from '@/data/valentina-memories-upload.contract';
import { MEMORIES_UPLOAD_REQUEST_AUDIENCE } from '@/data/valentina-memories-private-request.contract';
import { createMemoriesPrivateRequestHeaders } from '@/lib/server/memories-private-request';
import {
	handleMemoriesSignRequest,
	handleMemoriesUploadRequest,
} from '../../workers/celebra-memories-sign/src/index';
import type { MemoriesSignEnv } from '../../workers/celebra-memories-sign/src/env';
import {
	createUploadCapability,
	sha256HexToBase64,
} from '../../workers/celebra-memories-sign/src/capability';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

class TestFixedLengthStream {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;

	constructor(expectedLength: number) {
		let total = 0;
		const transform = new NodeTransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				total += chunk.byteLength;
				if (total > expectedLength) throw new Error('too many bytes');
				controller.enqueue(chunk);
			},
			flush() {
				if (total !== expectedLength) throw new Error('not enough bytes');
			},
		});
		this.readable = transform.readable as unknown as ReadableStream<Uint8Array>;
		this.writable = transform.writable as unknown as WritableStream<Uint8Array>;
	}
}

Object.defineProperty(globalThis, 'FixedLengthStream', {
	configurable: true,
	value: TestFixedLengthStream,
});

const DURING_WINDOW = new Date('2026-08-29T21:45:00.000Z');
const OUTSIDE_WINDOW = new Date('2026-09-04T06:00:00.000Z');
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
const OBJECT_KEY = `${VALENTINA_MEMORIES_OBJECT_PREFIX}${OBJECT_ID}.jpg`;
const CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function createEnv(limit = jest.fn(async () => ({ success: true }))): MemoriesSignEnv {
	const used = new Set<string>();
	return {
		MEMORIES_BUCKET: {
			put: jest.fn(async () => ({})),
		} as never,
		NONCE_GUARD: {
			idFromName: (name: string) => name as never,
			get: () => ({
				fetch: jest.fn(async (_url: string, init?: RequestInit) => {
					const input = JSON.parse(String(init?.body)) as { key: string };
					if (used.has(input.key)) return new Response(null, { status: 409 });
					used.add(input.key);
					return new Response(null, { status: 204 });
				}),
			}),
		} as never,
		MEMORIES_UPLOAD_CAPABILITY_SECRET: 'test-capability-secret',
		MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: PUBLIC_KEY,
		MEMORIES_STORAGE_TARGET: 'production',
		SIGN_RATE_LIMITER: { limit },
	};
}

function validBody(overrides: Record<string, unknown> = {}) {
	return {
		objectKey: OBJECT_KEY,
		sessionId: SESSION_ID,
		mimeType: 'image/jpeg',
		sizeBytes: 1024,
		checksumSha256: CHECKSUM,
		...overrides,
	};
}

function signedRequest(
	body: Record<string, unknown>,
	options: { now?: Date; audience?: string; mutateBodyAfterSigning?: boolean } = {},
): Request {
	const rawBody = JSON.stringify(body);
	process.env.MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY = PRIVATE_KEY;
	const headers = createMemoriesPrivateRequestHeaders({
		audience: options.audience ?? MEMORIES_UPLOAD_REQUEST_AUDIENCE,
		method: 'POST',
		path: VALENTINA_MEMORIES_SIGN_PATH,
		body: rawBody,
		privateKeyEnvName: 'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY',
		now: options.now ?? DURING_WINDOW,
	});
	const requestBody = options.mutateBodyAfterSigning ? `${rawBody} ` : rawBody;
	return {
		method: 'POST',
		url: `https://memories.celebra-me.com${VALENTINA_MEMORIES_SIGN_PATH}`,
		headers: new Headers(headers),
		body: new NodeReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(requestBody));
				controller.close();
			},
		}),
	} as unknown as Request;
}

function replayRequest(request: Request, body: Record<string, unknown>): Request {
	return {
		method: request.method,
		url: request.url,
		headers: request.headers,
		body: new NodeReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
				controller.close();
			},
		}),
	} as unknown as Request;
}

async function run(
	body: Record<string, unknown>,
	options: {
		now?: Date;
		env?: MemoriesSignEnv;
		audience?: string;
		mutateBodyAfterSigning?: boolean;
	} = {},
) {
	const now = options.now ?? DURING_WINDOW;
	return handleMemoriesSignRequest(
		signedRequest(body, { ...options, now }),
		options.env ?? createEnv(),
		{
			now,
		},
	);
}

describe('celebra memories private sign worker', () => {
	afterAll(() => {
		delete process.env.MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY;
	});

	it('returns a five-minute one-object Worker capability without exposing the key separately', async () => {
		const response = await run(validBody());
		const body = (await response.json()) as Record<string, unknown>;
		const requiredHeaders = body.requiredHeaders as Record<string, string>;

		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(body.objectKey).toBeUndefined();
		expect(body.expiresAt).toBe('2026-08-29T21:50:00.000Z');
		expect(requiredHeaders).toEqual({
			Authorization: expect.stringMatching(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
			'Content-Type': 'image/jpeg',
			'x-amz-checksum-sha256': '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
		});
		const uploadUrl = new URL(String(body.uploadUrl));
		expect(uploadUrl.pathname).toBe(VALENTINA_MEMORIES_UPLOAD_PATH);
		expect(uploadUrl.search).toBe('');
	});

	it('rejects missing, wrong-audience, stale, or tampered authorization', async () => {
		const unsigned = {
			method: 'POST',
			url: `https://memories.celebra-me.com${VALENTINA_MEMORIES_SIGN_PATH}`,
			headers: new Headers(),
			body: new NodeReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(JSON.stringify(validBody())));
					controller.close();
				},
			}),
		} as unknown as Request;
		const unsignedResponse = await handleMemoriesSignRequest(unsigned, createEnv(), {
			now: DURING_WINDOW,
		});
		const wrongAudience = await run(validBody(), { audience: 'wrong-audience' });
		const stale = await handleMemoriesSignRequest(
			signedRequest(validBody(), { now: new Date(DURING_WINDOW.getTime() - 61_000) }),
			createEnv(),
			{ now: DURING_WINDOW },
		);
		const tampered = await run(validBody(), { mutateBodyAfterSigning: true });

		for (const response of [unsignedResponse, wrongAudience, stale, tampered]) {
			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({ error: { code: 'unauthorized' } });
		}
	});

	it('rate limits with the authenticated session identifier', async () => {
		const limit = jest.fn(async () => ({ success: true }));
		const response = await run(validBody(), { env: createEnv(limit) });
		expect(response.status).toBe(200);
		expect(limit).toHaveBeenCalledWith({ key: SESSION_ID });
	});

	it('fails closed on invalid fields, oversized files, and a closed upload window', async () => {
		const invalid = await run(validBody({ extra: true }));
		const oversized = await run(
			validBody({ sizeBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES + 1 }),
		);
		const closed = await run(validBody(), { now: OUTSIDE_WINDOW });

		expect(invalid.status).toBe(400);
		expect(oversized.status).toBe(400);
		expect(closed.status).toBe(403);
	});

	it('fails closed when secrets or the limiter binding are unavailable', async () => {
		const missingKey = createEnv();
		missingKey.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY = '';
		const missingLimiter = createEnv();
		delete (missingLimiter as Partial<MemoriesSignEnv>).SIGN_RATE_LIMITER;

		expect((await run(validBody(), { env: missingKey })).status).toBe(503);
		expect((await run(validBody(), { env: missingLimiter })).status).toBe(429);
	});

	it('does not expose a replayable private request or direct R2 URL', async () => {
		const env = createEnv();
		const request = signedRequest(validBody());
		const first = await handleMemoriesSignRequest(request, env, { now: DURING_WINDOW });
		expect(first.status).toBe(200);
		const replay = await handleMemoriesSignRequest(replayRequest(request, validBody()), env, {
			now: DURING_WINDOW,
		});
		expect(replay.status).toBe(409);
	});

	it('accepts only a one-use capability with exact origin, length, MIME, checksum, and object key', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]);
		const checksum = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a';
		const env = createEnv();
		(env.MEMORIES_BUCKET.put as jest.Mock).mockImplementation(async (_key: string, body: BodyInit) => {
			const reader = (body as unknown as ReadableStream<Uint8Array>).getReader();
			while (!(await reader.read()).done) {
				// Drain the fixed-length stream to exercise the byte-counting boundary.
			}
			return {};
		});
		const capability = await createUploadCapability(
			{
				objectKey: OBJECT_KEY,
				sessionId: SESSION_ID,
				mimeType: 'image/jpeg',
				sizeBytes: bytes.byteLength,
				checksumSha256: checksum,
				nonce: 'upload-nonce-123456',
			},
			'test-capability-secret',
			DURING_WINDOW,
		);
		const makeRequest = (body: Uint8Array, headers: Record<string, string> = {}) =>
			({
				method: 'PUT',
				headers: new Headers({
					Origin: 'https://www.celebra-me.com',
					Authorization: `Bearer ${capability.token}`,
					'Content-Type': 'image/jpeg',
					'x-amz-checksum-sha256': sha256HexToBase64(checksum),
					'Content-Length': String(body.byteLength),
					...headers,
				}),
				body: new NodeReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(body);
						controller.close();
					},
				}),
			}) as unknown as Request;
		const accepted = await handleMemoriesUploadRequest(makeRequest(bytes), env, DURING_WINDOW);
		const replay = await handleMemoriesUploadRequest(makeRequest(bytes), env, DURING_WINDOW);

		expect(accepted.status).toBe(201);
		expect(replay.status).toBe(409);
		expect(env.MEMORIES_BUCKET.put).toHaveBeenCalledWith(
			OBJECT_KEY,
			expect.anything(),
			expect.objectContaining({
				sha256: expect.any(ArrayBuffer),
				onlyIf: { etagDoesNotMatch: '*' },
			}),
		);
	});

	it('rejects upload origins and declared body metadata before consuming the capability', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]);
		const env = createEnv();
		const capability = await createUploadCapability(
			{
				objectKey: OBJECT_KEY,
				sessionId: SESSION_ID,
				mimeType: 'image/jpeg',
				sizeBytes: bytes.byteLength,
				checksumSha256: '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a',
				nonce: 'upload-nonce-654321',
			},
			'test-capability-secret',
			DURING_WINDOW,
		);
		const request = (origin: string, extra: Record<string, string> = {}) =>
			new Request(`https://memories.celebra-me.com${VALENTINA_MEMORIES_UPLOAD_PATH}`, {
				method: 'PUT',
				headers: {
					Origin: origin,
					Authorization: `Bearer ${capability.token}`,
					'Content-Type': 'image/jpeg',
					'x-amz-checksum-sha256': sha256HexToBase64(capability.claims.checksumSha256),
					'Content-Length': '4',
					...extra,
				},
				body: bytes,
			});

		expect(
			(await handleMemoriesUploadRequest(request('https://attacker.example'), env, DURING_WINDOW))
				.status,
		).toBe(403);
		expect(
			(
				await handleMemoriesUploadRequest(
					request('https://www.celebra-me.com', { 'Content-Length': '3' }),
					env,
					DURING_WINDOW,
				)
			).status,
		).toBe(400);
		expect(env.MEMORIES_BUCKET.put).not.toHaveBeenCalled();
	});
});
