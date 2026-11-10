import {
	buildTemporaryPasswordExpiry,
	isTemporaryPasswordExpired,
	TEMP_PASSWORD_EXPIRES_KEY,
	TEMP_PASSWORD_TTL_MS,
} from '@/lib/rsvp/auth/temporary-password';

describe('temporary password expiry', () => {
	const NOW = Date.parse('2026-11-05T12:00:00.000Z');

	it('expires 24 hours after issuing', () => {
		expect(TEMP_PASSWORD_TTL_MS).toBe(24 * 60 * 60 * 1000);
		expect(buildTemporaryPasswordExpiry(NOW)).toBe('2026-11-06T12:00:00.000Z');
	});

	it('flags only forced-change accounts whose expiry has passed', () => {
		const expired = {
			must_change_password: true,
			[TEMP_PASSWORD_EXPIRES_KEY]: '2026-11-05T11:59:59.000Z',
		};
		const active = {
			must_change_password: true,
			[TEMP_PASSWORD_EXPIRES_KEY]: '2026-11-05T12:00:01.000Z',
		};

		expect(isTemporaryPasswordExpired(expired, NOW)).toBe(true);
		expect(isTemporaryPasswordExpired(active, NOW)).toBe(false);
		expect(isTemporaryPasswordExpired({ ...expired, must_change_password: false }, NOW)).toBe(
			false,
		);
		expect(isTemporaryPasswordExpired({ must_change_password: true }, NOW)).toBe(false);
		expect(isTemporaryPasswordExpired(undefined, NOW)).toBe(false);
	});
});
