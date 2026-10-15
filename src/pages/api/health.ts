import type { APIRoute } from 'astro';
import { readBuildIdentity } from '@/lib/environment';
import { jsonResponse } from '@/lib/rsvp/core/http';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { readHostedDeployEnvironment } from '@/lib/server/deploy-identity';

const DATABASE_TIMEOUT_MS = 3_000;

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

/** One indexed single-row read proves Supabase answers; no row data leaves this function. */
async function checkDatabase(): Promise<'ok' | 'error'> {
	try {
		await supabaseRestRequest<unknown[]>({
			pathWithQuery: 'events?select=id&limit=1',
			useServiceRole: true,
			timeoutMs: DATABASE_TIMEOUT_MS,
		});
		return 'ok';
	} catch (error: unknown) {
		console.error(
			`[health] database check failed: ${error instanceof Error ? error.name : 'unknown'}`,
		);
		return 'error';
	}
}

export const GET: APIRoute = async () => {
	const database = await checkDatabase();
	const healthy = database === 'ok';
	// The build identity is reported either way, so release tooling still reads the SHA.
	return jsonResponse(
		{
			status: healthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			build: readPublicBuildIdentity(),
			checks: {
				runtime: { status: 'ok' },
				database: { status: database },
			},
		},
		healthy ? 200 : 503,
	);
};
