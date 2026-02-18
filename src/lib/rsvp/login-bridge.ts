/** src/lib/rsvp/login-bridge.ts */
import {
	getMethodHelpText,
	isValidEmail,
	validateLoginForm,
	validateRegisterForm,
} from './loginUi';

export function initLoginFlow() {
	const statusEl = document.getElementById('auth-status');
	const shellEl = document.querySelector('.auth-shell') as HTMLElement | null;
	const nextPath = shellEl?.dataset.next || '';
	const tabLogin = document.getElementById('tab-login');
	const tabRegister = document.getElementById('tab-register');
	const panelLogin = document.getElementById('panel-login');
	const panelRegister = document.getElementById('panel-register');
	const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
	const registerForm = document.getElementById('register-form') as HTMLFormElement | null;
	const loginMethod = document.getElementById('login-method') as HTMLSelectElement | null;
	const registerMethod = document.getElementById('register-method') as HTMLSelectElement | null;
	const loginMethodHelp = document.getElementById('login-method-help');
	const registerMethodHelp = document.getElementById('register-method-help');
	const loginPasswordWrap = document.getElementById('login-password-wrap');
	const registerPasswordWrap = document.getElementById('register-password-wrap');
	const loginSubmit = document.getElementById('login-submit');
	const registerSubmit = document.getElementById('register-submit');

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

	const updateMethodUI = (panel: 'login' | 'register') => {
		const methodSelect = (
			panel === 'login' ? loginMethod : registerMethod
		) as HTMLSelectElement | null;
		const methodHelp = panel === 'login' ? loginMethodHelp : registerMethodHelp;
		const passwordWrap = panel === 'login' ? loginPasswordWrap : registerPasswordWrap;

		if (!methodSelect || !methodHelp || !passwordWrap) return;

		const method = methodSelect.value as 'password' | 'magic_link';
		passwordWrap.style.display = method === 'password' ? 'grid' : 'none';
		methodHelp.textContent = getMethodHelpText(method);
	};

	const setSubmitting = (value: boolean, panel: 'login' | 'register') => {
		isSubmitting = value;
		if (loginSubmit) (loginSubmit as HTMLButtonElement).disabled = value;
		if (registerSubmit) (registerSubmit as HTMLButtonElement).disabled = value;

		if (panel === 'login' && loginSubmit) {
			loginSubmit.textContent = value ? 'Validando acceso...' : 'Continuar';
		}
		if (panel === 'register' && registerSubmit) {
			registerSubmit.textContent = value
				? 'Creando tu cuenta...'
				: 'Crear cuenta y reclamar evento';
		}
	};

	const focusFirstInput = (panel: 'login' | 'register') => {
		if (panel === 'login') {
			const emailEl = document.getElementById('login-email');
			if (emailEl) emailEl.focus();
		} else {
			const emailEl = document.getElementById('register-email');
			if (emailEl) emailEl.focus();
		}
	};

	const switchTab = (panel: 'login' | 'register') => {
		const isLogin = panel === 'login';
		if (tabLogin) tabLogin.classList.toggle('is-active', isLogin);
		if (tabRegister) tabRegister.classList.toggle('is-active', !isLogin);
		if (tabLogin) tabLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
		if (tabRegister) tabRegister.setAttribute('aria-selected', isLogin ? 'false' : 'true');
		if (panelLogin) panelLogin.classList.toggle('auth-panel--hidden', !isLogin);
		if (panelRegister) panelRegister.classList.toggle('auth-panel--hidden', isLogin);
		if (panelLogin) (panelLogin as HTMLElement).hidden = !isLogin;
		if (panelRegister) (panelRegister as HTMLElement).hidden = isLogin;
		clearFieldErrors();
		setStatus('');
		focusFirstInput(panel);
	};

	const parseJsonSafe = async (response: Response) => {
		try {
			return await response.json();
		} catch {
			return {};
		}
	};

	const validateLoginClient = (payload: import('./loginUi').LoginFormState) => {
		const genericError = validateLoginForm(payload);
		if (!genericError) return null;
		if (!payload.email.trim() || !isValidEmail(payload.email)) {
			setFieldError('login-email', 'Escribe un correo valido para continuar.');
			return 'Escribe un correo valido para continuar.';
		}
		if (payload.method === 'password' && !payload.password.trim()) {
			setFieldError(
				'login-password',
				'Ingresa tu contrasena para continuar con este metodo.',
			);
			return 'Ingresa tu contrasena para continuar con este metodo.';
		}
		return genericError;
	};

	const validateRegisterClient = (payload: import('./loginUi').RegisterFormState) => {
		const error = validateRegisterForm(payload);
		if (!error) return null;

		if (error.includes('correo')) {
			setFieldError('register-email', error);
		} else if (error.includes('contrasena')) {
			setFieldError('register-password', error);
		} else if (error.includes('claimCode')) {
			setFieldError('register-claim-code', error);
		}

		return error;
	};

	if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
	if (tabRegister) tabRegister.addEventListener('click', () => switchTab('register'));
	if (loginMethod) loginMethod.addEventListener('change', () => updateMethodUI('login'));
	if (registerMethod) registerMethod.addEventListener('change', () => updateMethodUI('register'));

	if (loginForm) {
		loginForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (isSubmitting) return;
			clearFieldErrors();

			const emailEl = document.getElementById('login-email') as HTMLInputElement | null;
			const passwordEl = document.getElementById('login-password') as HTMLInputElement | null;

			const payload = {
				method: (loginMethod?.value as import('./loginUi').AuthMethod) || 'password',
				email: emailEl?.value || '',
				password: passwordEl?.value || '',
			};
			const validationError = validateLoginClient(payload);
			if (validationError) {
				setStatus(validationError, 'error', true);
				return;
			}

			setSubmitting(true, 'login');
			setStatus('Verificando tus datos, espera un momento...', 'info');
			try {
				const response = await fetch('/api/auth/login-host', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await parseJsonSafe(response);
				if (!response.ok) {
					throw new Error(data.message || 'No se pudo iniciar sesion.');
				}
				const message =
					payload.method === 'magic_link'
						? `${data.message || 'Listo, te enviamos el enlace.'} Revisa tambien spam o promociones.`
						: data.message || 'Bienvenido, redirigiendo a tu panel...';
				setStatus(message, 'success', true);
				if (payload.method === 'password') {
					window.location.href = nextPath || data.next || '/dashboard/invitados';
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'No pudimos iniciar sesion. Verifica tus datos e intenta de nuevo.';
				setStatus(errorMessage, 'error', true);
			} finally {
				setSubmitting(false, 'login');
			}
		});
	}

	if (registerForm) {
		registerForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (isSubmitting) return;
			clearFieldErrors();

			const emailEl = document.getElementById('register-email') as HTMLInputElement | null;
			const passwordEl = document.getElementById(
				'register-password',
			) as HTMLInputElement | null;
			const claimCodeEl = document.getElementById(
				'register-claim-code',
			) as HTMLInputElement | null;

			const payload = {
				method: (registerMethod?.value as import('./loginUi').AuthMethod) || 'password',
				email: emailEl?.value || '',
				password: passwordEl?.value || '',
				claimCode: claimCodeEl?.value || '',
			};
			const validationError = validateRegisterClient(payload);
			if (validationError) {
				setStatus(validationError, 'error', true);
				return;
			}

			setSubmitting(true, 'register');
			setStatus('Estamos creando tu cuenta y preparando tu acceso...', 'info');
			try {
				const response = await fetch('/api/auth/register-host', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await parseJsonSafe(response);
				if (!response.ok) {
					throw new Error(data.message || 'No se pudo registrar.');
				}
				const message =
					payload.method === 'magic_link'
						? `${data.message || 'Cuenta creada.'} Te enviamos un enlace; revisa tambien spam o promociones.`
						: data.message || 'Cuenta creada con exito. Te llevamos a tu panel...';
				setStatus(message, 'success', true);
				if (payload.method === 'password') {
					window.location.href = nextPath || data.next || '/dashboard/invitados';
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'No pudimos completar el registro. Revisa los datos e intenta de nuevo.';
				setStatus(errorMessage, 'error', true);
			} finally {
				setSubmitting(false, 'register');
			}
		});
	}

	// Initialize UI
	updateMethodUI('login');
	updateMethodUI('register');
	switchTab('login');
	setStatus('Elige como quieres entrar y continua cuando estes listo.', 'info');
}
