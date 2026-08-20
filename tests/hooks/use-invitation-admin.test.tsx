import { act, renderHook } from '@testing-library/react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import { adminApi } from '@/lib/dashboard/admin-api';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		listInvitations: jest.fn(),
		archiveInvitation: jest.fn(),
		restoreInvitation: jest.fn(),
		permanentlyDeleteInvitation: jest.fn(),
	},
}));

const listInvitationsMock = adminApi.listInvitations as jest.MockedFunction<
	typeof adminApi.listInvitations
>;

describe('useInvitationAdmin hook', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('does not load invitations on mount by default (autoLoad=false)', () => {
		renderHook(() => useInvitationAdmin());

		expect(listInvitationsMock).not.toHaveBeenCalled();
	});

	it('loads invitations on mount when autoLoad=true', async () => {
		const mockItems = [
			{
				id: 'inv-1',
				kind: 'client' as const,
				title: 'Invitación Demo',
				eventType: 'xv' as const,
				status: 'draft' as const,
			},
		];
		listInvitationsMock.mockResolvedValue({ items: mockItems } as never);

		const { result } = renderHook(() => useInvitationAdmin({ autoLoad: true }));

		// Wait for promise resolution
		await act(async () => {
			await Promise.resolve();
		});

		expect(listInvitationsMock).toHaveBeenCalledTimes(1);
		expect(result.current.items).toEqual(mockItems);
	});

	it('reloads invitations explicitly via reloadInvitations', async () => {
		listInvitationsMock.mockResolvedValue({ items: [] } as never);

		const { result } = renderHook(() => useInvitationAdmin({ autoLoad: false }));
		expect(listInvitationsMock).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.reloadInvitations();
		});

		expect(listInvitationsMock).toHaveBeenCalledTimes(1);
	});
});
