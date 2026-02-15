import { ApiError } from './errors';
import { requireSessionContext, type SessionContext } from './auth';

export async function requireAuthenticatedSession(request: Request): Promise<SessionContext> {
	return requireSessionContext(request);
}

export async function requireAdminSession(request: Request): Promise<SessionContext> {
	const session = await requireSessionContext(request);
	if (!session.isSuperAdmin) {
		throw new ApiError(403, 'forbidden', 'No autorizado para administración global.');
	}
	return session;
}

export async function requireHostOrAdminSession(request: Request): Promise<SessionContext> {
	return requireSessionContext(request);
}
