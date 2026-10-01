jest.mock('@/lib/memories/server/space.service', () => ({
	assertMemorySpaceAcceptsGuests: jest.fn(),
	requirePublicMemorySpace: jest.fn(),
}));

jest.mock('@/lib/memories/server/guest-session.service', () => ({
	...jest.requireActual<typeof import('@/lib/memories/server/guest-session.service')>(
		'@/lib/memories/server/guest-session.service',
	),
	createGuestSession: jest.fn(),
	getGuestSessionFromRequest: jest.fn(),
	recoverGuestSession: jest.fn(),
	updateGuestProfile: jest.fn(),
}));

jest.mock('@/lib/memories/server/rate-limit', () => ({
	requireMemoriesRateLimit: jest.fn(),
}));

import { ApiError } from '@/lib/rsvp/core/errors';
import {
	createGuestSession,
	getGuestSessionFromRequest,
	recoverGuestSession,
	updateGuestProfile,
} from '@/lib/memories/server/guest-session.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import {
	assertMemorySpaceAcceptsGuests,
	requirePublicMemorySpace,
} from '@/lib/memories/server/space.service';
import { DELETE, GET, PATCH, POST } from '@/pages/api/memories/[slug]/session';
import { createMockRequest } from '../helpers/api-mocks';
import {
	PUBLIC_SLUG,
	RECOVERY_CODE,
	SESSION_ID,
	buildSessionRow,
	buildSpace,
} from '../unit/memories/fixtures';

const mockRequireSpace = requirePublicMemorySpace as jest.MockedFunction<
	typeof requirePublicMemorySpace
>;
const mockAcceptsGuests = assertMemorySpaceAcceptsGuests as jest.MockedFunction<
	typeof assertMemorySpaceAcceptsGuests
>;
const mockGetSession = getGuestSessionFromRequest as jest.MockedFunction<
	typeof getGuestSessionFromRequest
>;
const mockCreate = createGuestSession as jest.MockedFunction<typeof createGuestSession>;
const mockRecover = recoverGuestSession as jest.MockedFunction<typeof recoverGuestSession>;
const mockUpdateProfile = updateGuestProfile as jest.MockedFunction<typeof updateGuestProfile>;
const mockRateLimit = requireMemoriesRateLimit as jest.MockedFunction<
	typeof requireMemoriesRateLimit
>;

const ROUTE_URL = `https://celebra-me.com/api/memories/${PUBLIC_SLUG}/session`;
const COOKIE_NAME = `__Host-memories_${PUBLIC_SLUG}`;
const space = buildSpace();
const profile = { displayName: 'Tía Ana', expiresAt: space.retentionEndsAt };

type RouteContext = Parameters<typeof GET>[0];

function createCookies() {
	return { set: jest.fn(), delete: jest.fn(), get: jest.fn(), has: jest.fn() };
}

function createContext(request: Request, cookies = createCookies(), slug = PUBLIC_SLUG) {
	return {
		context: {
			request,
			params: { slug },
			cookies,
			locals: {},
			url: new URL(request.url),
		} as unknown as RouteContext,
		cookies,
	};
}

function getRequest(cookie?: string): Request {
	return createMockRequest(undefined, cookie ? { cookie } : undefined, ROUTE_URL);
}

function jsonRequest(body: unknown, cookie?: string): Request {
	return createMockRequest(body, cookie ? { cookie } : undefined, ROUTE_URL);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireSpace.mockResolvedValue(space);
	mockAcceptsGuests.mockReturnValue(undefined);
	mockRateLimit.mockResolvedValue(undefined);
	mockGetSession.mockResolvedValue(null);
});

describe('GET /api/memories/[slug]/session', () => {
	it('returns a null profile without resolving a session when no cookie is present', async () => {
		const response = await GET(createContext(getRequest()).context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile: null });
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockGetSession).not.toHaveBeenCalled();
		expect(mockRateLimit).not.toHaveBeenCalled();
	});

	it('ignores cookies that belong to other spaces', async () => {
		const response = await GET(
			createContext(getRequest('__Host-memories_otro-evento=x')).context,
		);
		await expect(response.json()).resolves.toEqual({ profile: null });
		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('returns the profile and throttles by session when the cookie resolves', async () => {
		mockGetSession.mockResolvedValue(buildSessionRow());
		const request = getRequest(`${COOKIE_NAME}=guest-token`);

		const response = await GET(createContext(request).context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile });
		expect(mockGetSession).toHaveBeenCalledWith(space, request);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'read', SESSION_ID);
	});

	it('returns a null profile when the cookie no longer resolves', async () => {
		const response = await GET(createContext(getRequest(`${COOKIE_NAME}=stale`)).context);
		await expect(response.json()).resolves.toEqual({ profile: null });
		expect(mockRateLimit).not.toHaveBeenCalled();
	});

	it('answers unknown slugs with a JSON 404', async () => {
		mockRequireSpace.mockRejectedValue(
			new ApiError(404, 'not_found', 'El espacio de recuerdos no está disponible.'),
		);
		const response = await GET(
			createContext(getRequest(), createCookies(), 'desconocido').context,
		);

		expect(response.status).toBe(404);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: { code: 'not_found', message: 'El espacio de recuerdos no está disponible.' },
		});
	});
});

