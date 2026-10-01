import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { MEMORIES_INSPECTION_BYTES } from '@/lib/memories/contract/limits';
import { buildMemoriesObjectKey } from '@/lib/memories/contract/object-key';
import {
	MEMORIES_RETRIEVAL_PATH,
	MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
} from '@/lib/memories/contract/private-request';
import { createMemoriesPrivateRequestHeaders } from '@/lib/memories/server/private-request';
import retrieveWorker from '../../workers/celebra-memories-retrieve/src/index';
import {
	isMediaSignatureValid,
	parseBoundedVideoDurationSeconds,
} from '../../workers/celebra-memories-retrieve/src/inspect';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
Object.defineProperty(globalThis, 'ReadableStream', {
	configurable: true,
	value: NodeReadableStream,
});

type RetrieveEnv = Parameters<typeof retrieveWorker.fetch>[1];
type Bucket = RetrieveEnv['MEMORIES_BUCKET'];
type StoredObject = NonNullable<Awaited<ReturnType<Bucket['get']>>>;

const SIGNING_KEY_ENV = 'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY';
const WORKER_ORIGIN = 'https://memories-access.celebra-me.com';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const JPEG_KEY = buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'jpg');
const MP4_KEY = buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'mp4');
const SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const JPEG_BYTES = new Uint8Array([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function ascii(text: string): number[] {
	return Array.from(text, (character) => character.charCodeAt(0));
}

/** Minimal `moov` atom holding a version-0 `mvhd` with a millisecond timescale. */
function moovWithDuration(durationSeconds: number): Uint8Array {
	const bytes = new Uint8Array(48);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 48);
	bytes.set(ascii('moov'), 4);
	view.setUint32(8, 40);
	bytes.set(ascii('mvhd'), 12);
	view.setUint8(16, 0);
	view.setUint32(28, 1000);
	view.setUint32(32, durationSeconds * 1000);
	return bytes;
}

/** `moov` atom with a version-1 `mvhd` (64-bit duration). */
function moovWithLongDuration(durationSeconds: number): Uint8Array {
	const bytes = new Uint8Array(64);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 64);
	bytes.set(ascii('moov'), 4);
	view.setUint32(8, 56);
	bytes.set(ascii('mvhd'), 12);
	view.setUint8(16, 1);
	view.setUint32(36, 600);
	view.setUint32(40, 0);
	view.setUint32(44, durationSeconds * 600);
	return bytes;
}

/** `ftyp` header without any `moov`, as found at the start of a streaming MP4. */
function ftypHeader(): Uint8Array {
	const bytes = new Uint8Array(32);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 32);
	bytes.set(ascii('ftyp'), 4);
	bytes.set(ascii('isom'), 8);
	return bytes;
}

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new NodeReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	}) as unknown as ReadableStream<Uint8Array>;
}

function storedObject(
	bytes: Uint8Array,
	size = bytes.byteLength,
	checksums: StoredObject['checksums'] = { toJSON: () => ({ sha256: SHA256 }) },
): StoredObject {
	return { body: stream(bytes), size, checksums };
}

type GetMock = jest.Mock<Promise<StoredObject | null>, Parameters<Bucket['get']>>;

function getReturning(object: StoredObject | null): GetMock {
	return jest.fn<Promise<StoredObject | null>, Parameters<Bucket['get']>>(() =>
		Promise.resolve(object),
	);
}

function createBucket(overrides: Partial<Bucket> = {}): Bucket {
	return {
		put: jest.fn<Promise<unknown>, Parameters<Bucket['put']>>(() => Promise.resolve({})),
		get: getReturning(null),
		delete: jest.fn<Promise<void>, Parameters<Bucket['delete']>>(() => Promise.resolve()),
		...overrides,
	};
}

function createEnv(overrides: Partial<RetrieveEnv> = {}): RetrieveEnv {
	const used = new Set<string>();
	return {
		MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY: PUBLIC_KEY,
		MEMORIES_STORAGE_TARGET: 'production',
		MEMORIES_BUCKET: createBucket(),
		NONCE_GUARD: {
			idFromName: (name: string) => ({ toString: () => name }),
			get: () => ({
				fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
					const claim = JSON.parse(String(init?.body)) as { key: string };
					if (used.has(claim.key)) return new Response(null, { status: 409 });
					used.add(claim.key);
					return new Response(null, { status: 204 });
				},
			}),
		},
		...overrides,
	};
}

