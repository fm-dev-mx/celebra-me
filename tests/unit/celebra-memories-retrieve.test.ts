import { webcrypto } from 'node:crypto';
import worker from '../../workers/celebra-memories-retrieve/src/index';
import {
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	buildValentinaMemoriesRetrievalSigningPayload,
} from '@/data/valentina-memories-media.contract';

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
});
