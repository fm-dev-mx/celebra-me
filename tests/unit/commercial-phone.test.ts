import { normalizeCommercialPhone } from '@/lib/commercial/phone';

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
