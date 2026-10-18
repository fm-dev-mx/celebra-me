jest.mock('@/lib/memories/server/space.service', () => ({
	assertMemorySpaceAcceptsGuests: jest.fn(),
	requirePublicMemorySpace: jest.fn(),
}));

jest.mock('@/lib/memories/server/guest-session.service', () => ({
	getGuestSessionFromRequest: jest.fn(),
	rotateGuestRecoveryCode: jest.fn(),
}));

jest.mock('@/lib/memories/server/rate-limit', () => ({
	requireMemoriesRateLimit: jest.fn(),
}));

import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getGuestSessionFromRequest,
	rotateGuestRecoveryCode,
} from '@/lib/memories/server/guest-session.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requirePublicMemorySpace } from '@/lib/memories/server/space.service';
import { POST } from '@/pages/api/memories/[slug]/session/recovery-code';
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
const mockGetSession = getGuestSessionFromRequest as jest.MockedFunction<
	typeof getGuestSessionFromRequest
>;
const mockRotate = rotateGuestRecoveryCode as jest.MockedFunction<typeof rotateGuestRecoveryCode>;
const mockRateLimit = requireMemoriesRateLimit as jest.MockedFunction<
	typeof requireMemoriesRateLimit
>;

const ROUTE_URL = `https://celebra-me.com/api/memories/${PUBLIC_SLUG}/session/recovery-code`;
const COOKIE_NAME = `__Host-memories_${PUBLIC_SLUG}`;
const space = buildSpace();

type RouteContext = Parameters<typeof POST>[0];

function createContext(request: Request) {
	return {
		request,
		params: { slug: PUBLIC_SLUG },
		cookies: { set: jest.fn(), delete: jest.fn(), get: jest.fn(), has: jest.fn() },
		locals: {},
		url: new URL(request.url),
	} as unknown as RouteContext;
}

function postRequest(cookie?: string): Request {
	return createMockRequest(undefined, cookie ? { cookie } : undefined, ROUTE_URL);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireSpace.mockResolvedValue(space);
	mockRateLimit.mockResolvedValue(undefined);
	mockGetSession.mockResolvedValue(null);
});

describe('POST /api/memories/[slug]/session/recovery-code', () => {
	it('answers 401 without a guest session and never issues a code', async () => {
		const response = await POST(createContext(postRequest()));

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: { code: 'unauthorized', message: 'Inicie una sesión de recuerdos.' },
		});
		expect(mockRotate).not.toHaveBeenCalled();
	});

	it('issues a new code for the caller own session under the mutate limit', async () => {
		const session = buildSessionRow();
		mockGetSession.mockResolvedValue(session);
		mockRotate.mockResolvedValue(RECOVERY_CODE);
		const request = postRequest(`${COOKIE_NAME}=guest-token`);

		const response = await POST(createContext(request));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ recoveryCode: RECOVERY_CODE });
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockGetSession).toHaveBeenCalledWith(space, request);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'mutate', SESSION_ID);
		expect(mockRotate).toHaveBeenCalledWith(space, session);
	});

	it('answers 429 when the session exceeds its limit and keeps the old code', async () => {
		mockGetSession.mockResolvedValue(buildSessionRow());
		mockRateLimit.mockRejectedValue(
			new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.'),
		);

		const response = await POST(createContext(postRequest(`${COOKIE_NAME}=guest-token`)));

		expect(response.status).toBe(429);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'rate_limited' } });
		expect(mockRotate).not.toHaveBeenCalled();
	});
});
