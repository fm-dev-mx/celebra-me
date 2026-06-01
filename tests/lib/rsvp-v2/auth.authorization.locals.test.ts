import {
	requireDashboardSessionFromLocals,
	requireAdminDashboardSessionFromLocals,
	requireAdminStrongDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import type { SessionContext } from '@/lib/rsvp/auth/auth';

function makeSession(overrides: Partial<SessionContext> = {}): SessionContext {
	return {
		userId: 'user-1',
		email: 'user@test.com',
		accessToken: 'token-abc',
		role: 'host_client',
		isSuperAdmin: false,
		...overrides,
	};
}

describe('Locals-based authorization helpers', () => {
	describe('requireDashboardSessionFromLocals', () => {
		it('returns session when locals.session exists', () => {
			const session = makeSession();
			const result = requireDashboardSessionFromLocals({ session });
			expect(result).toBe(session);
		});

		it('throws 401 when locals.session is missing', () => {
			let error: unknown;
			try {
				requireDashboardSessionFromLocals({});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(401);
			expect((error as ApiError).code).toBe('unauthorized');
		});
	});

	describe('requireAdminDashboardSessionFromLocals', () => {
		it('returns session for super_admin', () => {
			const session = makeSession({ role: 'super_admin', isSuperAdmin: true });
			const result = requireAdminDashboardSessionFromLocals({ session });
			expect(result).toBe(session);
		});

		it('throws 403 for host_client (non-admin)', () => {
			let error: unknown;
			try {
				requireAdminDashboardSessionFromLocals({
					session: makeSession({ role: 'host_client', isSuperAdmin: false }),
				});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(403);
			expect((error as ApiError).code).toBe('forbidden');
		});

		it('throws 401 when no session exists', () => {
			let error: unknown;
			try {
				requireAdminDashboardSessionFromLocals({});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(401);
		});
	});

	describe('requireAdminStrongDashboardSessionFromLocals', () => {
		it('returns session for super_admin with strong auth', () => {
			const session = makeSession({ role: 'super_admin', isSuperAdmin: true });
			const result = requireAdminStrongDashboardSessionFromLocals({
				session,
				hasAdminStrongAuth: true,
			});
			expect(result).toBe(session);
		});

		it('throws 403 for super_admin without strong auth', () => {
			let error: unknown;
			try {
				requireAdminStrongDashboardSessionFromLocals({
					session: makeSession({ role: 'super_admin', isSuperAdmin: true }),
					hasAdminStrongAuth: false,
				});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(403);
			expect((error as ApiError).code).toBe('forbidden');
		});

		it('throws 403 for host_client even with strong auth', () => {
			let error: unknown;
			try {
				requireAdminStrongDashboardSessionFromLocals({
					session: makeSession({ role: 'host_client', isSuperAdmin: false }),
					hasAdminStrongAuth: true,
				});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(403);
			expect((error as ApiError).code).toBe('forbidden');
		});

		it('throws 401 when no session exists even with hasAdminStrongAuth', () => {
			let error: unknown;
			try {
				requireAdminStrongDashboardSessionFromLocals({
					session: undefined,
					hasAdminStrongAuth: true,
				});
			} catch (e) {
				error = e;
			}
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(401);
		});
	});
});
