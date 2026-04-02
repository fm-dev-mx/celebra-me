import { act, renderHook, waitFor } from '@testing-library/react';
import { useUsersAdmin } from '@/hooks/use-users-admin';
import { adminApi } from '@/lib/dashboard/admin-api';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		listUsers: jest.fn(),
		createUser: jest.fn(),
		updateUserRole: jest.fn(),
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
});
