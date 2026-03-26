import { createClient } from '@supabase/supabase-js';

export interface MfaFactor {
	id: string;
	status: 'verified' | 'unverified';
	factor_type: 'totp' | string;
	created_at?: string;
}

export interface MfaElements {
	appEl: HTMLElement;
	qrContainer: HTMLElement;
	verifyButton: HTMLButtonElement;
	codeInput: HTMLInputElement;
	statusEl: HTMLElement;
	titleEl: HTMLElement | null;
	descriptionEl: HTMLElement | null;
	hintEl: HTMLElement | null;
}

export function getMfaElements(): MfaElements | null {
	const appEl = document.getElementById('mfa-app');
	const qrContainer = document.getElementById('qr-container');
	const verifyButton = document.getElementById('verify-mfa');
	const codeInput = document.getElementById('mfa-code');
	const statusEl = document.getElementById('mfa-status');
	const titleEl = document.getElementById('mfa-title');
	const descriptionEl = document.getElementById('mfa-description');
	const hintEl = document.getElementById('mfa-hint');

	if (
		!(appEl instanceof HTMLElement) ||
		!(qrContainer instanceof HTMLElement) ||
		!(verifyButton instanceof HTMLButtonElement) ||
		!(codeInput instanceof HTMLInputElement) ||
		!(statusEl instanceof HTMLElement)
	) {
		return null;
	}

	return {
		appEl,
		qrContainer,
		verifyButton,
		codeInput,
		statusEl,
		titleEl,
		descriptionEl,
		hintEl,
	};
}

export function getCookie(name: string) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	return parts.length === 2 ? (parts.pop()?.split(';').shift() ?? null) : null;
}

export function createMfaClient(url: string, key: string) {
	return createClient(url, key, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false,
		},
	});
}

export function pickLatestVerifiedTotpFactor(allFactors: MfaFactor[]) {
	const verifiedTotp = allFactors.filter(
		(item) => item.status === 'verified' && item.factor_type === 'totp',
	);

	if (!verifiedTotp.length) {
		return null;
	}

	verifiedTotp.sort((a, b) => {
		const aTime = Date.parse(a.created_at || '') || 0;
		const bTime = Date.parse(b.created_at || '') || 0;
		return bTime - aTime;
	});

	return verifiedTotp[0] || null;
}

export function getMfaErrorMessage(error: unknown): string {
	const payload = (error as { message?: string; error_description?: string }) || {};
	const raw = String(payload.message || payload.error_description || '').toLowerCase();

	if (
		raw.includes('sincronizar') ||
		raw.includes('sync-session') ||
		raw.includes('sesión segura')
	) {
		return 'No se pudo sincronizar tu sesión segura. Intenta iniciar sesión nuevamente.';
	}

	if (
		raw.includes('expired') ||
		raw.includes('session') ||
		raw.includes('jwt') ||
		raw.includes('refresh')
	) {
		return 'Tu sesión de seguridad expiró. Vuelve a iniciar sesión.';
	}

	if (
		raw.includes('invalid') ||
		raw.includes('code') ||
		raw.includes('otp') ||
		raw.includes('token')
	) {
		return 'El código ingresado no es válido. Verifica tu app e inténtalo otra vez.';
	}

	return 'No se pudo completar la configuración de seguridad. Intenta nuevamente.';
}

export function setMfaStatus(
	statusEl: HTMLElement,
	message: string,
	tone: 'info' | 'error' | 'success' = 'info',
) {
	statusEl.textContent = message;
	statusEl.dataset.tone = tone;
}

export function renderMfaPanel(
	elements: Pick<
		MfaElements,
		'qrContainer' | 'verifyButton' | 'titleEl' | 'descriptionEl' | 'hintEl'
	>,
	variant: 'verify' | 'enroll',
	qrCode?: string,
) {
	const { qrContainer, verifyButton, titleEl, descriptionEl, hintEl } = elements;

	qrContainer.innerHTML = '';

	if (variant === 'verify') {
		if (titleEl) {
			titleEl.textContent = 'Verifica tu acceso';
		}
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
		text.textContent = 'Verificación en dos pasos activa. Ingresa tu código para continuar.';
		qrContainer.appendChild(text);
		return;
	}

	if (titleEl) {
		titleEl.textContent = 'Configura tu verificación en dos pasos';
	}
	if (descriptionEl) {
		descriptionEl.textContent =
			'Como administrador, tu cuenta requiere autenticación de dos factores para proteger la plataforma.';
	}
	if (hintEl) {
		hintEl.textContent = 'Introduce el código de 6 dígitos de tu app de autenticación.';
	}

	verifyButton.textContent = 'Verificar y activar';
	qrContainer.classList.add('qr-placeholder--enroll');
	qrContainer.classList.remove('qr-placeholder--verify');

	if (qrCode) {
		const image = document.createElement('img');
		image.src = qrCode;
		image.alt = 'Escanea este código QR con tu app de autenticación';
		qrContainer.appendChild(image);
	}
}
