import { normalizeCommercialPhone, getUsableWhatsAppE164 } from '@/lib/commercial/phone';

describe('normalizeCommercialPhone', () => {
	it('normalizes Mexican local and international phone values to E.164', () => {
		expect(normalizeCommercialPhone('614 123 4567')).toEqual({
			countryCode: '+52',
			national: '6141234567',
			e164: '+526141234567',
		});
		expect(normalizeCommercialPhone('+52 614 123 4567')).toEqual({
			countryCode: '+52',
			national: '6141234567',
			e164: '+526141234567',
		});
	});

	it('normalizes US numbers when a country code is explicit', () => {
		expect(normalizeCommercialPhone('(555) 123-4567', '+1')).toEqual({
			countryCode: '+1',
			national: '5551234567',
			e164: '+15551234567',
		});
	});

	it('returns undefined for blank, short, or ambiguous phone values', () => {
		expect(normalizeCommercialPhone('')).toBeUndefined();
		expect(normalizeCommercialPhone('12345')).toBeUndefined();
		expect(normalizeCommercialPhone('+33 1 22 33 44 55')).toBeUndefined();
	});
});

describe('getUsableWhatsAppE164', () => {
	it('returns digits for a valid full E.164 phone (phoneE164 present)', () => {
		const result = getUsableWhatsAppE164('+526141234567');
		expect(result).toBe('526141234567');
	});

	it('returns digits when a valid phoneE164 is provided alongside a null rawPhone', () => {
		const result = getUsableWhatsAppE164('+526141234567', null);
		expect(result).toBe('526141234567');
	});

	it('returns undefined for a local / incomplete phone without a country code', () => {
		const result = getUsableWhatsAppE164(null, '6141234567');
		expect(result).toBeUndefined();
	});

	it('returns undefined for a masked phoneE164 (non-digit characters reduce digit count below 10)', () => {
		const result = getUsableWhatsAppE164('+525****0103');
		expect(result).toBeUndefined();
	});

	it('returns undefined for a masked rawPhone without explicit country code', () => {
		const result = getUsableWhatsAppE164(null, '55 **** 0103');
		expect(result).toBeUndefined();
	});

	it('returns undefined when phoneE164 is an empty string', () => {
		const result = getUsableWhatsAppE164('');
		expect(result).toBeUndefined();
	});

	it('returns undefined when both phoneE164 and rawPhone are null', () => {
		const result = getUsableWhatsAppE164(null, null);
		expect(result).toBeUndefined();
	});

	it('returns undefined when both phoneE164 and rawPhone are undefined', () => {
		const result = getUsableWhatsAppE164(undefined, undefined);
		expect(result).toBeUndefined();
	});

	it('falls through to rawPhone when phoneE164 is undefined but rawPhone has an explicit country code', () => {
		const result = getUsableWhatsAppE164(undefined, '+525512345678');
		expect(result).toBe('525512345678');
	});

	it('returns undefined for a rawPhone with explicit country code but too few national digits', () => {
		const result = getUsableWhatsAppE164(undefined, '+5255');
		expect(result).toBeUndefined();
	});
});
