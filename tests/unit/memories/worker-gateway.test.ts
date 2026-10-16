jest.mock('@/lib/memories/server/private-request', () => ({
	resolveMemoriesWorkerUrl: jest.fn(
		(_originEnvName: string, path: string) =>
			new URL(path, 'https://memories-retrieve.example.invalid'),
	),
	createMemoriesPrivateRequestHeaders: () => ({ 'X-Test-Signature': 'signed' }),
}));

import {
	deleteMemoriesObject,
	inspectMemoriesObject,
	isMemoriesSignerRateLimit,
	requestMemoriesUploadCapability,
	retrieveMemoriesObject,
} from '@/lib/memories/server/worker-gateway';
import { MEMORIES_INSPECTION_TIMEOUT_MS } from '@/lib/memories/contract/limits';
import {
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	MEMORIES_RETRIEVAL_PATH,
} from '@/lib/memories/contract/private-request';
import { resolveMemoriesWorkerUrl } from '@/lib/memories/server/private-request';
import {
	MEMORIES_RETRIEVE_BINDING_ORIGIN,
	installMemoriesRetrieveBinding,
	resetMemoriesRetrieveBindingForTests,
} from '@/lib/memories/server/retrieve-binding';
import { CHECKSUM_SHA256, OBJECT_KEY, SESSION_ID } from './fixtures';

const target = { objectKey: OBJECT_KEY, mimeType: 'image/jpeg' };
const originalFetch = global.fetch;
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('inspectMemoriesObject', () => {
	beforeEach(() => {
		mockFetch.mockReset();
		global.fetch = mockFetch as unknown as typeof fetch;
	});

	it('returns the inspection when the Worker found the object', async () => {
		const inspection = {
			exists: true,
			sizeBytes: 10,
			checksumSha256: CHECKSUM_SHA256,
			signatureValid: true,
			durationSeconds: null,
		};
		mockFetch.mockResolvedValue(json(200, inspection));
		await expect(inspectMemoriesObject(target)).resolves.toEqual({ kind: 'found', inspection });
	});

	it('reports missing only when the Worker answered that the object is absent', async () => {
		mockFetch.mockResolvedValue(json(200, { exists: false }));
		await expect(inspectMemoriesObject(target)).resolves.toEqual({ kind: 'missing' });
	});

	it.each([
		['a 404 from a misrouted request', () => json(404, { error: { code: 'not_found' } })],
		['a 503 from an unconfigured Worker', () => json(503, { error: { code: 'unavailable' } })],
		['a body without an existence flag', () => json(200, { sizeBytes: 10 })],
		['a body that is not JSON', () => new Response('<html>', { status: 200 })],
	])('treats %s as unavailable', async (_label, response) => {
		mockFetch.mockResolvedValue(response());
		await expect(inspectMemoriesObject(target)).resolves.toEqual({ kind: 'unavailable' });
	});

	it('treats a transport failure as unavailable', async () => {
		mockFetch.mockRejectedValue(new TypeError('fetch failed'));
		await expect(inspectMemoriesObject(target)).resolves.toEqual({ kind: 'unavailable' });
	});

	describe('waiting on a slow Worker', () => {
		let timeoutSpy: jest.SpyInstance<AbortSignal, [number]>;
		beforeEach(() => {
			timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
		});
		afterEach(() => timeoutSpy.mockRestore());

		it('gives up on an inspection well before the platform cuts the request', async () => {
			mockFetch.mockResolvedValue(json(200, { exists: false }));
			await inspectMemoriesObject(target);

			expect(timeoutSpy).toHaveBeenCalledWith(MEMORIES_INSPECTION_TIMEOUT_MS);
			expect(MEMORIES_INSPECTION_TIMEOUT_MS).toBeLessThan(30_000);
			expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
		});

		it('treats an inspection that timed out as unavailable, never as missing', async () => {
			mockFetch.mockRejectedValue(
				new DOMException('The operation timed out.', 'TimeoutError'),
			);
			await expect(inspectMemoriesObject(target)).resolves.toEqual({ kind: 'unavailable' });
		});

		it('keeps the full signed lifetime for streamed downloads', async () => {
			mockFetch.mockResolvedValue(new Response('bytes', { status: 200 }));
			await retrieveMemoriesObject({
				...target,
				mode: 'attachment',
				downloadName: 'foto.jpg',
			});

			expect(timeoutSpy).toHaveBeenCalledWith(
				(MEMORIES_PRIVATE_REQUEST_TTL_SECONDS + 10) * 1000,
			);
			expect(timeoutSpy).not.toHaveBeenCalledWith(MEMORIES_INSPECTION_TIMEOUT_MS);
		});
	});
});

