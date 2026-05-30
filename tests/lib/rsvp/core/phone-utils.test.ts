import {
	normalizeImportedPhone,
	normalizeOptionalNationalPhone,
	normalizeOptionalPhonePair,
	splitPhoneForExport,
	SUPPORTED_COUNTRY_CODES,
} from '@/lib/rsvp/core/utils';

describe('normalizeOptionalNationalPhone', () => {
	describe('empty / null / undefined', () => {
		it('returns null for null', () => {
			expect(normalizeOptionalNationalPhone(null)).toEqual({ ok: true, phone: null });
		});

		it('returns null for undefined', () => {
			expect(normalizeOptionalNationalPhone(undefined)).toEqual({ ok: true, phone: null });
		});

		it('returns null for empty string', () => {
			expect(normalizeOptionalNationalPhone('')).toEqual({ ok: true, phone: null });
		});

		it('returns null for whitespace string', () => {
			expect(normalizeOptionalNationalPhone('   ')).toEqual({ ok: true, phone: null });
		});
	});

	describe('valid formatted phones', () => {
		it('normalizes plain 10-digit phone', () => {
			const result = normalizeOptionalNationalPhone('6561234567');
			expect(result).toEqual({ ok: true, phone: '6561234567' });
		});

		it('normalizes phone with dashes', () => {
			const result = normalizeOptionalNationalPhone('656-123-4567');
			expect(result).toEqual({ ok: true, phone: '6561234567' });
		});

		it('normalizes phone with parentheses and spaces', () => {
			const result = normalizeOptionalNationalPhone('(656) 123 4567');
			expect(result).toEqual({ ok: true, phone: '6561234567' });
		});

		it('normalizes phone with spaces', () => {
			const result = normalizeOptionalNationalPhone('656 123 4567');
			expect(result).toEqual({ ok: true, phone: '6561234567' });
		});

		it('normalizes phone with dots', () => {
			const result = normalizeOptionalNationalPhone('656.123.4567');
			expect(result).toEqual({ ok: true, phone: '6561234567' });
		});
	});

	describe('invalid: country code in phone', () => {
		it('rejects +526561234567', () => {
			const result = normalizeOptionalNationalPhone('+526561234567');
			expect(result).toEqual({ ok: false, reason: 'country_code_in_phone' });
		});

		it('rejects 526561234567 (MX country code digits)', () => {
			const result = normalizeOptionalNationalPhone('526561234567');
			expect(result).toEqual({ ok: false, reason: 'country_code_in_phone' });
		});

		it('rejects 16561234567 (US country code digit)', () => {
			const result = normalizeOptionalNationalPhone('16561234567');
			expect(result).toEqual({ ok: false, reason: 'country_code_in_phone' });
		});

		it('rejects 346561234567 (ES country code digits)', () => {
			const result = normalizeOptionalNationalPhone('346561234567');
			expect(result).toEqual({ ok: false, reason: 'country_code_in_phone' });
		});

		it('rejects +52 656 123 4567 (formatted with +)', () => {
			const result = normalizeOptionalNationalPhone('+52 656 123 4567');
			expect(result).toEqual({ ok: false, reason: 'country_code_in_phone' });
		});
	});

	describe('invalid: wrong length', () => {
		it('rejects 9 digits', () => {
			const result = normalizeOptionalNationalPhone('656123456');
			expect(result).toEqual({ ok: false, reason: 'invalid_length' });
		});

		it('rejects 11 digits without country code pattern', () => {
			const result = normalizeOptionalNationalPhone('65612345678');
			expect(result).toEqual({ ok: false, reason: 'invalid_length' });
		});

		it('rejects 8 digits', () => {
			const result = normalizeOptionalNationalPhone('65612345');
			expect(result).toEqual({ ok: false, reason: 'invalid_length' });
		});

		it('rejects 5 digits', () => {
			const result = normalizeOptionalNationalPhone('12345');
			expect(result).toEqual({ ok: false, reason: 'invalid_length' });
		});
	});

	describe('invalid: characters', () => {
		it('rejects letters inside phone', () => {
			const result = normalizeOptionalNationalPhone('656abc4567');
			expect(result).toEqual({ ok: false, reason: 'invalid_characters' });
		});

		it('rejects malformed punctuation', () => {
			const result = normalizeOptionalNationalPhone('656@123#4567');
			expect(result).toEqual({ ok: false, reason: 'invalid_characters' });
		});

		it('rejects plus sign anywhere', () => {
			const result = normalizeOptionalNationalPhone('656+1234567');
			expect(result).toEqual({ ok: false, reason: 'invalid_characters' });
		});
	});
});

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
			expect(normalizeImportedPhone('0000000000', '+52')).toBe('+520000000000');
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
});

describe('normalizeOptionalPhonePair', () => {
	it('strips countryCode when phone is empty string', () => {
		const result = normalizeOptionalPhonePair({ phone: '', countryCode: '+52' });
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
	});

	it('strips countryCode when phone is undefined', () => {
		const result = normalizeOptionalPhonePair({ phone: undefined, countryCode: '+52' });
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
	});

	it('strips countryCode when phone is null', () => {
		const result = normalizeOptionalPhonePair({ phone: null, countryCode: '+52' });
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
	});

	it('strips countryCode when both are empty', () => {
		const result = normalizeOptionalPhonePair({ phone: '', countryCode: '' });
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
	});

	it('preserves both when phone and countryCode are present', () => {
		const result = normalizeOptionalPhonePair({ phone: '6561234567', countryCode: '+52' });
		expect(result).toEqual({ phone: '6561234567', countryCode: '+52' });
	});

	it('strips countryCode when countryCode is empty but phone is present', () => {
		const result = normalizeOptionalPhonePair({ phone: '6561234567', countryCode: '' });
		expect(result).toEqual({ phone: '6561234567', countryCode: undefined });
	});

	it('returns both undefined when phone is whitespace', () => {
		const result = normalizeOptionalPhonePair({ phone: '   ', countryCode: '+52' });
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
	});

	it('returns both undefined when both are undefined', () => {
		const result = normalizeOptionalPhonePair({});
		expect(result).toEqual({ phone: undefined, countryCode: undefined });
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
