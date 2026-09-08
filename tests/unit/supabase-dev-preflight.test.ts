import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

// Execute the real hook without bootstrapping Astro or touching Docker/Supabase.
const config = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
const start = config.indexOf('function supabaseDevPreflightIntegration()');
const end = config.indexOf('export default defineConfig(', start);

function createPreflight(url: string | undefined, healthy: boolean) {
	const fetchMock = jest.fn().mockResolvedValue({ ok: healthy });
	const warn = jest.fn();
	const hook = runInNewContext(
		`${config.slice(start, end)}; supabaseDevPreflightIntegration().hooks['astro:server:start']`,
		{
			process: { env: { SUPABASE_URL: url } },
			fetch: fetchMock,
			AbortController,
			setTimeout,
			clearTimeout,
			console: { warn },
		},
	) as () => Promise<void>;
	return { hook, fetchMock, warn };
}

describe('Supabase development preflight', () => {
	it.each([undefined, 'https://example.supabase.co'])(
		'skips non-local target %s',
		async (url) => {
			const { hook, fetchMock, warn } = createPreflight(url, false);
			await hook();
			expect(fetchMock).not.toHaveBeenCalled();
			expect(warn).not.toHaveBeenCalled();
		},
	);

	it('performs one read-only health check when healthy', async () => {
		const { hook, fetchMock, warn } = createPreflight('http://127.0.0.1:54321', true);
		await hook();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:54321/auth/v1/health', {
			signal: expect.any(AbortSignal),
		});
		expect(warn).not.toHaveBeenCalled();
	});

	it.each(['http-error', 'network-error'])(
		'warns without recovery or retry after %s',
		async (failure) => {
			const { hook, fetchMock, warn } = createPreflight('http://127.0.0.1:54321', false);
			if (failure === 'network-error')
				fetchMock.mockRejectedValue(new TypeError('fetch failed'));
			await hook();
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining('pnpm db:start'),
			);
			// Starting the application must never acquire process-execution capabilities.
			expect(config.slice(start, end)).not.toMatch(/child_process|docker\s+restart/);
		},
	);
});