describe('retrieveMemoriesObject transport', () => {
	const binding = { fetch: jest.fn<Promise<Response>, [Request]>() };

	beforeEach(() => {
		mockFetch.mockReset();
		binding.fetch.mockReset();
		global.fetch = mockFetch as unknown as typeof fetch;
	});
	afterEach(() => resetMemoriesRetrieveBindingForTests());

	it('calls the configured origin when no Service Binding is installed', async () => {
		mockFetch.mockResolvedValue(new Response('bytes', { status: 200 }));
		await retrieveMemoriesObject({ ...target, mode: 'inline' });

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(String(url)).toBe(
			`https://memories-retrieve.example.invalid${MEMORIES_RETRIEVAL_PATH}`,
		);
		expect(init?.headers).toEqual({ 'X-Test-Signature': 'signed' });
	});

	it('sends the same signed request through the Service Binding when installed', async () => {
		expect(installMemoriesRetrieveBinding({ MEMORIES_RETRIEVE: binding })).toBe(true);
		binding.fetch.mockResolvedValue(new Response('bytes', { status: 200 }));
		const response = await retrieveMemoriesObject({
			...target,
			mode: 'attachment',
			downloadName: 'foto.jpg',
			range: 'bytes=0-9',
		});

		expect(response.status).toBe(200);
		expect(mockFetch).not.toHaveBeenCalled();
		const request = binding.fetch.mock.calls[0][0];
		expect(request.method).toBe('POST');
		expect(new URL(request.url).pathname).toBe(MEMORIES_RETRIEVAL_PATH);
		expect(request.headers.get('X-Test-Signature')).toBe('signed');
		await expect(request.json()).resolves.toEqual({
			objectKey: OBJECT_KEY,
			mimeType: 'image/jpeg',
			mode: 'attachment',
			downloadName: 'foto.jpg',
			rangeStart: 0,
			rangeEnd: 9,
		});
	});

	it('reaches the Service Binding even without a configured origin', async () => {
		installMemoriesRetrieveBinding({ MEMORIES_RETRIEVE: binding });
		jest.mocked(resolveMemoriesWorkerUrl).mockReturnValueOnce(null);
		binding.fetch.mockResolvedValue(new Response(null, { status: 200 }));

		await expect(deleteMemoriesObject(target)).resolves.toBe(true);
		expect(binding.fetch.mock.calls[0][0].url).toBe(
			`${MEMORIES_RETRIEVE_BINDING_ORIGIN}${MEMORIES_RETRIEVAL_PATH}`,
		);
	});

	it('answers 503 without a configured origin or a Service Binding', async () => {
		jest.mocked(resolveMemoriesWorkerUrl).mockReturnValueOnce(null);

		const response = await retrieveMemoriesObject({ ...target, mode: 'inspect' });
		expect(response.status).toBe(503);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('ignores an env entry that is not a Service Binding', () => {
		expect(installMemoriesRetrieveBinding({ MEMORIES_RETRIEVE: 'https://x.invalid' })).toBe(
			false,
		);
		expect(installMemoriesRetrieveBinding(undefined)).toBe(false);
	});
});

describe('requestMemoriesUploadCapability', () => {
	const reservation = {
		objectKey: OBJECT_KEY,
		sessionId: SESSION_ID,
		mimeType: 'image/jpeg',
		sizeBytes: 10,
		checksumSha256: CHECKSUM_SHA256,
	};

	beforeEach(() => {
		mockFetch.mockReset();
		global.fetch = mockFetch as unknown as typeof fetch;
	});

	it('tells a per-session throttle apart from any other signer failure', async () => {
		mockFetch.mockResolvedValueOnce(json(429, { error: { code: 'rate_limited' } }));
		const throttled = await requestMemoriesUploadCapability(reservation).catch(
			(error: unknown) => error,
		);
		mockFetch.mockResolvedValueOnce(json(503, { error: { code: 'unavailable' } }));
		const unavailable = await requestMemoriesUploadCapability(reservation).catch(
			(error: unknown) => error,
		);

		expect(throttled).toMatchObject({ name: 'MemoriesSignerError', status: 429 });
		expect(isMemoriesSignerRateLimit(throttled)).toBe(true);
		expect(unavailable).toMatchObject({ name: 'MemoriesSignerError', status: 503 });
		expect(isMemoriesSignerRateLimit(unavailable)).toBe(false);
		expect(isMemoriesSignerRateLimit(new TypeError('fetch failed'))).toBe(false);
	});

	afterAll(() => {
		global.fetch = originalFetch;
	});
});
