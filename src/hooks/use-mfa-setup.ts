import { useEffect } from 'react';
import {
	getMfaElements,
	getMfaErrorMessage,
	renderMfaPanel,
	setMfaStatus,
	startMfaChallenge,
	verifyMfaCode,
} from '@/lib/client/mfa-setup';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

const errorText = (error: unknown) =>
	error instanceof Error && error.message ? error.message : getMfaErrorMessage(error);

export function useMfaSetup() {
	useEffect(() => {
		const elements = getMfaElements();

		if (!elements) {
			return;
		}

		const {
			qrContainer,
			verifyButton,
			logoutButton,
			codeInput,
			statusEl,
			titleEl,
			descriptionEl,
			hintEl,
		} = elements;

		let idleVerifyLabel = verifyButton.textContent || 'Verificar y activar';
		let factorId = '';
		let challengeId = '';

		const setBusyState = (busy: boolean, label?: string) => {
			verifyButton.disabled = busy;
			verifyButton.textContent = label || idleVerifyLabel;
			if (logoutButton) {
				logoutButton.disabled = busy;
			}
		};

		// The server holds the session in httpOnly cookies and talks to Supabase on our behalf.
		const init = async () => {
			try {
				const challenge = await startMfaChallenge();
				factorId = challenge.factorId;
				challengeId = challenge.challengeId;

				if (challenge.mode === 'verify') {
					renderMfaPanel(
						{ qrContainer, verifyButton, titleEl, descriptionEl, hintEl },
						'verify',
					);
					idleVerifyLabel = verifyButton.textContent || idleVerifyLabel;
					setMfaStatus(
						statusEl,
						'Su cuenta ya tiene verificación activa. Aquí no se genera un QR nuevo: introduzca el código actual de su app para continuar.',
						'info',
					);
					return;
				}

				renderMfaPanel(
					{ qrContainer, verifyButton, titleEl, descriptionEl, hintEl },
					'enroll',
					challenge.qrCode,
					challenge.secret,
				);
				idleVerifyLabel = verifyButton.textContent || idleVerifyLabel;
				setMfaStatus(
					statusEl,
					'Escanee el código QR y luego introduzca el código de su app.',
					'info',
				);
			} catch (error) {
				setMfaStatus(statusEl, errorText(error), 'error');
			}
		};

		const onVerify = async () => {
			const code = codeInput.value.trim();

			if (!/^\d{6}$/.test(code)) {
				setMfaStatus(statusEl, 'Escriba un código válido de 6 dígitos.', 'error');
				return;
			}

			if (!factorId) {
				setMfaStatus(
					statusEl,
					'No se pudo preparar la verificación. Recargue la página.',
					'error',
				);
				return;
			}

			setBusyState(true, 'Validando acceso...');
			setMfaStatus(statusEl, 'Validando código...', 'info');

			try {
				await verifyMfaCode({ factorId, challengeId, code });
				setMfaStatus(statusEl, 'Verificación exitosa. Redirigiendo al panel...', 'success');
				window.location.assign('/dashboard/admin');
			} catch (error) {
				setMfaStatus(statusEl, errorText(error), 'error');
				// A failed attempt consumes the challenge; the server issues a new one.
				challengeId = '';
			} finally {
				setBusyState(false);
			}
		};

		const onLogout = async () => {
			setBusyState(true, 'Cerrando sesión...');
			setMfaStatus(statusEl, 'Cerrando sesión segura...', 'info');
			await logoutAndRedirect('/login');
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void onVerify();
			}
		};

		void init();
		verifyButton.addEventListener('click', onVerify);
		logoutButton?.addEventListener('click', onLogout);
		codeInput.addEventListener('keydown', handleKeyDown);

		return () => {
			verifyButton.removeEventListener('click', onVerify);
			logoutButton?.removeEventListener('click', onLogout);
			codeInput.removeEventListener('keydown', handleKeyDown);
		};
	}, []);
}
