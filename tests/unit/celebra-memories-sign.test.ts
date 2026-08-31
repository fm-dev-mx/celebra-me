import { generateKeyPairSync, webcrypto } from 'node:crypto';
import {
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_SIGN_PATH,
} from '@/data/valentina-memories-upload.contract';
import { MEMORIES_UPLOAD_REQUEST_AUDIENCE } from '@/data/valentina-memories-private-request.contract';
import { createMemoriesPrivateRequestHeaders } from '@/lib/server/memories-private-request';
import { handleMemoriesSignRequest } from '../../workers/celebra-memories-sign/src/index';
import type { MemoriesSignEnv } from '../../workers/celebra-memories-sign/src/env';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

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
	return {
		MEMORIES_R2_ACCOUNT_ID: 'test-account',
		MEMORIES_R2_PRESIGN_ACCESS_KEY_ID: 'test-access-key',
		MEMORIES_R2_PRESIGN_SECRET_ACCESS_KEY: 'test-secret',
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
	return new Request(`https://memories.celebra-me.com${VALENTINA_MEMORIES_SIGN_PATH}`, {
		method: 'POST',
		headers,
		body: options.mutateBodyAfterSigning ? `${rawBody} ` : rawBody,
	});
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

	it('returns a five-minute one-object PUT capability without exposing the key separately', async () => {
		const response = await run(validBody());
		const body = (await response.json()) as Record<string, unknown>;
		const requiredHeaders = body.requiredHeaders as Record<string, string>;

		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(body.objectKey).toBeUndefined();
		expect(body.expiresAt).toBe('2026-08-29T21:50:00.000Z');
		expect(requiredHeaders).toEqual({
			'Content-Type': 'image/jpeg',
			'If-None-Match': '*',
			'x-amz-checksum-sha256': '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
		});
		const uploadUrl = new URL(String(body.uploadUrl));
		expect(uploadUrl.pathname).toContain(OBJECT_ID);
		expect(uploadUrl.searchParams.get('X-Amz-Expires')).toBe('300');
		expect(uploadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe(
			'content-type;host;if-none-match;x-amz-checksum-sha256',
		);
		expect(uploadUrl.searchParams.get('X-Amz-Content-Sha256')).toBe('UNSIGNED-PAYLOAD');
	});

	it('rejects missing, wrong-audience, stale, or tampered authorization', async () => {
		const unsigned = new Request(
			`https://memories.celebra-me.com${VALENTINA_MEMORIES_SIGN_PATH}`,
			{
				method: 'POST',
				body: JSON.stringify(validBody()),
			},
		);
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
});
