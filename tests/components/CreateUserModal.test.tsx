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
			target: { value: 'nombre_apellido' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

		expect(onSubmit).toHaveBeenCalledWith({
			email: 'nombre_apellido',
			role: 'host_client',
		});
	});

	it('shows generated access credentials when creation succeeds', () => {
		render(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={{
					email: 'nombre_apellido',
					role: 'host_client',
					temporaryPassword: 'nombreapellido2026',
				}}
				onClose={jest.fn()}
				onSubmit={jest.fn()}
			/>,
		);

		expect(screen.getByText('Credenciales generadas')).toBeInTheDocument();
		expect(screen.getByDisplayValue('nombre_apellido')).toBeInTheDocument();
		expect(screen.getByLabelText('Contraseña temporal')).toHaveValue('nombreapellido2026');
		expect(
			screen.getByText(/No se volverá a mostrar después de cerrar este modal/),
		).toBeInTheDocument();
	});

	it('traps focus, responds to Escape and restores trigger focus on close', () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'Nuevo usuario';
		document.body.appendChild(trigger);
		trigger.focus();
		expect(document.activeElement).toBe(trigger);

		const onClose = jest.fn();
		const { unmount } = render(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={null}
				onClose={onClose}
				onSubmit={jest.fn()}
			/>,
		);

		const dialog = screen.getByRole('dialog');
		expect(dialog).toBeInTheDocument();

		// Escape calls onClose
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);

		// Unmount restores focus to trigger
		unmount();
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it('blocks backdrop click and Escape while busy or while one-time credentials are shown', () => {
		const onClose = jest.fn();
		const { rerender } = render(
			<CreateUserModal
				busy={true}
				error=""
				createdUser={null}
				onClose={onClose}
				onSubmit={jest.fn()}
			/>,
		);

		const backdrop = document.querySelector('.dashboard-modal-backdrop') as HTMLElement;
		expect(backdrop).toBeInTheDocument();
		fireEvent.click(backdrop);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).not.toHaveBeenCalled();

		// While one-time credentials are shown: closing is blocked outside/Escape
		rerender(
			<CreateUserModal
				busy={false}
				error=""
				createdUser={{
					email: 'cliente_vip',
					role: 'host_client',
					temporaryPassword: 'temp-password-123',
				}}
				onClose={onClose}
				onSubmit={jest.fn()}
			/>,
		);
		fireEvent.click(backdrop);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).not.toHaveBeenCalled();

		// The explicit "Entendido" button is allowed to close
		fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
