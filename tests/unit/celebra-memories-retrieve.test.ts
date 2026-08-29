import { webcrypto } from 'node:crypto';
import worker from '../../workers/celebra-memories-retrieve/src/index';
import {
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME,
	VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME,
	buildValentinaMemoriesRetrievalSigningPayload,
} from '@/data/valentina-memories-media.contract';
import { retrieveValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';

const cryptoApi = webcrypto;
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const OBJECT_KEY = 'events/valentina/550e8400-e29b-41d4-a716-446655440000.jpg';

async function signRequest(body: string, secret: string, timestamp: string): Promise<string> {
	const bodyHash = Array.from(
		new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(body))),
		(byte) => byte.toString(16).padStart(2, '0'),
	).join('');
	const payload = buildValentinaMemoriesRetrievalSigningPayload({
		timestamp,
		method: 'POST',
		path: VALENTINA_MEMORIES_RETRIEVAL_PATH,
		bodyHash,
	});
	const key = await cryptoApi.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return Array.from(
		new Uint8Array(await cryptoApi.subtle.sign('HMAC', key, new TextEncoder().encode(payload))),
		(byte) => byte.toString(16).padStart(2, '0'),
	).join('');
}

describe('Valentina private retrieval Worker', () => {
	it('refuses an HTTP retrieval endpoint before signing a private request', async () => {
		const originalUrl = process.env[VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME];
		const originalSecret = process.env[VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME];
		process.env[VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME] =
			`http://access.test${VALENTINA_MEMORIES_RETRIEVAL_PATH}`;
		process.env[VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME] = 'secret';
		try {
			const response = await retrieveValentinaMemoryObject({
				objectKey: OBJECT_KEY,
				mimeType: 'image/jpeg',
				downloadName: 'valentina.jpg',
				mode: 'attachment',
			});
			expect(response.status).toBe(503);
		} finally {
			if (originalUrl === undefined)
				delete process.env[VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME];
			else process.env[VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME] = originalUrl;
			if (originalSecret === undefined) {
				delete process.env[VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME];
			} else {
				process.env[VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME] = originalSecret;
			}
		}
	});

	it('rejects unauthenticated, wrong-path, and malformed requests', async () => {
		const env = { RETRIEVAL_SHARED_SECRET: 'secret', MEMORIES_BUCKET: { get: jest.fn() } };
		const wrongPath = await worker.fetch(new Request('https://access.test/'), env);
		expect(wrongPath.status).toBe(404);
		const missingSignature = await worker.fetch(
			new Request(`https://access.test${VALENTINA_MEMORIES_RETRIEVAL_PATH}`, {
				method: 'POST',
				body: '{}',
			}),
			env,
		);
		expect(missingSignature.status).toBe(401);
	});

	it('streams only an HMAC-authorized object without listing or signed URLs', async () => {
		const body = JSON.stringify({
			objectKey: OBJECT_KEY,
			mimeType: 'image/jpeg',
			downloadName: 'valentina.jpg',
			mode: 'attachment',
		});
		const secret = 'secret';
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = await signRequest(body, secret, timestamp);
		const get = jest.fn().mockResolvedValue({
			body: new Response('bytes').body,
		});
		const response = await worker.fetch(
			new Request(`https://access.test${VALENTINA_MEMORIES_RETRIEVAL_PATH}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Celebra-Retrieval-Timestamp': timestamp,
					'X-Celebra-Retrieval-Signature': signature,
				},
				body,
			}),
			{ RETRIEVAL_SHARED_SECRET: secret, MEMORIES_BUCKET: { get } },
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Disposition')).toContain('attachment');
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		expect(await response.text()).toBe('bytes');
		expect(get).toHaveBeenCalledWith(OBJECT_KEY);
	});

	it('inspects bounded object metadata and signature in inspect mode without streaming full object', async () => {
		const body = JSON.stringify({
			objectKey: OBJECT_KEY,
			mimeType: 'image/jpeg',
			mode: 'inspect',
		});
		const secret = 'secret';
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = await signRequest(body, secret, timestamp);
		const jpegBytes = new Uint8Array([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
		]);
		const get = jest.fn().mockResolvedValue({
			size: 2048,
			checksums: { toJSON: () => ({ sha256: 'abc123hash' }) },
			body: new Response(jpegBytes).body,
		});
		const response = await worker.fetch(
			new Request(`https://access.test${VALENTINA_MEMORIES_RETRIEVAL_PATH}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Celebra-Retrieval-Timestamp': timestamp,
					'X-Celebra-Retrieval-Signature': signature,
				},
				body,
			}),
			{ RETRIEVAL_SHARED_SECRET: secret, MEMORIES_BUCKET: { get } },
		);
		expect(response.status).toBe(200);
		const result = (await response.json()) as {
			exists: boolean;
			sizeBytes: number;
			signatureValid: boolean;
		};
		expect(result.exists).toBe(true);
		expect(result.sizeBytes).toBe(2048);
		expect(result.signatureValid).toBe(true);
		expect(get).toHaveBeenCalledWith(OBJECT_KEY, { range: { offset: 0, length: 65536 } });
	});

	it('inspects a bounded tail range when an MP4 stores moov after its media data', async () => {
		const objectKey = 'events/valentina/550e8400-e29b-41d4-a716-446655440001.mp4';
		const body = JSON.stringify({ objectKey, mimeType: 'video/mp4', mode: 'inspect' });
		const secret = 'secret';
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = await signRequest(body, secret, timestamp);
		const head = new Uint8Array([
			0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
		]);
		const tail = new Uint8Array(64);
		const view = new DataView(tail.buffer);
		view.setUint32(16, 48);
		tail.set([0x6d, 0x6f, 0x6f, 0x76], 20);
		view.setUint32(24, 40);
		tail.set([0x6d, 0x76, 0x68, 0x64], 28);
		view.setUint32(44, 1000);
		view.setUint32(48, 15000);
		const get = jest
			.fn()
			.mockResolvedValueOnce({ size: 100_000, body: new Response(head).body })
			.mockResolvedValueOnce({ body: new Response(tail).body });

		const response = await worker.fetch(
			new Request(`https://access.test${VALENTINA_MEMORIES_RETRIEVAL_PATH}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Celebra-Retrieval-Timestamp': timestamp,
					'X-Celebra-Retrieval-Signature': signature,
				},
				body,
			}),
			{ RETRIEVAL_SHARED_SECRET: secret, MEMORIES_BUCKET: { get } },
		);

		expect((await response.json()) as { durationSeconds: number }).toMatchObject({
			durationSeconds: 15,
		});
		expect(get).toHaveBeenLastCalledWith(objectKey, {
			range: { offset: 34464, length: 65536 },
		});
	});
});
