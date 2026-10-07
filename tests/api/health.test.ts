import type { APIContext } from 'astro';
import { GET } from '@/pages/api/health';

const BUILD_KEYS = [
	'VERCEL_GIT_COMMIT_SHA',
	'VERCEL_GIT_COMMIT_REF',
	'VERCEL_DEPLOYMENT_ID',
	'VERCEL_ENV',
] as const;

describe('GET /api/health', () => {
	const original = Object.fromEntries(BUILD_KEYS.map((key) => [key, process.env[key]]));

	afterEach(() => {
		for (const key of BUILD_KEYS) {
			if (original[key] === undefined) delete process.env[key];
			else process.env[key] = original[key];
		}
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

	it('exposes the deployment build identity', async () => {
		process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
		process.env.VERCEL_GIT_COMMIT_REF = 'develop';
		process.env.VERCEL_DEPLOYMENT_ID = 'dpl_test';
		process.env.VERCEL_ENV = 'preview';

		const body = (await (await GET({} as unknown as APIContext)).json()) as Record<
			string,
			unknown
		>;

		expect(body.build).toEqual({
			commitSha: 'a'.repeat(40),
			gitRef: 'develop',
			deploymentId: 'dpl_test',
			environment: 'preview',
		});
	});

	it('reports null build identity outside Vercel', async () => {
		for (const key of BUILD_KEYS) delete process.env[key];

		const body = (await (await GET({} as unknown as APIContext)).json()) as Record<
			string,
			unknown
		>;

		expect(body.build).toEqual({
			commitSha: null,
			gitRef: null,
			deploymentId: null,
			environment: null,
		});
	});
});