describe('POST /api/memories/[slug]/session', () => {
	it('applies the anonymous session limit before parsing or resolving the space', async () => {
		mockRateLimit.mockRejectedValueOnce(
			new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.'),
		);
		const request = jsonRequest({ action: 'create', displayName: 'Tía Ana' });

		const response = await POST(createContext(request).context);

		expect(response.status).toBe(429);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'session');
		expect(mockRequireSpace).not.toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('creates a session, returns the recovery code and sets the per-space cookie', async () => {
		mockCreate.mockResolvedValue({
			sessionToken: 'session-token',
			recoveryCode: RECOVERY_CODE,
			profile,
		});
		const request = jsonRequest({ action: 'create', displayName: 'Tía Ana' });
		const { context, cookies } = createContext(request);

		const response = await POST(context);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			profile,
			recoveryCode: RECOVERY_CODE,
			recovered: false,
		});
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockRateLimit).toHaveBeenCalledTimes(1);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'session');
		expect(mockRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
			mockRequireSpace.mock.invocationCallOrder[0],
		);
		expect(mockAcceptsGuests).toHaveBeenCalledWith(space);
		expect(mockCreate).toHaveBeenCalledWith(space, 'Tía Ana');
		expect(cookies.set).toHaveBeenCalledTimes(1);
		expect(cookies.set).toHaveBeenCalledWith(
			COOKIE_NAME,
			'session-token',
			expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
		);
		expect(cookies.set.mock.calls[0][2].maxAge).toBeGreaterThanOrEqual(60);
	});

	it('reuses an existing session instead of creating another one', async () => {
		mockGetSession.mockResolvedValue(buildSessionRow());
		const { context, cookies } = createContext(
			jsonRequest({ action: 'create', displayName: 'Otra' }, `${COOKIE_NAME}=guest-token`),
		);

		const response = await POST(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile, recovered: false });
		expect(mockCreate).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('applies the recover limit on top of the session limit when recovering', async () => {
		mockRecover.mockResolvedValue({ sessionToken: 'rotated-token', profile });
		const request = jsonRequest({ action: 'recover', recoveryCode: RECOVERY_CODE });
		const { context, cookies } = createContext(request);

		const response = await POST(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile, recovered: true });
		expect(mockRateLimit.mock.calls).toEqual([
			[request, 'session'],
			[request, 'recover'],
		]);
		expect(mockRecover).toHaveBeenCalledWith(space, RECOVERY_CODE);
		expect(cookies.set).toHaveBeenCalledWith(COOKIE_NAME, 'rotated-token', expect.any(Object));
	});

	it('propagates a failed recovery as a JSON 401 without setting a cookie', async () => {
		mockRecover.mockRejectedValue(new ApiError(401, 'unauthorized', 'Código inválido.'));
		const { context, cookies } = createContext(
			jsonRequest({ action: 'recover', recoveryCode: 'ABCD-EFGH-JKLM' }),
		);

		const response = await POST(context);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: { code: 'unauthorized' },
		});
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects unknown actions with a 400', async () => {
		const response = await POST(createContext(jsonRequest({ action: 'login' })).context);
		expect(response.status).toBe(400);
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockRecover).not.toHaveBeenCalled();
	});

	it('rejects non-JSON bodies with a 400 before resolving the space', async () => {
		const request = createMockRequest(
			'action=create',
			{ 'Content-Type': 'text/plain' },
			ROUTE_URL,
		);
		const response = await POST(createContext(request).context);
		expect(response.status).toBe(400);
		expect(mockRequireSpace).not.toHaveBeenCalled();
	});

	it('answers a disabled space with a JSON 404', async () => {
		mockAcceptsGuests.mockImplementation(() => {
			throw new ApiError(404, 'not_found', 'El espacio de recuerdos no está disponible.');
		});
		const response = await POST(
			createContext(jsonRequest({ action: 'create', displayName: 'Tía Ana' })).context,
		);
		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
		expect(mockCreate).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/memories/[slug]/session', () => {
	it('returns a JSON 401 body when there is no guest session', async () => {
		const response = await PATCH(createContext(jsonRequest({ displayName: 'Ana' })).context);

		expect(response.status).toBe(401);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: { code: 'unauthorized', message: 'Inicie una sesión de recuerdos.' },
		});
		expect(mockUpdateProfile).not.toHaveBeenCalled();
		expect(mockRateLimit).not.toHaveBeenCalled();
	});

	it('updates the profile of the resolved session under the mutate limit', async () => {
		const session = buildSessionRow();
		mockGetSession.mockResolvedValue(session);
		mockUpdateProfile.mockResolvedValue({ ...profile, displayName: 'Ana' });
		const request = jsonRequest({ displayName: 'Ana' }, `${COOKIE_NAME}=guest-token`);

		const response = await PATCH(createContext(request).context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			profile: { ...profile, displayName: 'Ana' },
		});
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'mutate', SESSION_ID);
		expect(mockUpdateProfile).toHaveBeenCalledWith(space, session, 'Ana');
	});
});

describe('DELETE /api/memories/[slug]/session', () => {
	it('clears the per-space cookie', async () => {
		const { context, cookies } = createContext(getRequest(`${COOKIE_NAME}=guest-token`));

		const response = await DELETE(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(cookies.delete).toHaveBeenCalledWith(COOKIE_NAME, { path: '/' });
	});
});
