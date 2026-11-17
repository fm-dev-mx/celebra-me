import type { APIContext } from 'astro';
import { onRequest as middleware } from '@/middleware';
import { GET as getEvents } from '@/pages/api/dashboard/events';
import { POST as changePassword } from '@/pages/api/auth/change-password';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import { listHostEvents } from '@/lib/rsvp/services/event-admin.service';
import { createMockRequest } from '../helpers/api-mocks';
import {
	requireAdminStrongDashboardSessionFromLocals,
	requireDashboardMutationAccess,
} from '@/lib/rsvp/auth/authorization';
import { AuthRequestError } from '@/lib/rsvp/core/errors';
import { resetRateLimitProviderForTests } from '@/lib/rsvp/security/rate-limit-provider';
import { errorResponse } from '@/lib/rsvp/core/http';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	getAuthUserByAccessToken: jest.fn(),
	refreshAccessToken: jest.fn(),
	updateUserPasswordUserAuth: jest.fn(),
	adminSetUserMustChangePassword: jest.fn(),
	signInWithPassword: jest.fn(),
	revokeAuthSessions: jest.fn(),
}));
jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	listHostEvents: jest.fn(),
	listHostEventsWithDebug: jest.fn(),
}));

const lookup = jest.mocked(authApi.getAuthUserByAccessToken);
const listing = jest.mocked(listHostEvents);
const transports = ['cookie', 'bearer'] as const;

async function onRequest(
	context: APIContext,
	next: () => Response | Promise<Response>,
): Promise<Response> {
	const response = await middleware(context, async () => next());
	if (!(response instanceof Response)) throw new Error('Expected a middleware response');
	return response;
}

function fixture(transport: (typeof transports)[number], path = '/api/dashboard/events') {
	const values = new Map<string, string>();
	if (transport === 'cookie') values.set('sb-access-token', 'cookie-fixture');
	const headers: Record<string, string> = { Origin: 'http://localhost' };
	if (transport === 'bearer') headers.Authorization = 'Bearer bearer-fixture';
	else headers.Cookie = 'sb-access-token=cookie-fixture';
	const request = createMockRequest(undefined, headers, `http://localhost${path}`);
	const context = {
		request,
		url: new URL(request.url),
		locals: {},
		cookies: {
			get: (name: string) => {
				const value = values.get(name);
				return value === undefined ? undefined : { value };
			},
			set: jest.fn((name: string, value: string) => values.set(name, value)),
			delete: jest.fn((name: string) => values.delete(name)),
		},
		redirect: (location: string) =>
			new Response(null, { status: 302, headers: { Location: location } }),
	};
	const next = jest.fn(async () => getEvents(context as unknown as APIContext));
	return { context, next, values };
}

beforeEach(() => {
	jest.clearAllMocks();
	resetRateLimitProviderForTests();
	listing.mockResolvedValue([]);
	lookup.mockResolvedValue({
		id: 'synthetic-host',
		email: 'host@example.test',
		app_metadata: {
			role: 'host_client',
			must_change_password: false,
			temp_password_expires_at: '2999-01-01T00:00:00Z',
		},
	});
});

describe.each(transports)('dashboard password boundary using %s', (transport) => {
	it.each([
		['forced change without expiry', undefined],
		['unexpired temporary password', '2999-01-01T00:00:00Z'],
		['expired temporary password', '2000-01-01T00:00:00Z'],
	])('denies %s before the protected handler', async (_label, expiry) => {
		lookup.mockResolvedValue({
			id: 'synthetic-host',
			app_metadata: {
				role: 'host_client',
				must_change_password: true,
				temp_password_expires_at: expiry,
			},
		});
		const { context, next } = fixture(transport);
		const response = await onRequest(context as unknown as APIContext, next);
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: { code: 'password_change_required' },
		});
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		expect(next).not.toHaveBeenCalled();
		expect(listing).not.toHaveBeenCalled();
	});

	it('allows an unrestricted identity through the real events handler', async () => {
		const { context, next } = fixture(transport);
		const response = await onRequest(context as unknown as APIContext, next);
		expect(response.status).toBe(200);
		expect(next).toHaveBeenCalledTimes(1);
		expect(listing).toHaveBeenCalledTimes(1);
	});

	it('keeps the unexpired forced password-change endpoint reachable', async () => {
		lookup.mockResolvedValue({
			id: 'synthetic-host',
			email: 'host@example.test',
			app_metadata: {
				role: 'host_client',
				must_change_password: true,
				temp_password_expires_at: '2999-01-01T00:00:00Z',
			},
		});
		const { context } = fixture(transport, '/api/auth/change-password');
		context.request = createMockRequest(
			{ newPassword: 'SyntheticPassword2026!', confirmPassword: 'SyntheticPassword2026!' },
			{
				Origin: 'http://localhost',
				...(transport === 'bearer'
					? { Authorization: 'Bearer bearer-fixture' }
					: { Cookie: 'sb-access-token=cookie-fixture' }),
			},
			context.request.url,
		);
		jest.mocked(authApi.signInWithPassword).mockResolvedValue({
			access_token: 'fresh-fixture',
			refresh_token: 'fresh-refresh-fixture',
			user: { id: 'synthetic-host' },
		});
		const next = jest.fn(async () => changePassword(context as unknown as APIContext));
		const response = await onRequest(context as unknown as APIContext, next);
		expect(response.status).toBe(200);
		expect(next).toHaveBeenCalledTimes(1);
		expect(authApi.updateUserPasswordUserAuth).toHaveBeenCalledTimes(1);
	});

	it('rejects an expired password at the real change endpoint', async () => {
		lookup.mockResolvedValue({
			id: 'synthetic-host',
			app_metadata: {
				role: 'host_client',
				must_change_password: true,
				temp_password_expires_at: '2000-01-01T00:00:00Z',
			},
		});
		const { context } = fixture(transport, '/api/auth/change-password');
		const response = await onRequest(context as unknown as APIContext, () =>
			changePassword(context as unknown as APIContext),
		);
		expect(response.status).toBe(401);
		expect(authApi.updateUserPasswordUserAuth).not.toHaveBeenCalled();
	});

	it.each([
		['host_client', []],
		['super_admin', []],
	])('preserves admin denial for role %s without MFA', async (role, amr) => {
		lookup.mockResolvedValue({ id: 'synthetic-host', app_metadata: { role }, amr });
		const { context, values } = fixture(transport);
		values.set('sb-idle-seen', String(Math.floor(Date.now() / 1000) - 1));
		const service = jest.fn();
		const response = await onRequest(context as unknown as APIContext, async () => {
			try {
				requireAdminStrongDashboardSessionFromLocals(context.locals);
				service();
				return new Response(null, { status: 200 });
			} catch (error) {
				return errorResponse(error);
			}
		});
		expect(response.status).toBe(403);
		expect(service).not.toHaveBeenCalled();
	});

	it('preserves CSRF denial before a dashboard mutation', async () => {
		const { context } = fixture(transport);
		context.request = { ...context.request, method: 'POST' } as Request;
		const response = await onRequest(context as unknown as APIContext, async () => {
			try {
				await requireDashboardMutationAccess(
					context.request,
					context.cookies as unknown as APIContext['cookies'],
					context.locals,
				);
				return new Response(null, { status: 200 });
			} catch (error) {
				return errorResponse(error);
			}
		});
		expect(response.status).toBe(403);
	});

	it('allows an unrestricted admin with MFA through the existing strong-session guard', async () => {
		lookup.mockResolvedValue({
			id: 'synthetic-admin',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'totp' }],
		});
		const { context, values } = fixture(transport);
		values.set('sb-idle-seen', String(Math.floor(Date.now() / 1000) - 1));
		const response = await onRequest(context as unknown as APIContext, async () => {
			requireAdminStrongDashboardSessionFromLocals(context.locals);
			return new Response(null, { status: 200 });
		});
		expect(response.status).toBe(200);
	});
});

