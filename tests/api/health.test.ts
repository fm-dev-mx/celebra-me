import type { APIContext } from 'astro';
import { readBuildIdentity } from '@/lib/environment';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { GET } from '@/pages/api/health';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const mockReadBuildIdentity = readBuildIdentity as jest.MockedFunction<typeof readBuildIdentity>;
const mockSupabaseRestRequest = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('GET /api/health', () => {
	beforeEach(() => {
		mockSupabaseRestRequest.mockReset();
		mockSupabaseRestRequest.mockResolvedValue([]);
	});

	afterEach(() => {
		mockReadBuildIdentity.mockReturnValue({ commitSha: null, gitRef: null });
	});

	it('returns unprivileged app health without env details', async () => {
		const response = await GET({} as unknown as APIContext);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body.status).toBe('healthy');
		expect(body.checks).toEqual({ runtime: { status: 'ok' }, database: { status: 'ok' } });
		expect(mockSupabaseRestRequest).toHaveBeenCalledWith({
			pathWithQuery: 'events?select=id&limit=1',
			useServiceRole: true,
			timeoutMs: 3000,
		});
		expect(body).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
		expect(body).not.toHaveProperty('SUPABASE_URL');
	});

	it('answers 503 when Supabase fails and still reports the build identity', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockSupabaseRestRequest.mockRejectedValue(new Error('connect ECONNREFUSED secret-host'));
		mockReadBuildIdentity.mockReturnValue({ commitSha: 'a'.repeat(40), gitRef: 'main' });
		asHostedDeploy('production');

		const response = await GET({} as unknown as APIContext);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(503);
		expect(body.status).toBe('unhealthy');
		expect(body.checks).toEqual({ runtime: { status: 'ok' }, database: { status: 'error' } });
		expect(body.build).toEqual({
			commitSha: 'a'.repeat(40),
			gitRef: 'main',
			environment: 'production',
		});
		expect(JSON.stringify(body)).not.toContain('secret-host');
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-host');
		consoleError.mockRestore();
	});

	it('exposes the build identity and the declared deploy environment', async () => {
		mockReadBuildIdentity.mockReturnValue({ commitSha: 'a'.repeat(40), gitRef: 'develop' });
		asHostedDeploy('preview');

		const body = (await (await GET({} as unknown as APIContext)).json()) as Record<
			string,
			unknown
		>;

		expect(body.build).toEqual({
			commitSha: 'a'.repeat(40),
			gitRef: 'develop',
			environment: 'preview',
		});
	});

	it('reports a null environment when the deploy identity is missing or invalid', async () => {
		for (const value of [undefined, 'staging']) {
			if (value !== undefined) asHostedDeploy(value);

			const body = (await (await GET({} as unknown as APIContext)).json()) as Record<
				string,
				unknown
			>;

			expect(body.build).toEqual({
				commitSha: null,
				gitRef: null,
				environment: null,
			});
		}
	});
});
