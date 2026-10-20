import {
	assertProductionContactPhone,
	PLACEHOLDER_CONTACT_PHONE,
} from '../../src/utils/contact-phone';

describe('assertProductionContactPhone', () => {
	it('fails a Production build without a real contact number', () => {
		for (const phone of [
			undefined,
			'',
			PLACEHOLDER_CONTACT_PHONE,
			'+52 1 000 000 000',
			'0000000000',
		]) {
			expect(() => assertProductionContactPhone('production', phone)).toThrow(
				/CONTACT_WHATSAPP/u,
			);
		}
	});

	it('accepts a real number in Production', () => {
		expect(() => assertProductionContactPhone('production', '5216681234567')).not.toThrow();
	});

	it('leaves Preview and local builds free to use the placeholder', () => {
		expect(() => assertProductionContactPhone('preview', undefined)).not.toThrow();
		expect(() => assertProductionContactPhone(null, PLACEHOLDER_CONTACT_PHONE)).not.toThrow();
	});
});
