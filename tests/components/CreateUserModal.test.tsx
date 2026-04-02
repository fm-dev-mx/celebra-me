import { fireEvent, render, screen } from '@testing-library/react';
import CreateUserModal from '@/components/dashboard/users/CreateUserModal';

describe('CreateUserModal', () => {
	it('submits optional email and selected role', async () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);
		const onClose = jest.fn();

		render(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={null}
				onClose={onClose}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.change(screen.getByLabelText('Correo electrónico o usuario (opcional)'), {
			target: { value: 'client@test.com' },
		});
		fireEvent.change(screen.getByLabelText('Rol'), {
			target: { value: 'super_admin' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

		expect(onSubmit).toHaveBeenCalledWith({
			email: 'client@test.com',
			role: 'super_admin',
		});
	});

	it('accepts a simple alias without browser email validation', () => {
		const onSubmit = jest.fn().mockResolvedValue(undefined);

		render(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={null}
				onClose={jest.fn()}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.change(screen.getByLabelText('Correo electrónico o usuario (opcional)'), {
			target: { value: 'ximena_meza' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

		expect(onSubmit).toHaveBeenCalledWith({
			email: 'ximena_meza',
			role: 'host_client',
		});
	});

	it('shows generated access credentials when creation succeeds', () => {
		render(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={{
					email: 'ximena_meza',
					role: 'host_client',
					temporaryPassword: 'ximenameza2026',
				}}
				onClose={jest.fn()}
				onSubmit={jest.fn()}
			/>,
		);

		expect(screen.getByText('Credenciales generadas')).toBeInTheDocument();
		expect(screen.getByDisplayValue('ximena_meza')).toBeInTheDocument();
		expect(screen.getByLabelText('Contraseña temporal')).toHaveValue('ximenameza2026');
		expect(
			screen.getByText(
				/Esta contraseña no se volverá a mostrar después de cerrar este modal\./,
			),
		).toBeInTheDocument();
	});
});
