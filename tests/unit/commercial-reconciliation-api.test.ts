jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/commercial/reconciliation.service', () => ({
	findCommercialIdentityCandidates: jest.fn(),
}));

import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { findCommercialIdentityCandidates } from '@/lib/commercial/reconciliation.service';
import { GET } from '@/pages/api/dashboard/commercial/reconciliation';

const mockRequireAdminStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockRequireAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockFindCandidates = findCommercialIdentityCandidates as jest.MockedFunction<
	typeof findCommercialIdentityCandidates
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

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireAdminStrongSession.mockResolvedValue({ isSuperAdmin: true } as never);
	mockRequireAdminRateLimit.mockResolvedValue(undefined);
	mockFindCandidates.mockResolvedValue({
		normalizedEmail: 'client@example.com',
		byLeadCode: null,
		byPhone: [],
		byEmail: [],
		recentContext: [],
	});
});

describe('/api/dashboard/commercial/reconciliation', () => {
	it('returns commercial identity candidates for super-admin dashboard search', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/reconciliation?leadCode=CM-ABC123&phone=%2B526141234567&email=Client%40Example.com&name=Valentina',
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockRequireAdminRateLimit).toHaveBeenCalledWith(
			request,
			'commercial:reconciliation:search',
		);
		expect(mockRequireAdminStrongSession).toHaveBeenCalledWith(request);
		expect(mockFindCandidates).toHaveBeenCalledWith({
			leadCode: 'CM-ABC123',
			phone: '+526141234567',
			email: 'Client@Example.com',
			name: 'Valentina',
			eventType: undefined,
			packageInterest: undefined,
		});
		expect(body.data.normalizedEmail).toBe('client@example.com');
	});
});
