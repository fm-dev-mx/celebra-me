jest.mock('@/lib/memories/server/private-request', () => ({
	resolveMemoriesWorkerUrl: () => new URL('https://memories-retrieve.example.invalid/retrieve'),
	createMemoriesPrivateRequestHeaders: () => ({}),
}));

import { inspectMemoriesObject } from '@/lib/memories/server/worker-gateway';
import { CHECKSUM_SHA256, OBJECT_KEY } from './fixtures';

const target = { objectKey: OBJECT_KEY, mimeType: 'image/jpeg' };
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
});
