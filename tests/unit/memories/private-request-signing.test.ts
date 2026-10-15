/**
 * The app signs private Worker requests with a PEM string (never a KeyObject, which workerd
 * rejects) and the Workers verify the raw r||s signature with WebCrypto. Keys are generated
 * per test run; no real key is ever used here.
 */
import { createHash, generateKeyPairSync, verify, webcrypto } from 'node:crypto';
import {
	MEMORIES_PRIVATE_REQUEST_HEADERS,
	buildMemoriesPrivateRequestPayload,
} from '@/lib/memories/contract/private-request';
import { createMemoriesPrivateRequestHeaders } from '@/lib/memories/server/private-request';
import { verifyMemoriesPrivateRequest } from '../../../workers/shared/private-request';

const KEY_ENV = 'MEMORIES_TEST_SIGNING_PRIVATE_KEY';
const AUDIENCE = 'memories-upload-sign-v1';
const PATH = '/sign';
const NOW = new Date('2026-10-14T12:00:00.000Z');

function generatePair() {
	const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
	return {
		privatePem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
		publicPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
		publicKey: pair.publicKey,
	};
}

function signedRequest(body: string) {
	const headers = createMemoriesPrivateRequestHeaders({
		audience: AUDIENCE,
		method: 'POST',
		path: PATH,
		body,
		privateKeyEnvName: KEY_ENV,
		now: NOW,
	});
	return {
		headers,
		request: new Request(`https://worker.test${PATH}`, { method: 'POST', headers, body }),
	};
}

describe('memories private request signing', () => {
	const previousCrypto = globalThis.crypto;
	let pair: ReturnType<typeof generatePair>;

	beforeAll(() => {
		Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
	});

	afterAll(() => {
		Object.defineProperty(globalThis, 'crypto', { configurable: true, value: previousCrypto });
		delete process.env[KEY_ENV];
	});

	beforeEach(() => {
		pair = generatePair();
		process.env[KEY_ENV] = pair.privatePem;
	});

	it('produces a raw 64-byte P-256 signature over the v1 payload', () => {
		const body = JSON.stringify({ hello: 'world' });
		const { headers } = signedRequest(body);
		const signature = Buffer.from(
			headers[MEMORIES_PRIVATE_REQUEST_HEADERS.signature]!,
			'base64url',
		);
		expect(signature).toHaveLength(64);

		const payload = buildMemoriesPrivateRequestPayload({
			audience: AUDIENCE,
			timestamp: headers[MEMORIES_PRIVATE_REQUEST_HEADERS.timestamp]!,
			requestId: headers[MEMORIES_PRIVATE_REQUEST_HEADERS.requestId]!,
			method: 'POST',
			path: PATH,
			bodyHash: createHash('sha256').update(body, 'utf8').digest('hex'),
		});
		expect(headers[MEMORIES_PRIVATE_REQUEST_HEADERS.timestamp]).toBe(
			String(Math.floor(NOW.getTime() / 1000)),
		);
		expect(
			verify(
				'sha256',
				Buffer.from(payload, 'utf8'),
				{
					key: pair.publicKey,
					dsaEncoding: 'ieee-p1363',
				},
				signature,
			),
		).toBe(true);
	});

	it('is accepted by the Worker verifier with the matching public key only', async () => {
		const body = JSON.stringify({ hello: 'world' });
		const { request } = signedRequest(body);
		const verifyWith = (publicKeyPem: string, rawBody = body) =>
			verifyMemoriesPrivateRequest({
				request,
				rawBody,
				expectedAudience: AUDIENCE,
				expectedPath: PATH,
				publicKeyPem,
				now: NOW,
			});

		await expect(verifyWith(pair.publicPem)).resolves.toBe(true);
		await expect(verifyWith(generatePair().publicPem)).resolves.toBe(false);
		await expect(verifyWith(pair.publicPem, `${body} `)).resolves.toBe(false);
	});

	it('accepts a PEM stored with escaped newlines', async () => {
		process.env[KEY_ENV] = pair.privatePem.replace(/\n/g, '\\n');
		const body = '{}';
		const { request } = signedRequest(body);
		await expect(
			verifyMemoriesPrivateRequest({
				request,
				rawBody: body,
				expectedAudience: AUDIENCE,
				expectedPath: PATH,
				publicKeyPem: pair.publicPem,
				now: NOW,
			}),
		).resolves.toBe(true);
	});

	it('fails closed when the private key is not configured', () => {
		process.env[KEY_ENV] = '';
		expect(() => signedRequest('{}')).toThrow(
			'Memories private request signing is not configured.',
		);
	});
});
