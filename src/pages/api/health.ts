import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/rsvp/core/http';
import { getEnv } from '@/lib/server/env';

/** Public build identity lets release tooling correlate a serving URL with its deployment. */
const readBuildIdentity = () => ({
	commitSha: getEnv('VERCEL_GIT_COMMIT_SHA') || null,
	gitRef: getEnv('VERCEL_GIT_COMMIT_REF') || null,
	deploymentId: getEnv('VERCEL_DEPLOYMENT_ID') || null,
	environment: getEnv('VERCEL_ENV') || null,
});

export const GET: APIRoute = async () => {
	return jsonResponse(
		{
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			build: readBuildIdentity(),
			checks: {
				runtime: { status: 'ok' },
			},
		},
		200,
	);
};
