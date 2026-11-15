jest.mock('@/lib/client/auth/auth-bridge-api', () => ({
	authBridgeApi: { changePassword: jest.fn() },
}));
jest.mock('@/lib/client/auth/logout-client', () => ({
	logoutAndRedirect: jest.fn().mockResolvedValue(undefined),
}));

import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';
import { initChangePasswordFlow } from '@/lib/client/auth/change-password-bridge';

const changePasswordMock = jest.mocked(authBridgeApi.changePassword);

const field = (id: string) => `
	<input id="${id}" type="password" />
	<button type="button" data-password-toggle aria-controls="${id}">Mostrar</button>
	<p id="${id}-error" class="field-error"></p>
`;

const render = (mustChange: boolean) => {
	document.body.innerHTML = `
		<section class="auth-shell">
			<form id="change-password-form" data-must-change="${mustChange}">
				${mustChange ? '' : field('current-password')}
				${field('new-password')}
				${field('confirm-password')}
				<button id="change-password-submit" type="submit">Guardar contraseña</button>
			</form>
			<p id="auth-status"></p>
		</section>
	`;
	initChangePasswordFlow();
};

const setValue = (id: string, value: string) => {
	(document.getElementById(id) as HTMLInputElement).value = value;
};

const submit = async () => {
	document
		.getElementById('change-password-form')!
		.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
	await Promise.resolve();
	await Promise.resolve();
};

const statusText = () => document.getElementById('auth-status')!.textContent;

describe('initChangePasswordFlow', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		changePasswordMock.mockReset();
	});
	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	describe('forced first change (must-change mode)', () => {
		it('submits without asking for the temporary password', async () => {
			changePasswordMock.mockResolvedValue({ next: '/dashboard/invitados' } as never);
			render(true);
			setValue('new-password', 'MiClaveNueva2026');
			setValue('confirm-password', 'MiClaveNueva2026');

			await submit();

			expect(document.getElementById('current-password')).toBeNull();
			expect(changePasswordMock).toHaveBeenCalledWith({
				newPassword: 'MiClaveNueva2026',
				confirmPassword: 'MiClaveNueva2026',
			});
			expect(statusText()).toContain('Contraseña actualizada con éxito');
		});

		it('rejects a new password shorter than 8 characters', async () => {
			render(true);
			setValue('new-password', 'corta');
			setValue('confirm-password', 'corta');

			await submit();

			expect(changePasswordMock).not.toHaveBeenCalled();
			expect(document.getElementById('new-password-error')!.textContent).toContain(
				'al menos 8 caracteres',
			);
		});

		it('rejects a confirmation that does not match', async () => {
			render(true);
			setValue('new-password', 'MiClaveNueva2026');
			setValue('confirm-password', 'OtraClave2026');

			await submit();

			expect(changePasswordMock).not.toHaveBeenCalled();
			expect(document.getElementById('confirm-password-error')!.textContent).toBe(
				'Las contraseñas no coinciden.',
			);
		});

		it('shows the server error when the change fails', async () => {
			changePasswordMock.mockRejectedValue(new Error('La contraseña temporal venció.'));
			render(true);
			setValue('new-password', 'MiClaveNueva2026');
			setValue('confirm-password', 'MiClaveNueva2026');

			await submit();
			await Promise.resolve();

			expect(statusText()).toBe('La contraseña temporal venció.');
			expect(
				(document.getElementById('change-password-submit') as HTMLButtonElement).disabled,
			).toBe(false);
		});
	});

	describe('regular change', () => {
		it('requires the current password', async () => {
			render(false);
			setValue('new-password', 'MiClaveNueva2026');
			setValue('confirm-password', 'MiClaveNueva2026');

			await submit();

			expect(changePasswordMock).not.toHaveBeenCalled();
			expect(document.getElementById('current-password-error')!.textContent).toBe(
				'Ingresa tu contraseña actual.',
			);
		});

		it('sends the current password with the new one', async () => {
			changePasswordMock.mockResolvedValue({ next: '/dashboard/invitados' } as never);
			render(false);
			setValue('current-password', 'ClaveActual2026');
			setValue('new-password', 'MiClaveNueva2026');
			setValue('confirm-password', 'MiClaveNueva2026');

			await submit();

			expect(changePasswordMock).toHaveBeenCalledWith({
				currentPassword: 'ClaveActual2026',
				newPassword: 'MiClaveNueva2026',
				confirmPassword: 'MiClaveNueva2026',
			});
		});
	});

	it('wires the show-password buttons on every field', () => {
		render(false);
		for (const button of document.querySelectorAll<HTMLButtonElement>(
			'[data-password-toggle]',
		)) {
			button.click();
			const input = document.getElementById(
				button.getAttribute('aria-controls')!,
			) as HTMLInputElement;
			expect(input.type).toBe('text');
		}
	});
});
