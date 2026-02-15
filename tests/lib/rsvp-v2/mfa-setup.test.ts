import { classifyMfaError, pickLatestVerifiedTotpFactor } from '@/lib/rsvp-v2/mfaSetup';

describe('rsvp-v2 mfaSetup helpers', () => {
	it('selects the latest verified totp factor deterministically', () => {
		const selected = pickLatestVerifiedTotpFactor([
			{
				id: 'old',
				status: 'verified',
				factor_type: 'totp',
				created_at: '2025-01-01T00:00:00.000Z',
			},
			{
				id: 'latest',
				status: 'verified',
				factor_type: 'totp',
				created_at: '2026-01-01T00:00:00.000Z',
			},
			{
				id: 'phone',
				status: 'verified',
				factor_type: 'phone',
				created_at: '2027-01-01T00:00:00.000Z',
			},
		]);

		expect(selected?.id).toBe('latest');
	});

	it('returns null when there is no verified totp factor', () => {
		const selected = pickLatestVerifiedTotpFactor([
			{ id: 'x1', status: 'unverified', factor_type: 'totp' },
			{ id: 'x2', status: 'verified', factor_type: 'phone' },
		]);

		expect(selected).toBeNull();
	});

	it('classifies sync-session related failures', () => {
		expect(classifyMfaError(new Error('No se pudo sincronizar la sesión segura.'))).toBe(
			'sync_failed',
		);
		expect(classifyMfaError({ message: 'sync-session failed' })).toBe('sync_failed');
	});

	it('classifies session-expired failures', () => {
		expect(classifyMfaError({ message: 'JWT expired' })).toBe('session_expired');
		expect(classifyMfaError({ message: 'refresh token invalid' })).toBe('session_expired');
	});

	it('classifies invalid code failures', () => {
		expect(classifyMfaError({ message: 'Invalid OTP code' })).toBe('invalid_code');
		expect(classifyMfaError({ error_description: 'invalid token' })).toBe('invalid_code');
	});

	it('falls back to generic classification when message is unknown', () => {
		expect(classifyMfaError({ message: 'unexpected backend response' })).toBe('generic');
	});
});
