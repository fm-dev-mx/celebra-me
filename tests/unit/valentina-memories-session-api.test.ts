jest.mock('@/lib/memories/valentina-memories.service', () => ({
	clearGuestMemorySessionCookie: jest.fn(),
	createGuestMemorySession: jest.fn(),
	getGuestMemoryProfile: jest.fn(),
	getGuestMemorySessionFromRequest: jest.fn(),
	recoverGuestMemorySession: jest.fn(),
	setGuestMemorySessionCookie: jest.fn(),
	updateGuestMemoryProfile: jest.fn(),
}));

jest.mock('@/lib/memories/valentina-memories-rate-limit', () => ({
	requireValentinaMemoryRateLimit: jest.fn(),
}));

import {
	getGuestMemoryProfile,
	getGuestMemorySessionFromRequest,
} from '@/lib/memories/valentina-memories.service';
import { requireValentinaMemoryRateLimit } from '@/lib/memories/valentina-memories-rate-limit';
import { GET } from '@/pages/api/memories/valentina/session';

const mockGetSession = getGuestMemorySessionFromRequest as jest.MockedFunction<
	typeof getGuestMemorySessionFromRequest
>;
const mockGetProfile = getGuestMemoryProfile as jest.MockedFunction<typeof getGuestMemoryProfile>;
const mockRateLimit = requireValentinaMemoryRateLimit as jest.MockedFunction<
	typeof requireValentinaMemoryRateLimit
>;

function createContext(request: Request) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		props: {},
		locals: {},
		cookies: {} as never,
		redirect: jest.fn() as never,
		rewrite: jest.fn() as never,
		site: undefined,
		generator: 'Astro',
		clientAddress: '127.0.0.1',
	};
}

describe('GET /api/memories/valentina/session', () => {
	beforeEach(() => jest.clearAllMocks());

	it('treats an absent guest cookie as a normal private anonymous state', async () => {
		mockGetSession.mockResolvedValue(null);
		const request = new Request('https://www.celebra-me.com/api/memories/valentina/session');
		const response = await GET(createContext(request) as never);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile: null });
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockRateLimit).not.toHaveBeenCalled();
	});

	it('returns only the explicit browser profile for an active guest session', async () => {
		const session = { id: 'internal-session-id' } as never;
		const profile = {
			displayName: 'Tía Ana',
			expiresAt: '2026-09-28T00:00:00.000Z',
		};
		mockGetSession.mockResolvedValue(session);
		mockGetProfile.mockReturnValue(profile);
		const request = new Request('https://www.celebra-me.com/api/memories/valentina/session');
		const response = await GET(createContext(request) as never);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ profile });
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'read', 'internal-session-id');
	});
});
