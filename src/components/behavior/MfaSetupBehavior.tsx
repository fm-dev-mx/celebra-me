import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface MfaFactor {
	id: string;
	status: 'verified' | 'unverified';
	factor_type: 'totp' | string;
	created_at?: string;
}

// --- Helper Functions ---
function pickLatestVerifiedTotpFactor(allFactors: MfaFactor[]) {
	const verifiedTotp = allFactors.filter(
		(item) => item.status === 'verified' && item.factor_type === 'totp',
	);
	if (!verifiedTotp.length) return null;
	verifiedTotp.sort((a, b) => {
		const aTime = Date.parse(a.created_at || '') || 0;
		const bTime = Date.parse(b.created_at || '') || 0;
		return bTime - aTime;
	});
	return verifiedTotp[0] || null;
}

function classifyMfaError(error: unknown): string {
	const payload = (error as { message?: string; error_description?: string }) || {};
	const raw = String(payload.message || payload.error_description || '').toLowerCase();
	if (
		raw.includes('sincronizar') ||
		raw.includes('sync-session') ||
		raw.includes('sesión segura')
	) {
		return 'sync_failed';
	}
	if (
		raw.includes('expired') ||
		raw.includes('session') ||
		raw.includes('jwt') ||
		raw.includes('refresh')
	) {
		return 'session_expired';
	}
	if (
		raw.includes('invalid') ||
		raw.includes('code') ||
		raw.includes('otp') ||
		raw.includes('token')
	) {
		return 'invalid_code';
	}
	return 'generic';
}

/**
 * Behavior-only component for the MFA Setup page.
 * Extracted from original Astro script.
 */
export default function MfaSetupBehavior() {
	useEffect(() => {
		const appEl = document.getElementById('mfa-app');
		const qrContainer = document.getElementById('qr-container');
		const verifyButton = document.getElementById('verify-mfa') as HTMLButtonElement | null;
		const codeInput = document.getElementById('mfa-code') as HTMLInputElement | null;
		const statusEl = document.getElementById('mfa-status');
		const titleEl = document.getElementById('mfa-title');
		const descriptionEl = document.getElementById('mfa-description');
		const hintEl = document.getElementById('mfa-hint');

		const url = appEl?.dataset.url;
		const key = appEl?.dataset.key;

		if (!appEl || !qrContainer || !verifyButton || !codeInput || !statusEl || !url || !key) {
			return;
		}

		const getCookie = (name: string) => {
			const value = `; ${document.cookie}`;
			const parts = value.split(`; ${name}=`);
			return parts.length === 2 ? (parts.pop()?.split(';').shift() ?? null) : null;
		};

		const setStatus = (message: string, tone: 'info' | 'error' | 'success' = 'info') => {
			statusEl.textContent = message;
			statusEl.dataset.tone = tone;
		};

		const setQrContainerState = (variant: 'verify' | 'enroll', qrCode?: string) => {
			qrContainer.innerHTML = '';
			if (variant === 'verify') {
				if (titleEl) titleEl.textContent = 'Verifica tu acceso';
				if (descriptionEl) {
					descriptionEl.textContent =
						'Tu cuenta está protegida con verificación en dos pasos. Ingresa el código de tu app para continuar.';
				}
				if (hintEl) {
					hintEl.textContent =
						'Abre tu app Authenticator y escribe el código actual de 6 dígitos.';
				}
				verifyButton.textContent = 'Continuar';
				qrContainer.classList.add('qr-placeholder--verify');
				qrContainer.classList.remove('qr-placeholder--enroll');
				const text = document.createElement('p');
				text.textContent =
					'Verificación en dos pasos activa. Ingresa tu código para continuar.';
				qrContainer.appendChild(text);
				return;
			}

			if (titleEl) titleEl.textContent = 'Configura tu verificación en dos pasos';
			if (descriptionEl) {
				descriptionEl.textContent =
					'Como Superadmin, tu cuenta requiere autenticación de dos factores para proteger la plataforma.';
			}
			if (hintEl) {
				hintEl.textContent = 'Introduce el código de 6 dígitos de tu app de autenticación.';
			}
			verifyButton.textContent = 'Verificar y Activar';
			qrContainer.classList.add('qr-placeholder--enroll');
			qrContainer.classList.remove('qr-placeholder--verify');
			if (qrCode) {
				const image = document.createElement('img');
				image.src = qrCode;
				image.alt = 'Escanea este código QR con tu app de autenticación';
				qrContainer.appendChild(image);
			}
		};

		const supabase = createClient(url, key, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
				detectSessionInUrl: false,
			},
		});

		const sessionToken = getCookie('sb-mfa-session');
		const refreshToken = getCookie('sb-mfa-refresh');
		let factorId = '';
		let challengeId = '';

		const init = async () => {
			try {
				if (!sessionToken || !refreshToken) {
					setStatus('Tu sesión de seguridad expiró. Vuelve a iniciar sesión.', 'error');
					return;
				}
				const { error: sessionError } = await supabase.auth.setSession({
					access_token: sessionToken,
					refresh_token: refreshToken,
				});
				if (sessionError) throw sessionError;

				const factorsResponse = await supabase.auth.mfa.listFactors();
				const allFactors = factorsResponse.data?.all ?? [];
				const verifiedFactor = pickLatestVerifiedTotpFactor(allFactors);

				if (verifiedFactor?.id) {
					factorId = verifiedFactor.id;
					setQrContainerState('verify');
					const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
					if (challengeResponse.error) throw challengeResponse.error;
					challengeId = challengeResponse.data.id;
					setStatus('Introduce tu código de verificación para continuar.', 'info');
					return;
				}

				const enrollResponse = await supabase.auth.mfa.enroll({ factorType: 'totp' });
				if (enrollResponse.error) throw enrollResponse.error;
				factorId = enrollResponse.data.id;
				setQrContainerState('enroll', enrollResponse.data.totp.qr_code);
				setStatus('Escanea el código QR y luego introduce el código de tu app.', 'info');
			} catch (error) {
				setStatus(classifyMfaError(error), 'error');
			}
		};

		const onVerify = async () => {
			const code = codeInput.value.trim();
			if (!code || code.length !== 6) {
				setStatus('Escribe un código válido de 6 dígitos.', 'error');
				return;
			}
			verifyButton.disabled = true;
			setStatus('Validando código...', 'info');

			try {
				if (!challengeId && factorId) {
					const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
					if (challengeResponse.error) throw challengeResponse.error;
					challengeId = challengeResponse.data.id;
				}
				const verifyResponse = await supabase.auth.mfa.verify({
					factorId,
					challengeId,
					code,
				});
				if (verifyResponse.error) throw verifyResponse.error;

				setStatus('Verificación exitosa. Redirigiendo al panel...', 'success');
				window.location.href = '/dashboard/admin';
			} catch (error) {
				setStatus(classifyMfaError(error), 'error');
			} finally {
				verifyButton.disabled = false;
			}
		};

		void init();
		verifyButton.addEventListener('click', onVerify);
		codeInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void onVerify();
			}
		});

		return () => {
			verifyButton.removeEventListener('click', onVerify);
		};
	}, []);

	return null;
}
