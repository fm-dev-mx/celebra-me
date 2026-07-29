/** Client-side bridge for the change password form. */
import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

export function initChangePasswordFlow() {
	const formEl = document.getElementById('change-password-form') as HTMLFormElement | null;
	const currentInput = document.getElementById('current-password') as HTMLInputElement | null;
	const newInput = document.getElementById('new-password') as HTMLInputElement | null;
	const confirmInput = document.getElementById('confirm-password') as HTMLInputElement | null;
	const submitBtn = document.getElementById('change-password-submit') as HTMLButtonElement | null;
	const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement | null;
	const statusEl = document.getElementById('auth-status');
	const shellEl = document.querySelector('.auth-shell') as HTMLElement | null;
	const nextPath = shellEl?.dataset.next || '';

	let isSubmitting = false;

	const setStatus = (message: string, tone = 'info', shouldFocus = false) => {
		if (!statusEl) return;
		statusEl.textContent = message || '';
		(statusEl as HTMLElement).dataset.tone = message ? tone : '';
		if (shouldFocus && message) {
			(statusEl as HTMLElement).focus();
		}
	};

	const clearFieldErrors = () => {
		for (const el of document.querySelectorAll('.field-error')) {
			el.textContent = '';
		}
		for (const input of document.querySelectorAll('input')) {
			input.removeAttribute('aria-invalid');
		}
	};

	const setFieldError = (inputId: string, message: string) => {
		const errorEl = document.getElementById(`${inputId}-error`);
		const inputEl = document.getElementById(inputId);
		if (!errorEl || !inputEl) return;
		errorEl.textContent = message;
		inputEl.setAttribute('aria-invalid', 'true');
	};

	const setSubmitting = (value: boolean) => {
		isSubmitting = value;
		if (submitBtn) {
			submitBtn.disabled = value;
			submitBtn.textContent = value ? 'Guardando contraseña...' : 'Guardar contraseña';
		}
	};

	if (logoutBtn) {
		logoutBtn.addEventListener('click', () => {
			void logoutAndRedirect('/login').catch(() => {
				window.location.href = '/login';
			});
		});
	}

	if (formEl) {
		formEl.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (isSubmitting) return;
			clearFieldErrors();

			const currentPassword = currentInput?.value || '';
			const newPassword = newInput?.value || '';
			const confirmPassword = confirmInput?.value || '';

			if (!currentPassword.trim()) {
				setFieldError('current-password', 'Ingresa tu contraseña actual.');
				setStatus('Ingresa tu contraseña actual.', 'error', true);
				return;
			}
			if (!newPassword.trim() || newPassword.length < 8) {
				setFieldError('new-password', 'La nueva contraseña debe tener al menos 8 caracteres.');
				setStatus('La nueva contraseña debe tener al menos 8 caracteres.', 'error', true);
				return;
			}
			if (newPassword !== confirmPassword) {
				setFieldError('confirm-password', 'Las contraseñas no coinciden.');
				setStatus('Las contraseñas no coinciden.', 'error', true);
				return;
			}

			setSubmitting(true);
			setStatus('Actualizando contraseña...', 'info');

			try {
				const data = await authBridgeApi.changePassword({
					currentPassword,
					newPassword,
					confirmPassword,
				});

				setStatus('¡Contraseña actualizada con éxito! Redirigiendo...', 'success', true);
				const redirectTo =
					nextPath || (typeof data.next === 'string' ? data.next : '') || '/dashboard/invitados';
				setTimeout(() => {
					window.location.href = redirectTo;
				}, 1000);
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'No pudimos actualizar tu contraseña. Revisa tus datos e intenta de nuevo.';
				setStatus(errorMessage, 'error', true);
			} finally {
				setSubmitting(false);
			}
		});
	}
}