it.each([true, false])(
	'uses the Bearer identity with mixed credentials (restricted=%s)',
	async (restricted) => {
		lookup.mockImplementation(async (token) => ({
			id: token === 'bearer-fixture' ? 'bearer-host' : 'cookie-host',
			app_metadata: {
				role: 'host_client',
				must_change_password: token === 'bearer-fixture' ? restricted : !restricted,
			},
		}));
		const { context, next, values } = fixture('bearer');
		values.set('sb-access-token', 'cookie-fixture');
		values.set('sb-refresh-token', 'refresh-fixture');
		context.request = createMockRequest(
			undefined,
			{
				Authorization: 'Bearer bearer-fixture',
				Cookie: 'sb-access-token=cookie-fixture; sb-refresh-token=refresh-fixture',
			},
			context.request.url,
		);
		const response = await onRequest(context as unknown as APIContext, next);
		expect(response.status).toBe(restricted ? 403 : 200);
		expect(lookup.mock.calls.every(([token]) => token === 'bearer-fixture')).toBe(true);
		expect(authApi.refreshAccessToken).not.toHaveBeenCalled();
		expect(context.cookies.set).not.toHaveBeenCalled();
		if (restricted) {
			expect(next).not.toHaveBeenCalled();
			expect(listing).not.toHaveBeenCalled();
		} else {
			expect(context.locals).toMatchObject({ session: { userId: 'bearer-host' } });
			expect(listing).toHaveBeenCalledWith(
				expect.objectContaining({ hostUserId: 'bearer-host' }),
			);
		}
	},
);

it('does not fall back to a valid cookie when Bearer is rejected', async () => {
	lookup.mockRejectedValue(
		new AuthRequestError({ kind: 'http', operation: 'validate_access_token', status: 401 }),
	);
	const { context, next, values } = fixture('bearer');
	values.set('sb-access-token', 'cookie-fixture');
	const response = await onRequest(context as unknown as APIContext, next);
	expect(response.status).toBe(401);
	expect(listing).not.toHaveBeenCalled();
	expect(authApi.refreshAccessToken).not.toHaveBeenCalled();
});

it('retains cookie authentication for an empty Bearer header', async () => {
	const { context, next } = fixture('cookie');
	context.request = createMockRequest(
		undefined,
		{
			Authorization: 'Bearer ',
			Cookie: 'sb-access-token=cookie-fixture',
		},
		context.request.url,
	);
	const response = await onRequest(context as unknown as APIContext, next);
	expect(response.status).toBe(200);
	expect(lookup).toHaveBeenCalledWith('cookie-fixture');
	expect(context.locals).toMatchObject({ session: { userId: 'synthetic-host' } });
});

it('preserves cookies and rejects before the handler when the Bearer provider is unavailable', async () => {
	lookup.mockRejectedValue(
		new AuthRequestError({ kind: 'timeout', operation: 'validate_access_token' }),
	);
	const { context, next, values } = fixture('bearer');
	values.set('sb-access-token', 'cookie-fixture');
	const response = await onRequest(context as unknown as APIContext, next);
	expect(response.status).toBe(503);
	expect(response.headers.get('Retry-After')).toBe('5');
	expect(next).not.toHaveBeenCalled();
	expect(context.cookies.delete).not.toHaveBeenCalled();
	expect(context.cookies.set).not.toHaveBeenCalled();
	expect(authApi.refreshAccessToken).not.toHaveBeenCalled();
});
