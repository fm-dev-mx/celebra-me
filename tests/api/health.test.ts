import type { APIContext } from 'astro';
import { readBuildIdentity } from '@/lib/environment';
import { GET } from '@/pages/api/health';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

const mockReadBuildIdentity = readBuildIdentity as jest.MockedFunction<typeof readBuildIdentity>;

describe('GET /api/health', () => {
	afterEach(() => {
		mockReadBuildIdentity.mockReturnValue({ commitSha: null, gitRef: null });
	});

	it('returns unprivileged app health without env details', async () => {
		const response = await GET({} as unknown as APIContext);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body.status).toBe('healthy');
		expect(body.checks).toEqual({ runtime: { status: 'ok' } });
		expect(body).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
		expect(body).not.toHaveProperty('SUPABASE_URL');
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
