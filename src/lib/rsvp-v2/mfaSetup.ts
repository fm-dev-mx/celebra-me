export type MfaErrorType = 'sync_failed' | 'session_expired' | 'invalid_code' | 'generic';

export interface MfaFactorLike {
	id?: string;
	status?: string;
	factor_type?: string;
	created_at?: string;
}

export function pickLatestVerifiedTotpFactor(allFactors: MfaFactorLike[]): MfaFactorLike | null {
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

export function classifyMfaError(error: unknown): MfaErrorType {
	const payload = (error || {}) as { message?: string; error_description?: string };
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
