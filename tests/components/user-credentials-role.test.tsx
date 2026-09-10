import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserCredentialsModal from '@/components/dashboard/users/UserCredentialsModal';
import UsersAdminTable from '@/components/dashboard/users/UsersAdminTable';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { UserListItemDTO } from '@/lib/dashboard/dto/users';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		listUsers: jest.fn(),
		listEvents: jest.fn(),
		updateUserRole: jest.fn(),
	},
}));

it('assigns host directly from missing role and refreshes the displayed state', async () => {
	const user: UserListItemDTO = {
		id: 'synthetic-user',
		email: 'host@example.test',
		role: null,
		createdAt: '',
		assignedEvents: [],
	};
	jest.mocked(adminApi.listUsers)
		.mockResolvedValueOnce({ items: [user], total: 1, page: 1, perPage: 50 })
		.mockResolvedValue({
			items: [{ ...user, role: 'host_client' }],
			total: 1,
			page: 1,
			perPage: 50,
		});
	jest.mocked(adminApi.listEvents).mockResolvedValue({ items: [] });
	jest.mocked(adminApi.updateUserRole).mockResolvedValue({
		userId: user.id,
		role: 'host_client',
		previousRole: null,
		changedAt: '',
	});
	render(<UsersAdminTable />);
	const role = await screen.findByRole('combobox', { name: `Rol de ${user.email}` });
	expect(role).toHaveValue('');
	fireEvent.change(role, { target: { value: 'host_client' } });
	await waitFor(() => expect(role).toHaveValue('host_client'));
	expect(adminApi.updateUserRole).toHaveBeenCalledWith(user.id, { role: 'host_client' });
	expect(adminApi.updateUserRole).toHaveBeenCalledTimes(1);
});

it('blocks reset until an explicit role is supplied and displays failures', () => {
	const user: UserListItemDTO = {
		id: 'synthetic-user',
		email: 'host@example.test',
		role: null,
		createdAt: '',
		assignedEvents: [],
	};
	const onResetPassword = jest.fn();
	const props = {
		user,
		busy: false,
		error: '',
		onClose: jest.fn(),
		onSaveLoginAlias: jest.fn(),
		onResetPassword,
	};
	const { rerender } = render(<UserCredentialsModal {...props} />);
	const reset = screen.getByRole('button', { name: /Restablecer contraseña de/ });
	expect(reset).toBeDisabled();
	expect(screen.getByRole('status')).toHaveTextContent('Sin rol asignado');
	fireEvent.click(reset);
	expect(onResetPassword).not.toHaveBeenCalled();
	rerender(
		<UserCredentialsModal
			{...props}
			user={{ ...user, role: 'host_client' }}
			error="No se pudo verificar el acceso."
		/>,
	);
	expect(reset).toBeEnabled();
	expect(screen.getByText('No se pudo verificar el acceso.')).toBeVisible();
	fireEvent.click(reset);
	expect(onResetPassword).not.toHaveBeenCalled();
	fireEvent.click(reset);
	expect(onResetPassword).toHaveBeenCalledTimes(1);
});
