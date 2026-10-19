/** Client-side bridge for the host login shell. */
import {
	type LoginFormState,
	isValidLoginIdentifier,
	validateLoginForm,
} from '@/lib/client/auth/login-ui';
import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';

export function getLoginQueryPrefill(search: string): {
	email: string;
	hasPasswordParam: boolean;
} {
	const params = new URLSearchParams(search);
	const email = params.get('email')?.trim() || '';
	return {
		email,
		hasPasswordParam: params.has('password'),
	};
}

export function initLoginFlow() {
	const statusEl = document.getElementById('auth-status');
	const shellEl = document.querySelector('.auth-shell') as HTMLElement | null;
	const nextPath = shellEl?.dataset.next || '';
	const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
	const loginEmailInput = document.getElementById('login-email') as HTMLInputElement | null;
	const loginPasswordInput = document.getElementById('login-password') as HTMLInputElement | null;
	const loginSubmit = document.getElementById('login-submit');

	let isSubmitting = false;
	const loginQueryPrefill =
		typeof window === 'undefined' ? null : getLoginQueryPrefill(window.location.search);

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
		for (const input of document.querySelectorAll('input, select')) {
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
		if (!loginSubmit) return;
		(loginSubmit as HTMLButtonElement).disabled = value;
		loginSubmit.textContent = value ? 'Validando acceso...' : 'Continuar';
	};

	const hydrateLoginFromQuery = () => {
		if (!loginQueryPrefill) return;
		if (loginEmailInput && loginQueryPrefill.email) {
			loginEmailInput.value = loginQueryPrefill.email;
		}
		if (loginQueryPrefill.hasPasswordParam && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('password');
			window.history.replaceState({}, '', url.toString());
		}
	};

	const validateLoginClient = (payload: LoginFormState) => {
		const genericError = validateLoginForm(payload);
		if (!genericError) return null;
		if (!payload.email.trim() || !isValidLoginIdentifier(payload.email)) {
			setFieldError('login-email', genericError);
			return genericError;
		}
		if (!payload.password.trim()) {
			setFieldError('login-password', genericError);
			return genericError;
		}
		return genericError;
	};

	if (loginForm) {
		loginForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (isSubmitting) return;
			clearFieldErrors();

			const payload: LoginFormState = {
				email: loginEmailInput?.value || '',
				password: loginPasswordInput?.value || '',
			};
			const validationError = validateLoginClient(payload);
			if (validationError) {
				setStatus(validationError, 'error', true);
				return;
			}

			setSubmitting(true);
			setStatus('Verificando tus datos, espera un momento...', 'info');
			try {
				const data = await authBridgeApi.login({ method: 'password', ...payload });
				setStatus(
					data.message || 'Bienvenido, redirigiendo a tu panel...',
					'success',
					true,
				);
				window.location.href =
					data.next === '/dashboard/cambiar-contrasena'
						? data.next
						: nextPath || data.next || '/dashboard/invitados';
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'No pudimos iniciar sesion. Verifica tus datos e intenta de nuevo.';
				setStatus(errorMessage, 'error', true);
			} finally {
				setSubmitting(false);
			}
		});
	}

	// Initialize UI
	hydrateLoginFromQuery();
	if (loginQueryPrefill?.hasPasswordParam) {
		setStatus(
			'Por seguridad ignoramos la contrasena enviada en la URL. Escríbela en el campo para continuar.',
			'info',
		);
		if (loginPasswordInput) {
			loginPasswordInput.focus();
		}
	} else {
		setStatus('Escriba su correo o usuario y su contraseña para continuar.', 'info');
	}
	// Enable submission only after the handler and its initial UI are ready.
	setSubmitting(false);
}
