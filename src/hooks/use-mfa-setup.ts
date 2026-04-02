import { useEffect } from 'react';
import {
	createMfaClient,
	getCookie,
	getMfaElements,
	getMfaErrorMessage,
	pickLatestVerifiedTotpFactor,
	pickUnverifiedTotpFactors,
	renderMfaPanel,
	setMfaStatus,
	syncMfaSession,
} from '@/lib/client/mfa-setup';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

export function useMfaSetup() {
	useEffect(() => {
		const elements = getMfaElements();

		if (!elements) {
			return;
		}

		const {
			appEl,
			qrContainer,
			verifyButton,
			logoutButton,
			codeInput,
			statusEl,
			titleEl,
			descriptionEl,
			hintEl,
		} = elements;
		const url = appEl.dataset.url;
		const key = appEl.dataset.key;

		if (!url || !key) {
			return;
		}

		const supabase = createMfaClient(url, key);
		const sessionToken = getCookie('sb-mfa-session');
		const refreshToken = getCookie('sb-mfa-refresh');
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

		const init = async () => {
			try {
				if (!sessionToken || !refreshToken) {
					setMfaStatus(
						statusEl,
						'Tu sesión de seguridad expiró. Vuelve a iniciar sesión.',
						'error',
					);
					return;
				}

				const { error: sessionError } = await supabase.auth.setSession({
					access_token: sessionToken,
					refresh_token: refreshToken,
				});
				if (sessionError) {
					throw sessionError;
				}

				const factorsResponse = await supabase.auth.mfa.listFactors();
				if (factorsResponse.error) {
					throw factorsResponse.error;
				}

				const allFactors = factorsResponse.data?.all ?? [];
				const verifiedFactor = pickLatestVerifiedTotpFactor(allFactors);

				if (verifiedFactor?.id) {
					factorId = verifiedFactor.id;
					renderMfaPanel(
						{ qrContainer, verifyButton, titleEl, descriptionEl, hintEl },
						'verify',
					);
					idleVerifyLabel = verifyButton.textContent || idleVerifyLabel;

					const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
					if (challengeResponse.error) {
						throw challengeResponse.error;
					}

					challengeId = challengeResponse.data.id;
					setMfaStatus(
						statusEl,
						'Tu cuenta ya tiene MFA activo. Aquí no se genera un QR nuevo: introduce el código actual de tu app para continuar.',
						'info',
					);
					return;
				}

				const unverifiedFactors = pickUnverifiedTotpFactors(allFactors);
				for (const factor of unverifiedFactors) {
					const cleanupResponse = await supabase.auth.mfa.unenroll({
						factorId: factor.id,
					});
					if (cleanupResponse.error) {
						throw cleanupResponse.error;
					}
				}

				const enrollResponse = await supabase.auth.mfa.enroll({ factorType: 'totp' });
				if (enrollResponse.error) {
					throw enrollResponse.error;
				}

				factorId = enrollResponse.data.id;
				renderMfaPanel(
					{ qrContainer, verifyButton, titleEl, descriptionEl, hintEl },
					'enroll',
					enrollResponse.data.totp.qr_code,
					enrollResponse.data.totp.secret,
				);
				idleVerifyLabel = verifyButton.textContent || idleVerifyLabel;
				setMfaStatus(
					statusEl,
					'Escanea el código QR y luego introduce el código de tu app.',
					'info',
				);
			} catch (error) {
				setMfaStatus(statusEl, getMfaErrorMessage(error), 'error');
			}
		};

		const onVerify = async () => {
			const code = codeInput.value.trim();

			if (!code || code.length !== 6) {
				setMfaStatus(statusEl, 'Escribe un código válido de 6 dígitos.', 'error');
				return;
			}

			if (!factorId) {
				setMfaStatus(
					statusEl,
					'No se pudo preparar la verificación MFA. Recarga la página.',
					'error',
				);
				return;
			}

			setBusyState(true, 'Validando acceso...');
			setMfaStatus(statusEl, 'Validando código...', 'info');

			try {
				if (!challengeId && factorId) {
					const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
					if (challengeResponse.error) {
						throw challengeResponse.error;
					}
					challengeId = challengeResponse.data.id;
				}

				const verifyResponse = await supabase.auth.mfa.verify({
					factorId,
					challengeId,
					code,
				});
				if (verifyResponse.error) {
					throw verifyResponse.error;
				}

				await syncMfaSession(
					verifyResponse.data.access_token,
					verifyResponse.data.refresh_token,
				);

				setMfaStatus(statusEl, 'Verificación exitosa. Redirigiendo al panel...', 'success');
				window.location.assign('/dashboard/admin');
			} catch (error) {
				setMfaStatus(statusEl, getMfaErrorMessage(error), 'error');
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
