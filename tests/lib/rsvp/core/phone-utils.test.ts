import {
	normalizeImportedPhone,
	splitPhoneForExport,
	SUPPORTED_COUNTRY_CODES,
} from '@/lib/rsvp/core/utils';

describe('normalizeImportedPhone', () => {
	describe('international phone (starts with +)', () => {
		it('preserves +52 MX international number', () => {
			expect(normalizeImportedPhone('+526691234567')).toBe('+526691234567');
		});

		it('preserves +1 US international number', () => {
			expect(normalizeImportedPhone('+15551234567')).toBe('+15551234567');
		});

		it('preserves +34 ES international number', () => {
			expect(normalizeImportedPhone('+34612345678')).toBe('+34612345678');
		});

		it('cleans formatting from international number', () => {
			expect(normalizeImportedPhone('+52 669 123 4567')).toBe('+526691234567');
		});

		it('works without countryCode when phone starts with +', () => {
			expect(normalizeImportedPhone('+34612345678')).toBe('+34612345678');
		});

		it('accepts matching countryCode', () => {
			expect(normalizeImportedPhone('+526691234567', '+52')).toBe('+526691234567');
		});

		it('rejects conflicting countryCode', () => {
			expect(() => normalizeImportedPhone('+526691234567', '+1')).toThrow(
				'no coincide con el código de país',
			);
		});
	});

	describe('local phone (no + prefix)', () => {
		it('combines with countryCode +52', () => {
			expect(normalizeImportedPhone('6691234567', '+52')).toBe('+526691234567');
		});

		it('combines with countryCode +1 and strips formatting', () => {
			expect(normalizeImportedPhone('555-123-4567', '+1')).toBe('+15551234567');
		});

		it('combines with countryCode +34', () => {
			expect(normalizeImportedPhone('612345678', '+34')).toBe('+34612345678');
		});

		it('accepts countryCode without + prefix', () => {
			expect(normalizeImportedPhone('6691234567', '52')).toBe('+526691234567');
		});

		it('strips spaces and dashes from phone', () => {
			expect(normalizeImportedPhone('(668) 123-4567', '+52')).toBe('+526681234567');
		});

		it('throws when countryCode is missing', () => {
			expect(() => normalizeImportedPhone('6691234567')).toThrow('no tiene código de país');
		});

		it('throws when countryCode is empty string', () => {
			expect(() => normalizeImportedPhone('6691234567', '')).toThrow(
				'no tiene código de país',
			);
		});
	});

	describe('edge cases', () => {
		it('returns empty string for empty input', () => {
			expect(normalizeImportedPhone('')).toBe('');
		});

		it('returns empty string for whitespace input', () => {
			expect(normalizeImportedPhone('   ')).toBe('');
		});

		it('returns empty string for nullish input', () => {
			expect(normalizeImportedPhone('', '+52')).toBe('');
		});

		it('preserves PENDING_ placeholder', () => {
			expect(normalizeImportedPhone('PENDING_abc123')).toBe('PENDING_abc123');
		});

		it('preserves PENDING_ even if countryCode provided', () => {
			expect(normalizeImportedPhone('PENDING_abc123', '+52')).toBe('PENDING_abc123');
		});

		// Acceptance criteria: front-end normalizes phone+countryCode before submission
		it('local 10-digit MX phone +52 => +526563769461', () => {
			expect(normalizeImportedPhone('6563769461', '+52')).toBe('+526563769461');
		});

		it('local 10-digit MX phone +52 (no + prefix on cc) => +526563769461', () => {
			expect(normalizeImportedPhone('6563769461', '52')).toBe('+526563769461');
		});

		it('international phone + empty country is valid (already E.164)', () => {
			expect(normalizeImportedPhone('+526563769461', '')).toBe('+526563769461');
		});

		it('international phone + undefined country is valid', () => {
			expect(normalizeImportedPhone('+526563769461')).toBe('+526563769461');
		});

		it('local phone + empty country is invalid (throws)', () => {
			expect(() => normalizeImportedPhone('6563769461', '')).toThrow(
				'no tiene código de país',
			);
		});

		it('empty phone + empty country returns empty string', () => {
			expect(normalizeImportedPhone('', '')).toBe('');
		});

		it('empty phone + any country returns empty string', () => {
			expect(normalizeImportedPhone('', '+52')).toBe('');
		});

		it('local phone + matching countryCode works', () => {
			expect(normalizeImportedPhone('6681167477', '+52')).toBe('+526681167477');
		});
	});
});

describe('splitPhoneForExport', () => {
	it('splits +52 MX phone into countryCode + local phone', () => {
		const result = splitPhoneForExport('+526691234567');
		expect(result).toEqual({ countryCode: '+52', localPhone: '6691234567' });
	});

	it('splits +1 US phone', () => {
		const result = splitPhoneForExport('+15551234567');
		expect(result).toEqual({ countryCode: '+1', localPhone: '5551234567' });
	});

	it('splits +34 ES phone', () => {
		const result = splitPhoneForExport('+34612345678');
		expect(result).toEqual({ countryCode: '+34', localPhone: '612345678' });
	});

	it('prefers longer match (+34 over +3)', () => {
		// +34 is in the list before +1; longer prefixes match first
		const result = splitPhoneForExport('+34612345678');
		expect(result?.countryCode).toBe('+34');
	});

	it('returns undefined for legacy plain-digit phone', () => {
		expect(splitPhoneForExport('6681234567')).toBeUndefined();
	});

	it('returns undefined for PENDING_ placeholder', () => {
		expect(splitPhoneForExport('PENDING_abc123')).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(splitPhoneForExport('')).toBeUndefined();
	});

	it('returns undefined for nullish', () => {
		expect(splitPhoneForExport('')).toBeUndefined();
	});
});

describe('SUPPORTED_COUNTRY_CODES order', () => {
	it('lists longer prefixes before shorter ones', () => {
		// +52 and +34 have length 3, +1 has length 2
		// The order ensures longer prefixes are checked first
		const lengths = SUPPORTED_COUNTRY_CODES.map((cc) => cc.length);
		for (let i = 1; i < lengths.length; i++) {
			expect(lengths[i - 1]).toBeGreaterThanOrEqual(lengths[i]);
		}
	});
});
