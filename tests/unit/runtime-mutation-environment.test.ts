import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import {
	assertRuntimeMutationEnvironment,
	resetRuntimeMutationEnvironmentCacheForTests,
} from '@/lib/server/runtime-mutation-environment';

function jwtForProject(projectRef: string): string {
	const payload = Buffer.from(JSON.stringify({ ref: projectRef })).toString('base64url');
	return `header.${payload}.signature`;
}

describe('runtime mutation environment guard', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		resetRuntimeMutationEnvironmentCacheForTests();
		process.env = { ...originalEnv };
		delete process.env.VERCEL_ENV;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it('accepts Local runtime with a credential verified by a read-only probe', async () => {
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'opaque-local-key';
		const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}'));

		await expect(assertRuntimeMutationEnvironment()).resolves.toMatchObject({
			environment: 'local',
			projectRef: SUPABASE_PROJECT_REFS.local,
		});
		expect(fetchSpy).toHaveBeenCalledWith(
			'http://127.0.0.1:54321/rest/v1/',
			expect.objectContaining({ method: 'GET' }),
		);
	});

	it('rejects a credential encoded for a different project before any network call', async () => {
		process.env.VERCEL_ENV = 'preview';
		process.env.SUPABASE_URL = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
		process.env.SUPABASE_SERVICE_ROLE_KEY = jwtForProject(SUPABASE_PROJECT_REFS.production);
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		fetchSpy.mockClear();

		await expect(assertRuntimeMutationEnvironment()).rejects.toThrow(/different project/);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('rejects a hosted cross-environment configuration without deployment identity', async () => {
		process.env.SUPABASE_URL = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
		process.env.SUPABASE_SERVICE_ROLE_KEY = jwtForProject(SUPABASE_PROJECT_REFS.preview);

		await expect(assertRuntimeMutationEnvironment()).rejects.toThrow(/ambiguous/);
	});

	it('rejects Production runtime configured with Preview Supabase', async () => {
		process.env.VERCEL_ENV = 'production';
		process.env.SUPABASE_URL = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
		process.env.SUPABASE_SERVICE_ROLE_KEY = jwtForProject(SUPABASE_PROJECT_REFS.preview);

		await expect(assertRuntimeMutationEnvironment()).rejects.toThrow(/must use project/);
	});
});
