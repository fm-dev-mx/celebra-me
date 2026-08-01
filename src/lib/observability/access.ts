/**
 * Access helper: super_admin strong session + Local observability runtime gate.
 */

import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { isLocalObservabilityRuntime, readObservabilityRuntimeEnv } from './runtime-gate';

function assertLocalObservabilityRuntime(): void {
	if (!isLocalObservabilityRuntime(readObservabilityRuntimeEnv())) {
		throw new ApiError(404, 'not_found', 'Not found.');
	}
}

/**
 * Order: strong super_admin session → persistent-Local runtime.
 * Callers should apply rate limiting after this returns and before probes.
 */
export async function requireLocalObservabilityAccess(request: Request): Promise<SessionContext> {
	const session = await requireAdminStrongSession(request);
	assertLocalObservabilityRuntime();
	return session;
}
