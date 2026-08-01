/**
 * Access helper: admin strong session + Local observability runtime gate.
 */

import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import {
	isLocalObservabilityRuntime,
	readObservabilityRuntimeEnv,
} from './runtime-gate';

function assertLocalObservabilityRuntime(): void {
	if (!isLocalObservabilityRuntime(readObservabilityRuntimeEnv())) {
		throw new ApiError(404, 'not_found', 'Not found.');
	}
}

export async function requireLocalObservabilityAccess(
	request: Request,
): Promise<SessionContext> {
	assertLocalObservabilityRuntime();
	return requireAdminStrongSession(request);
}