function fakeRequest(init: {
	method: string;
	url: string;
	headers?: HeadersInit;
	body: string;
}): Request {
	return {
		method: init.method,
		url: init.url,
		headers: new Headers(init.headers),
		body: new NodeReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(init.body));
				controller.close();
			},
		}),
	} as unknown as Request;
}

function signedRequest(
	body: Record<string, unknown>,
	options: { signedAt?: Date; audience?: string; tamper?: boolean; requestId?: string } = {},
): Request {
	const rawBody = JSON.stringify(body);
	const headers = createMemoriesPrivateRequestHeaders({
		audience: options.audience ?? MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
		method: 'POST',
		path: MEMORIES_RETRIEVAL_PATH,
		body: rawBody,
		privateKeyEnvName: SIGNING_KEY_ENV,
		requestId: options.requestId,
		now: options.signedAt,
	});
	return fakeRequest({
		method: 'POST',
		url: `${WORKER_ORIGIN}${MEMORIES_RETRIEVAL_PATH}`,
		headers,
		body: options.tamper ? `${rawBody} ` : rawBody,
	});
}

async function retrieve(
	body: Record<string, unknown>,
	env: RetrieveEnv = createEnv(),
): Promise<Response> {
	return retrieveWorker.fetch(signedRequest(body), env);
}

async function readAll(body: ReadableStream<Uint8Array> | null): Promise<number[]> {
	if (!body) return [];
	const reader = body.getReader();
	const collected: number[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		collected.push(...value);
	}
	return collected;
}

beforeAll(() => {
	process.env[SIGNING_KEY_ENV] = PRIVATE_KEY;
});

afterAll(() => {
	delete process.env[SIGNING_KEY_ENV];
});

describe('memories retrieve worker: authorization', () => {
	it('rejects unsigned, wrong-audience, stale and tampered requests before touching R2', async () => {
		const body = { objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inline' };
		const env = createEnv();
		const unsigned = fakeRequest({
			method: 'POST',
			url: `${WORKER_ORIGIN}${MEMORIES_RETRIEVAL_PATH}`,
			body: JSON.stringify(body),
		});
		const responses = [
			await retrieveWorker.fetch(unsigned, env),
			await retrieveWorker.fetch(signedRequest(body, { audience: 'wrong' }), env),
			await retrieveWorker.fetch(
				signedRequest(body, { signedAt: new Date(Date.now() - 61_000) }),
				env,
			),
			await retrieveWorker.fetch(signedRequest(body, { tamper: true }), env),
		];

		for (const response of responses) {
			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: { code: 'unauthorized' } });
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		}
		expect(env.MEMORIES_BUCKET.get).not.toHaveBeenCalled();
		expect(env.MEMORIES_BUCKET.delete).not.toHaveBeenCalled();
	});

	it('rejects a replayed request id with a valid signature', async () => {
		const body = { objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'delete' };
		const env = createEnv();
		const first = await retrieveWorker.fetch(
			signedRequest(body, { requestId: REQUEST_ID }),
			env,
		);
		const replay = await retrieveWorker.fetch(
			signedRequest(body, { requestId: REQUEST_ID }),
			env,
		);

		expect(first.status).toBe(200);
		expect(replay.status).toBe(409);
		expect(await replay.json()).toEqual({ error: { code: 'replay' } });
		expect(env.MEMORIES_BUCKET.delete).toHaveBeenCalledTimes(1);
	});

	it('answers 404 for other methods or paths and 503 when unconfigured', async () => {
		const wrongMethod = await retrieveWorker.fetch(
			fakeRequest({
				method: 'GET',
				url: `${WORKER_ORIGIN}${MEMORIES_RETRIEVAL_PATH}`,
				body: '',
			}),
			createEnv(),
		);
		const wrongPath = await retrieveWorker.fetch(
			fakeRequest({ method: 'POST', url: `${WORKER_ORIGIN}/events/retrieve`, body: '{}' }),
			createEnv(),
		);
		const missingKey = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect' },
			createEnv({ MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY: '' }),
		);
		const unknownTarget = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect' },
			createEnv({ MEMORIES_STORAGE_TARGET: 'preview' }),
		);

		expect(wrongMethod.status).toBe(404);
		expect(await wrongMethod.json()).toEqual({ error: { code: 'not_found' } });
		expect(wrongPath.status).toBe(404);
		expect(missingKey.status).toBe(503);
		expect(await missingKey.json()).toEqual({ error: { code: 'unavailable' } });
		expect(unknownTarget.status).toBe(503);
	});
});

