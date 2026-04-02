import { act, renderHook, waitFor } from '@testing-library/react';
import { useUsersAdmin } from '@/hooks/use-users-admin';
import { adminApi } from '@/lib/dashboard/admin-api';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		listUsers: jest.fn(),
		listEvents: jest.fn(),
		createUser: jest.fn(),
		updateUserRole: jest.fn(),
		updateUserEventMembership: jest.fn(),
	},
}));

const mockedAdminApi = adminApi as jest.Mocked<typeof adminApi>;

describe('users admin hook', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedAdminApi.listUsers.mockResolvedValue({
			items: [],
			total: 0,
			page: 1,
			perPage: 50,
		});
		mockedAdminApi.listEvents.mockResolvedValue({
			items: [],
			total: 0,
			page: 1,
			perPage: 50,
		});
	});

	it('stores one-time credentials after creating a user without email', async () => {
		mockedAdminApi.createUser.mockResolvedValue({
			item: {
				id: 'user-1',
				email: 'cliente-ab12cd34',
				role: 'host_client',
				createdAt: '2026-04-01T00:00:00.000Z',
			},
			credentials: {
				temporaryPassword: 'clienteab12c2026',
			},
		});

		const { result } = renderHook(() => useUsersAdmin());

		await waitFor(() => {
			expect(mockedAdminApi.listUsers).toHaveBeenCalledTimes(1);
		});

		act(() => {
			result.current.openCreateModal();
		});

		await act(async () => {
			await result.current.createUser({
				email: '',
				role: 'host_client',
			});
		});

		expect(mockedAdminApi.createUser).toHaveBeenCalledWith({
			email: '',
			role: 'host_client',
		});
		expect(result.current.createdUser).toEqual({
			email: 'cliente-ab12cd34',
			role: 'host_client',
			temporaryPassword: 'clienteab12c2026',
		});
		expect(result.current.createModalOpen).toBe(true);
		expect(result.current.creating).toBe(false);
	});

	it('assigns an event to a user and reloads the admin data', async () => {
		mockedAdminApi.listUsers
			.mockResolvedValueOnce({
				items: [
					{
						id: 'user-1',
						email: 'ximena_meza',
						role: 'host_client',
						createdAt: '2026-04-01T00:00:00.000Z',
						assignedEvents: [],
					},
				],
				total: 1,
				page: 1,
				perPage: 50,
			})
			.mockResolvedValueOnce({
				items: [
					{
						id: 'user-1',
						email: 'ximena_meza',
						role: 'host_client',
						createdAt: '2026-04-01T00:00:00.000Z',
						assignedEvents: [
							{
								eventId: 'evt-1',
								title: 'La Noche Premiere de Ximena',
								slug: 'ximena-meza-trasvina',
								membershipRole: 'manager',
							},
						],
					},
				],
				total: 1,
				page: 1,
				perPage: 50,
			});
		mockedAdminApi.listEvents.mockResolvedValue({
			items: [
				{
					id: 'evt-1',
					title: 'La Noche Premiere de Ximena',
					slug: 'ximena-meza-trasvina',
					eventType: 'xv',
					status: 'published',
					ownerUserId: 'admin-1',
					createdAt: '2026-04-01T00:00:00.000Z',
					updatedAt: '2026-04-01T00:00:00.000Z',
				},
			],
			total: 1,
			page: 1,
			perPage: 50,
		});
		mockedAdminApi.updateUserEventMembership.mockResolvedValue({
			userId: 'user-1',
			eventId: 'evt-1',
			action: 'assign',
			membershipRole: 'manager',
			changedAt: '2026-04-01T00:00:00.000Z',
		});

		const { result } = renderHook(() => useUsersAdmin());

		await waitFor(() => {
			expect(mockedAdminApi.listUsers).toHaveBeenCalledTimes(1);
		});

		await act(async () => {
			await result.current.updateUserEventMembership('user-1', {
				eventId: 'evt-1',
				action: 'assign',
				membershipRole: 'manager',
			});
		});

		expect(mockedAdminApi.updateUserEventMembership).toHaveBeenCalledWith('user-1', {
			eventId: 'evt-1',
			action: 'assign',
			membershipRole: 'manager',
		});
		expect(mockedAdminApi.listUsers).toHaveBeenCalledTimes(2);
		expect(result.current.items[0]?.assignedEvents).toHaveLength(1);
	});
});
