import { generateKeyPairSync } from 'node:crypto';
import { checkMemoriesReadiness } from '@/lib/memories/server/readiness.service';
import {
	installMemoriesRetrieveBinding,
	installMemoriesSignBinding,
	resetMemoriesRetrieveBindingForTests,
	resetMemoriesSignBindingForTests,
} from '@/lib/memories/server/worker-bindings';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const SHARE_SECRET = 's'.repeat(40);

const ENV_NAMES = [
	'MEMORIES_PRIVATE_UPLOAD_ORIGIN',
	'MEMORIES_PRIVATE_RETRIEVAL_ORIGIN',
	'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY',
	'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY',
	'MEMORIES_SHARE_SECRET',
	'CRON_SECRET',
] as const;

function configure(values: Partial<Record<(typeof ENV_NAMES)[number], string>>) {
	for (const name of ENV_NAMES) {
		if (values[name] === undefined) delete process.env[name];
		else process.env[name] = values[name];
	}
}

const COMPLETE = {
	MEMORIES_PRIVATE_UPLOAD_ORIGIN: 'http://127.0.0.1:8787',
	MEMORIES_PRIVATE_RETRIEVAL_ORIGIN: 'http://127.0.0.1:8788',
	MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY: PRIVATE_PEM,
	MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY: PRIVATE_PEM.replace(/\n/g, '\\n'),
	MEMORIES_SHARE_SECRET: SHARE_SECRET,
	CRON_SECRET: 'cron-secret',
};

describe('checkMemoriesReadiness', () => {
	const saved = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
	afterAll(() => configure(saved as Record<string, string>));

	it('reports nothing when every setting is usable and both Workers answer', async () => {
		configure(COMPLETE);
		const fetchImpl = jest.fn(async () => new Response(null, { status: 404 }));

		await expect(
			checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
		).resolves.toEqual({ missing: [], unreachable: [] });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('names every missing or unusable setting without revealing any value', async () => {
		configure({
			MEMORIES_PRIVATE_UPLOAD_ORIGIN: 'ftp://not-a-worker',
			MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY: 'not a pem',
			MEMORIES_SHARE_SECRET: 'too-short',
		});

		const readiness = await checkMemoriesReadiness({ probeWorkers: false });

		expect(readiness.missing).toEqual([
			'uploadOrigin',
			'retrievalOrigin',
			'uploadSigningKey',
			'retrievalSigningKey',
			'shareSecret',
			'cronSecret',
		]);
		const serialized = JSON.stringify(readiness);
		expect(serialized).not.toContain('not-a-worker');
		expect(serialized).not.toContain('too-short');
	});

	it('marks a configured Worker that does not answer as unreachable', async () => {
		configure(COMPLETE);
		const fetchImpl = jest.fn(async (input: URL | RequestInfo) => {
			if (String(input).includes('8788')) throw new TypeError('connect ECONNREFUSED');
			return new Response(null, { status: 401 });
		});

		await expect(
			checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
		).resolves.toEqual({ missing: [], unreachable: ['retrievalOrigin'] });
	});

	it('does not probe an origin that is not configured', async () => {
		configure({ ...COMPLETE, MEMORIES_PRIVATE_UPLOAD_ORIGIN: '' });
		const fetchImpl = jest.fn(async () => new Response(null));

		const readiness = await checkMemoriesReadiness({
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(readiness).toEqual({ missing: ['uploadOrigin'], unreachable: [] });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	describe('with the retrieval Service Binding', () => {
		const binding = { fetch: jest.fn(async () => new Response(null, { status: 404 })) };
		beforeEach(() => {
			binding.fetch.mockClear();
			installMemoriesRetrieveBinding({ MEMORIES_RETRIEVE: binding });
		});
		afterEach(() => resetMemoriesRetrieveBindingForTests());

		it('needs no retrieval origin and probes the Worker through the binding', async () => {
			configure({ ...COMPLETE, MEMORIES_PRIVATE_RETRIEVAL_ORIGIN: '' });
			const fetchImpl = jest.fn<Promise<Response>, [URL | RequestInfo]>(
				async () => new Response(null, { status: 404 }),
			);

			await expect(
				checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
			).resolves.toEqual({ missing: [], unreachable: [] });
			expect(binding.fetch).toHaveBeenCalledTimes(1);
			expect(fetchImpl).toHaveBeenCalledTimes(1);
			expect(String(fetchImpl.mock.calls[0][0])).toContain('8787');
		});

		it('marks the retrieval Worker unreachable when the binding fails', async () => {
			configure(COMPLETE);
			binding.fetch.mockRejectedValueOnce(new Error('service unavailable'));
			const fetchImpl = jest.fn(async () => new Response(null, { status: 404 }));

			await expect(
				checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
			).resolves.toEqual({ missing: [], unreachable: ['retrievalOrigin'] });
		});
	});

	describe('with the sign Service Binding', () => {
		const binding = { fetch: jest.fn(async () => new Response(null, { status: 404 })) };
		beforeEach(() => {
			binding.fetch.mockClear();
			installMemoriesSignBinding({ MEMORIES_SIGN: binding });
		});
		afterEach(() => resetMemoriesSignBindingForTests());

		it('probes the sign Worker through the binding and still needs its public origin', async () => {
			configure({ ...COMPLETE, MEMORIES_PRIVATE_UPLOAD_ORIGIN: '' });
			const fetchImpl = jest.fn(async () => new Response(null, { status: 404 }));

			await expect(
				checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
			).resolves.toEqual({ missing: ['uploadOrigin'], unreachable: [] });
			expect(binding.fetch).not.toHaveBeenCalled();

			configure(COMPLETE);
			await expect(
				checkMemoriesReadiness({ fetchImpl: fetchImpl as unknown as typeof fetch }),
			).resolves.toEqual({ missing: [], unreachable: [] });
			expect(binding.fetch).toHaveBeenCalledTimes(1);
		});
	});
});
