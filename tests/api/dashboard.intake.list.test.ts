jest.mock('astro:content', () => ({ getCollection: jest.fn() }));
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn().mockResolvedValue({ userId: 'admin-1', isSuperAdmin: true }),
	requireAdminMutationAccess: jest.fn(),
}));
jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/intake/services/invitation.service', () => ({
	getEnrichedInvitationList: jest.fn(),
	synchronizeDemoInvitations: jest.fn(),
}));

import { GET } from '@/pages/api/dashboard/intake/index';
import {
	getEnrichedInvitationList,
	synchronizeDemoInvitations,
} from '@/lib/intake/services/invitation.service';
import { createMockRequest } from '../helpers/api-mocks';

const getEnrichedInvitationListMock = getEnrichedInvitationList as jest.MockedFunction<
	typeof getEnrichedInvitationList
>;
const synchronizeDemoInvitationsMock = synchronizeDemoInvitations as jest.MockedFunction<
	typeof synchronizeDemoInvitations
>;

describe('GET /api/dashboard/intake', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns enriched invitations fast without syncing demos by default', async () => {
		const mockItems = [
			{
				id: 'inv-1',
				kind: 'client' as const,
				title: 'Boda de Prueba',
				eventType: 'boda' as const,
				status: 'published' as const,
				published: true,
			},
		];
		getEnrichedInvitationListMock.mockResolvedValue(mockItems as never);

		const response = await GET({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/intake',
			),
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ items: mockItems });
		expect(synchronizeDemoInvitationsMock).not.toHaveBeenCalled();
		expect(getEnrichedInvitationListMock).toHaveBeenCalledWith('active');
	});

	it('passes scope all when includeArchived=true is present', async () => {
		getEnrichedInvitationListMock.mockResolvedValue([] as never);

		const response = await GET({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/intake?includeArchived=true',
			),
		} as never);

		expect(response.status).toBe(200);
		expect(synchronizeDemoInvitationsMock).not.toHaveBeenCalled();
		expect(getEnrichedInvitationListMock).toHaveBeenCalledWith('all');
	});

	it('keeps syncDemos=true read-only and does not synchronize during GET', async () => {
		getEnrichedInvitationListMock.mockResolvedValue([] as never);
		synchronizeDemoInvitationsMock.mockResolvedValue(undefined);

		const response = await GET({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/intake?syncDemos=true',
			),
		} as never);

		expect(response.status).toBe(200);
		expect(synchronizeDemoInvitationsMock).not.toHaveBeenCalled();
		expect(getEnrichedInvitationListMock).toHaveBeenCalledWith('active');
	});
});