describe('memories retrieve worker: inspect', () => {
	it('inspects bounded bytes and checksum metadata without listing the bucket', async () => {
		const get = getReturning(storedObject(JPEG_BYTES, 1024));
		const env = createEnv({ MEMORIES_BUCKET: createBucket({ get }) });
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect' },
			env,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			exists: true,
			sizeBytes: 1024,
			checksumSha256: SHA256,
			signatureValid: true,
			durationSeconds: null,
		});
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith(JPEG_KEY, {
			range: { offset: 0, length: MEMORIES_INSPECTION_BYTES },
		});
		expect('list' in env.MEMORIES_BUCKET).toBe(false);
	});

	it('prefers the binary R2 checksum when present', async () => {
		const digest = Uint8Array.from(Buffer.from(SHA256, 'hex')).buffer;
		const get = getReturning(
			storedObject(JPEG_BYTES, 12, { sha256: digest, toJSON: () => ({}) }),
		);
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect' },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(await response.json()).toMatchObject({
			checksumSha256: SHA256,
			signatureValid: true,
		});
	});

	it('reports an invalid signature when the bytes do not match the declared MIME type', async () => {
		const get = getReturning(storedObject(PNG_BYTES, 12));
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect' },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(await response.json()).toMatchObject({
			signatureValid: false,
			durationSeconds: null,
		});
	});

	it('extracts the MP4 duration from the container header', async () => {
		const get = getReturning(storedObject(moovWithDuration(15)));
		const response = await retrieve(
			{ objectKey: MP4_KEY, mimeType: 'video/mp4', mode: 'inspect' },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			exists: true,
			sizeBytes: 48,
			checksumSha256: SHA256,
			signatureValid: true,
			durationSeconds: 15,
		});
		expect(get).toHaveBeenCalledTimes(1);
	});

	it('falls back to a bounded tail range when the header carries no moov atom', async () => {
		const size = 100_000;
		const get = jest.fn<Promise<StoredObject | null>, Parameters<Bucket['get']>>(
			(_key, options) =>
				Promise.resolve(
					options?.range?.offset === 0
						? storedObject(ftypHeader(), size)
						: storedObject(moovWithDuration(42), size),
				),
		);
		const response = await retrieve(
			{ objectKey: MP4_KEY, mimeType: 'video/mp4', mode: 'inspect' },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(await response.json()).toMatchObject({
			sizeBytes: size,
			signatureValid: true,
			durationSeconds: 42,
		});
		expect(get).toHaveBeenCalledTimes(2);
		expect(get).toHaveBeenNthCalledWith(2, MP4_KEY, {
			range: { offset: size - MEMORIES_INSPECTION_BYTES, length: MEMORIES_INSPECTION_BYTES },
		});
	});

	it('reports an absent object with 200 so a 404 never means "missing"', async () => {
		const response = await retrieve({
			objectKey: JPEG_KEY,
			mimeType: 'image/jpeg',
			mode: 'inspect',
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			exists: false,
			sizeBytes: 0,
			checksumSha256: null,
			signatureValid: false,
			durationSeconds: null,
		});
	});
});

