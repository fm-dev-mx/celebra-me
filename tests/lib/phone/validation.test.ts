import {
	validateNationalPhone,
	parsePhoneInput,
	hasValidPhone,
	buildWhatsAppNumber,
} from '@/lib/phone/validation';

describe('validateNationalPhone', () => {
	it('accepts 10-digit phone', () => {
		expect(validateNationalPhone('6691234567')).toEqual({ ok: true, phone: '6691234567' });
	});

	it('strips formatting', () => {
		expect(validateNationalPhone('(669) 123-4567')).toEqual({ ok: true, phone: '6691234567' });
	});

	it('rejects empty', () => {
		expect(validateNationalPhone('')).toEqual({ ok: false, reason: 'empty' });
	});

	it('rejects 9 digits', () => {
		const result = validateNationalPhone('669123456');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('10 dígitos');
		}
	});

	it('rejects letters', () => {
		const result = validateNationalPhone('669abc4567');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('solo puede contener números');
		}
	});
});

describe('parsePhoneInput', () => {
	it('returns default country code for empty input', () => {
		const result = parsePhoneInput('');
		expect(result).toEqual({ ok: true, phone: '', countryCode: '+52' });
	});

	it('parses local 10-digit phone', () => {
		const result = parsePhoneInput('6691234567');
		expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
	});

	it('parses formatted national phone', () => {
		const result = parsePhoneInput('(669) 123-4567');
		expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
	});

	it('parses international +52 phone', () => {
		const result = parsePhoneInput('+526691234567');
		expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
	});

	it('parses international +1 phone', () => {
		const result = parsePhoneInput('+15551234567');
		expect(result).toEqual({ ok: true, phone: '5551234567', countryCode: '+1' });
	});

	it('parses international +34 phone', () => {
		const result = parsePhoneInput('+346123456789');
		expect(result).toEqual({ ok: true, phone: '6123456789', countryCode: '+34' });
	});

	it('parses formatted international phone', () => {
		const result = parsePhoneInput('+52 669 123 4567');
		expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
	});

	it('rejects unsupported country code', () => {
		const result = parsePhoneInput('+447123456789');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('no está soportado');
		}
	});

	it('rejects international phone with wrong national length', () => {
		const result = parsePhoneInput('+52669123456');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('10 dígitos');
		}
	});

	it('rejects phone with invalid characters', () => {
		const result = parsePhoneInput('669abc4567');
		expect(result.ok).toBe(false);
	});
});

describe('hasValidPhone', () => {
	it('returns false for empty', () => {
		expect(hasValidPhone('')).toBe(false);
	});

	it('returns false for 8 digits', () => {
		expect(hasValidPhone('66912345')).toBe(false);
	});

	it('returns true for 10 digits', () => {
		expect(hasValidPhone('6691234567')).toBe(true);
	});

	it('strips formatting before counting', () => {
		expect(hasValidPhone('(669) 123-4567')).toBe(true);
	});

	it('counts digits ignoring non-digit chars', () => {
		expect(hasValidPhone('+526691234567')).toBe(true);
	});
});

describe('buildWhatsAppNumber', () => {
	it('composes national phone with +52 country code', () => {
		expect(buildWhatsAppNumber('8112345678', '+52')).toBe('528112345678');
	});

	it('handles phone that already includes +52 prefix', () => {
		expect(buildWhatsAppNumber('+528112345678', '+52')).toBe('528112345678');
	});

	it('handles phone that already includes 52 prefix without +', () => {
		expect(buildWhatsAppNumber('528112345678', '+52')).toBe('528112345678');
	});

	it('returns phone digits when country code is empty', () => {
		expect(buildWhatsAppNumber('8112345678', '')).toBe('8112345678');
	});

	it('returns phone digits when country code is undefined', () => {
		expect(buildWhatsAppNumber('8112345678')).toBe('8112345678');
	});

	it('returns empty string when phone is empty', () => {
		expect(buildWhatsAppNumber('', '+52')).toBe('');
	});

	it('returns empty string when phone is null', () => {
		expect(buildWhatsAppNumber(null, '+52')).toBe('');
	});

	it('strips formatting characters from phone', () => {
		expect(buildWhatsAppNumber('(811) 234-5678', '+52')).toBe('528112345678');
	});

	it('strips formatting characters from country code', () => {
		expect(buildWhatsAppNumber('8112345678', '+52 (MX)')).toBe('528112345678');
	});

	it('output contains only digits', () => {
		const result = buildWhatsAppNumber('8112345678', '+52');
		expect(result).toMatch(/^\d+$/);
	});
});
