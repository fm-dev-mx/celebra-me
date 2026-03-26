import { useEffect } from 'react';
import {
	createMfaClient,
	getCookie,
	getMfaElements,
	getMfaErrorMessage,
	pickLatestVerifiedTotpFactor,
	renderMfaPanel,
	setMfaStatus,
} from '@/lib/client/mfa-setup';

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
		let factorId = '';
		let challengeId = '';

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
				const allFactors = factorsResponse.data?.all ?? [];
				const verifiedFactor = pickLatestVerifiedTotpFactor(allFactors);

				if (verifiedFactor?.id) {
					factorId = verifiedFactor.id;
					renderMfaPanel(
						{ qrContainer, verifyButton, titleEl, descriptionEl, hintEl },
						'verify',
					);

					const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
					if (challengeResponse.error) {
						throw challengeResponse.error;
					}

					challengeId = challengeResponse.data.id;
					setMfaStatus(
						statusEl,
						'Introduce tu código de verificación para continuar.',
						'info',
					);
					return;
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
				);
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

			verifyButton.disabled = true;
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

				setMfaStatus(statusEl, 'Verificación exitosa. Redirigiendo al panel...', 'success');
				window.location.href = '/dashboard/admin';
			} catch (error) {
				setMfaStatus(statusEl, getMfaErrorMessage(error), 'error');
			} finally {
				verifyButton.disabled = false;
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void onVerify();
			}
		};

		void init();
		verifyButton.addEventListener('click', onVerify);
		codeInput.addEventListener('keydown', handleKeyDown);

		return () => {
			verifyButton.removeEventListener('click', onVerify);
			codeInput.removeEventListener('keydown', handleKeyDown);
		};
	}, []);
}
