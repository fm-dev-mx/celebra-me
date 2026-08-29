import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { VALENTINA_MEMORIES_RETRIEVAL_PATH } from '@/data/valentina-memories-media.contract';
import { MEMORIES_RETRIEVAL_REQUEST_AUDIENCE } from '@/data/valentina-memories-private-request.contract';
import { createMemoriesPrivateRequestHeaders } from '@/lib/server/memories-private-request';
import retrieveWorker from '../../workers/celebra-memories-retrieve/src/index';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
Object.defineProperty(globalThis, 'ReadableStream', {
	configurable: true,
	value: NodeReadableStream,
});

const OBJECT_KEY = 'events/valentina/22222222-2222-4222-8222-222222222222.jpg';
const SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new NodeReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	}) as unknown as ReadableStream<Uint8Array>;
}

function object(bytes: Uint8Array, size = bytes.byteLength) {
	return {
		body: stream(bytes),
		size,
		checksums: {
			toJSON: () => ({ sha256: SHA256 }),
		},
	};
}

function signedRequest(
	body: Record<string, unknown>,
	options: { now?: Date; audience?: string; tamper?: boolean } = {},
): Request {
	const rawBody = JSON.stringify(body);
	process.env.MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY = PRIVATE_KEY;
	const headers = createMemoriesPrivateRequestHeaders({
		audience: options.audience ?? MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
		method: 'POST',
		path: VALENTINA_MEMORIES_RETRIEVAL_PATH,
		body: rawBody,
		privateKeyEnvName: 'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY',
		now: options.now,
	});
	return new Request(
		`https://memories-access.celebra-me.com${VALENTINA_MEMORIES_RETRIEVAL_PATH}`,
		{
			method: 'POST',
			headers,
			body: options.tamper ? `${rawBody} ` : rawBody,
		},
	);
}

function createEnv(overrides: Record<string, unknown> = {}) {
	return {
		MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY: PUBLIC_KEY,
		MEMORIES_BUCKET: {
			get: jest.fn(),
			delete: jest.fn(async () => undefined),
		},
		...overrides,
	};
}

describe('celebra memories private retrieval worker', () => {
	afterAll(() => {
		delete process.env.MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY;
	});

	it('rejects unsigned, wrong-audience, stale, and tampered requests before R2 access', async () => {
		const body = { objectKey: OBJECT_KEY, mimeType: 'image/jpeg', mode: 'inline' };
		const env = createEnv();
		const unsigned = new Request(
			`https://memories-access.celebra-me.com${VALENTINA_MEMORIES_RETRIEVAL_PATH}`,
			{ method: 'POST', body: JSON.stringify(body) },
		);
		const responses = [
			await retrieveWorker.fetch(unsigned, env as never),
			await retrieveWorker.fetch(signedRequest(body, { audience: 'wrong' }), env as never),
			await retrieveWorker.fetch(
				signedRequest(body, { now: new Date(Date.now() - 61_000) }),
				env as never,
			),
			await retrieveWorker.fetch(signedRequest(body, { tamper: true }), env as never),
		];

		for (const response of responses) expect(response.status).toBe(401);
		expect(env.MEMORIES_BUCKET.get).not.toHaveBeenCalled();
	});

	it('inspects bounded bytes and checksum metadata without listing the bucket', async () => {
		const bytes = new Uint8Array([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
		]);
		const get = jest.fn(async () => object(bytes, 1024));
		const env = createEnv({ MEMORIES_BUCKET: { get, delete: jest.fn() } });
		const response = await retrieveWorker.fetch(
			signedRequest({ objectKey: OBJECT_KEY, mimeType: 'image/jpeg', mode: 'inspect' }),
			env as never,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			exists: true,
			sizeBytes: 1024,
			checksumSha256: SHA256,
			signatureValid: true,
			durationSeconds: null,
		});
		expect(get).toHaveBeenCalledWith(OBJECT_KEY, { range: { offset: 0, length: 65_536 } });
		expect('list' in env.MEMORIES_BUCKET).toBe(false);
	});

	it('streams a private range with 206 and no-store headers', async () => {
		const get = jest.fn(async () => object(new Uint8Array([2, 3]), 4));
		const env = createEnv({ MEMORIES_BUCKET: { get, delete: jest.fn() } });
		const response = await retrieveWorker.fetch(
			signedRequest({
				objectKey: OBJECT_KEY,
				mimeType: 'image/jpeg',
				mode: 'inline',
				rangeStart: 1,
				rangeEnd: 2,
			}),
			env as never,
		);

		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
		expect(response.headers.get('Content-Disposition')).toBe(
			'inline; filename="valentina.jpg"',
		);
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		const reader = response.body?.getReader();
		const chunk = await reader?.read();
		expect(chunk?.value).toEqual(new Uint8Array([2, 3]));
	});

	it('deletes only the exact internally resolved object key', async () => {
		const remove = jest.fn(async () => undefined);
		const env = createEnv({ MEMORIES_BUCKET: { get: jest.fn(), delete: remove } });
		const response = await retrieveWorker.fetch(
			signedRequest({ objectKey: OBJECT_KEY, mimeType: 'image/jpeg', mode: 'delete' }),
			env as never,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: true });
		expect(remove).toHaveBeenCalledWith(OBJECT_KEY);
	});

	it('rejects guessed prefixes and invalid ranges without touching R2', async () => {
		const env = createEnv();
		const wrongKey = await retrieveWorker.fetch(
			signedRequest({ objectKey: 'other/event.jpg', mimeType: 'image/jpeg', mode: 'inline' }),
			env as never,
		);
		const invalidRange = await retrieveWorker.fetch(
			signedRequest({
				objectKey: OBJECT_KEY,
				mimeType: 'image/jpeg',
				mode: 'inline',
				rangeStart: 5,
				rangeEnd: 4,
			}),
			env as never,
		);

		expect(wrongKey.status).toBe(400);
		expect(invalidRange.status).toBe(400);
		expect(env.MEMORIES_BUCKET.get).not.toHaveBeenCalled();
	});
});