describe('memories retrieve worker: streaming', () => {
	it('streams a private range with 206, no-store and nosniff headers', async () => {
		const get = getReturning(storedObject(new Uint8Array([2, 3]), 4));
		const response = await retrieve(
			{
				objectKey: JPEG_KEY,
				mimeType: 'image/jpeg',
				mode: 'inline',
				rangeStart: 1,
				rangeEnd: 2,
			},
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(response.status).toBe(206);
		expect(get).toHaveBeenCalledWith(JPEG_KEY, { range: { offset: 1, length: 2 } });
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
		expect(response.headers.get('Content-Length')).toBe('2');
		expect(response.headers.get('Content-Disposition')).toBe('inline; filename="recuerdo.jpg"');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(await readAll(response.body)).toEqual([2, 3]);
	});

	it('streams an open-ended range and clamps the reported end to the object size', async () => {
		const get = getReturning(storedObject(new Uint8Array([3, 4]), 4));
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inline', rangeStart: 2 },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(response.status).toBe(206);
		expect(get).toHaveBeenCalledWith(JPEG_KEY, { range: { offset: 2, length: undefined } });
		expect(response.headers.get('Content-Range')).toBe('bytes 2-3/4');
		expect(response.headers.get('Content-Length')).toBe('2');
	});

	it('streams the whole object as an attachment named recuerdo.<ext> by default', async () => {
		const get = getReturning(storedObject(JPEG_BYTES));
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'attachment' },
			createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
		);

		expect(response.status).toBe(200);
		expect(get).toHaveBeenCalledWith(JPEG_KEY, undefined);
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="recuerdo.jpg"',
		);
		expect(response.headers.get('Content-Range')).toBeNull();
		expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(await readAll(response.body)).toEqual(Array.from(JPEG_BYTES));
	});

	it('uses the default download name for videos and sanitizes caller-provided names', async () => {
		const cases: Array<[string, Record<string, unknown>, string]> = [
			['video default', { objectKey: MP4_KEY, mimeType: 'video/mp4' }, 'recuerdo.mp4'],
			[
				'safe name kept',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', downloadName: 'boda_01.jpg' },
				'boda_01.jpg',
			],
			[
				'unsafe characters replaced',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', downloadName: 'Mi Foto (1).JPG' },
				'Mi-Foto--1-.JPG',
			],
			[
				'wrong extension',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', downloadName: 'evil.exe' },
				'recuerdo.jpg',
			],
			[
				'non-string name',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', downloadName: 42 },
				'recuerdo.jpg',
			],
			[
				'header injection',
				{
					objectKey: JPEG_KEY,
					mimeType: 'image/jpeg',
					downloadName: 'a"\r\nX-Injected: 1.jpg',
				},
				'a---X-Injected--1.jpg',
			],
		];

		for (const [label, body, expected] of cases) {
			const get = getReturning(storedObject(new Uint8Array([1])));
			const response = await retrieve(
				{ ...body, mode: 'attachment' },
				createEnv({ MEMORIES_BUCKET: createBucket({ get }) }),
			);
			expect([label, response.status]).toEqual([label, 200]);
			expect([label, response.headers.get('Content-Disposition')]).toEqual([
				label,
				`attachment; filename="${expected}"`,
			]);
		}
	});

	it('answers 404 when the signed object is missing', async () => {
		const response = await retrieve({
			objectKey: JPEG_KEY,
			mimeType: 'image/jpeg',
			mode: 'inline',
		});
		expect(response.status).toBe(404);
	});
});

