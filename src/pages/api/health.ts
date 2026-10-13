import type { APIRoute } from 'astro';
import { readBuildIdentity } from '@/lib/environment';
import { jsonResponse } from '@/lib/rsvp/core/http';
import { readHostedDeployEnvironment } from '@/lib/server/deploy-identity';

/**
 * Public build identity lets release tooling correlate a serving URL with its build.
 * `environment` is null when the deploy identity is local, missing or invalid, which
 * release checks treat as a mismatch for any hosted target.
 */
const readPublicBuildIdentity = () => {
	const { commitSha, gitRef } = readBuildIdentity();
	return {
		commitSha,
		gitRef,
		environment: readHostedDeployEnvironment(),
	};
};

export const GET: APIRoute = async () => {
	return jsonResponse(
		{
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			build: readPublicBuildIdentity(),
			checks: {
				runtime: { status: 'ok' },
			},
		},
		200,
	);
};