describe('memories retrieve worker: delete and validation', () => {
	it('deletes only the exact signed object key', async () => {
		const env = createEnv();
		const response = await retrieve(
			{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'delete' },
			env,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: true });
		expect(env.MEMORIES_BUCKET.delete).toHaveBeenCalledTimes(1);
		expect(env.MEMORIES_BUCKET.delete).toHaveBeenCalledWith(JPEG_KEY);
	});

	it('rejects keys that do not match the MIME type, legacy prefixes, invalid ranges and unknown fields without touching R2', async () => {
		const env = createEnv();
		const cases: Array<[string, Record<string, unknown>]> = [
			[
				'extension/MIME mismatch',
				{
					objectKey: buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'png'),
					mimeType: 'image/jpeg',
					mode: 'inline',
				},
			],
			[
				'legacy event prefix',
				{
					objectKey: `events/valentina/${OBJECT_ID}.jpg`,
					mimeType: 'image/jpeg',
					mode: 'inline',
				},
			],
			[
				'foreign prefix',
				{ objectKey: 'other/event.jpg', mimeType: 'image/jpeg', mode: 'inline' },
			],
			[
				'unsupported MIME',
				{
					objectKey: buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'pdf'),
					mimeType: 'application/pdf',
					mode: 'inline',
				},
			],
			['unknown mode', { objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'list' }],
			[
				'reversed range',
				{
					objectKey: JPEG_KEY,
					mimeType: 'image/jpeg',
					mode: 'inline',
					rangeStart: 5,
					rangeEnd: 4,
				},
			],
			[
				'negative range',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inline', rangeStart: -1 },
			],
			[
				'end without start',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inline', rangeEnd: 4 },
			],
			[
				'range on inspect',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inspect', rangeStart: 0 },
			],
			[
				'download name on delete',
				{
					objectKey: JPEG_KEY,
					mimeType: 'image/jpeg',
					mode: 'delete',
					downloadName: 'x.jpg',
				},
			],
			[
				'unknown field',
				{ objectKey: JPEG_KEY, mimeType: 'image/jpeg', mode: 'inline', bucket: 'other' },
			],
		];

		for (const [label, body] of cases) {
			const response = await retrieve(body, env);
			expect([label, response.status]).toEqual([label, 400]);
			expect(await response.json()).toEqual({ error: { code: 'invalid_request' } });
		}
		expect(env.MEMORIES_BUCKET.get).not.toHaveBeenCalled();
		expect(env.MEMORIES_BUCKET.delete).not.toHaveBeenCalled();
	});
});

describe('bounded media inspection', () => {
	it('recognizes allow-listed signatures and rejects mismatches', () => {
		expect(isMediaSignatureValid(JPEG_BYTES, 'image/jpeg')).toBe(true);
		expect(isMediaSignatureValid(JPEG_BYTES, 'IMAGE/JPEG ')).toBe(true);
		expect(isMediaSignatureValid(JPEG_BYTES, 'image/png')).toBe(false);
		expect(isMediaSignatureValid(PNG_BYTES, 'image/png')).toBe(true);
		expect(isMediaSignatureValid(PNG_BYTES, 'image/jpeg')).toBe(false);

		const webp = new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]);
		expect(isMediaSignatureValid(webp, 'image/webp')).toBe(true);

		const heic = new Uint8Array([0, 0, 0, 24, ...ascii('ftyp'), ...ascii('heic')]);
		expect(isMediaSignatureValid(heic, 'image/heic')).toBe(true);
		expect(isMediaSignatureValid(heic, 'image/heif')).toBe(true);
		expect(isMediaSignatureValid(ftypHeader(), 'image/heic')).toBe(false);

		expect(isMediaSignatureValid(ftypHeader(), 'video/mp4')).toBe(true);
		expect(isMediaSignatureValid(moovWithDuration(1), 'video/quicktime')).toBe(true);
		const wide = new Uint8Array([0, 0, 0, 8, ...ascii('wide'), 0, 0, 0, 0]);
		expect(isMediaSignatureValid(wide, 'video/quicktime')).toBe(true);
		expect(isMediaSignatureValid(wide, 'video/mp4')).toBe(false);

		expect(isMediaSignatureValid(JPEG_BYTES.subarray(0, 11), 'image/jpeg')).toBe(false);
		expect(isMediaSignatureValid(JPEG_BYTES, 'application/pdf')).toBe(false);
	});

	it('parses version 0 and version 1 mvhd durations from head and tail ranges', () => {
		expect(parseBoundedVideoDurationSeconds(moovWithDuration(15))).toBe(15);
		expect(parseBoundedVideoDurationSeconds(moovWithLongDuration(90))).toBe(90);
		expect(parseBoundedVideoDurationSeconds(ftypHeader())).toBeNull();
		expect(parseBoundedVideoDurationSeconds(new Uint8Array(16))).toBeNull();

		const partialPrefix = new Uint8Array(20).fill(0xaa);
		const tail = new Uint8Array(partialPrefix.byteLength + 48);
		tail.set(partialPrefix, 0);
		tail.set(moovWithDuration(7), partialPrefix.byteLength);
		expect(parseBoundedVideoDurationSeconds(tail)).toBe(7);
	});
});
