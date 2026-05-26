import { resolvePhonePayload } from '@/lib/phone/resolve-phone-payload';

describe('resolvePhonePayload', () => {
	describe('dropdown country code priority', () => {
		it('uses dropdown +1 when phone is plain national digits and countryCode is +1', () => {
			const result = resolvePhonePayload({
				phone: '9150011122',
				countryCode: '+1',
				mode: 'edit',
				initialPhone: '9150011122',
			});
			expect(result).toEqual({ ok: true, phone: '9150011122', countryCode: '+1' });
		});

		it('does NOT default to +52 when dropdown says +1', () => {
			const result = resolvePhonePayload({
				phone: '9150011122',
				countryCode: '+1',
				mode: 'edit',
				initialPhone: '9150011122',
			});
			expect(result).not.toEqual({ ok: true, phone: '9150011122', countryCode: '+52' });
		});

		it('uses dropdown +52 when phone is plain national digits and countryCode is +52', () => {
			const result = resolvePhonePayload({
				phone: '6691234567',
				countryCode: '+52',
				mode: 'edit',
				initialPhone: '6691234567',
			});
			expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
		});
	});

	describe('explicit + prefix overrides dropdown', () => {
		it('uses parsed +1 country code when input starts with +1', () => {
			const result = resolvePhonePayload({
				phone: '+1 915 001 1122',
				countryCode: '+52',
				mode: 'edit',
				initialPhone: '9150011122',
			});
			expect(result).toEqual({ ok: true, phone: '9150011122', countryCode: '+1' });
		});

		it('uses parsed +52 country code when input starts with +52', () => {
			const result = resolvePhonePayload({
				phone: '+52 669 123 4567',
				countryCode: '+1',
				mode: 'edit',
				initialPhone: '6691234567',
			});
			expect(result).toEqual({ ok: true, phone: '6691234567', countryCode: '+52' });
		});
	});

	describe('empty phone handling', () => {
		it('returns null for edit mode when initialPhone exists', () => {
			const result = resolvePhonePayload({
				phone: '',
				countryCode: '+52',
				mode: 'edit',
				initialPhone: '6691234567',
			});
			expect(result).toEqual({ ok: true, phone: null });
		});

		it('returns undefined for create mode when phone is empty', () => {
			const result = resolvePhonePayload({
				phone: '',
				countryCode: '+52',
				mode: 'create',
			});
			expect(result).toEqual({ ok: true, phone: undefined });
		});
	});

	describe('error handling', () => {
		it('returns error for unsupported international prefix', () => {
			const result = resolvePhonePayload({
				phone: '+44 7711 234567',
				countryCode: '+52',
				mode: 'create',
			});
			expect(result).toEqual({
				ok: false,
				error: expect.stringContaining('no está soportado'),
			});
		});

		it('returns error for non-numeric characters', () => {
			const result = resolvePhonePayload({
				phone: '669abc4567',
				countryCode: '+52',
				mode: 'create',
			});
			expect(result).toEqual({ ok: false, error: expect.stringContaining('números') });
		});

		it('returns error for insufficient digits', () => {
			const result = resolvePhonePayload({
				phone: '669123',
				countryCode: '+52',
				mode: 'create',
			});
			expect(result).toEqual({ ok: false, error: expect.any(String) });
		});

		it('returns error for international phone with wrong national length', () => {
			const result = resolvePhonePayload({
				phone: '+52669123456',
				countryCode: '+52',
				mode: 'create',
			});
			expect(result).toEqual({ ok: false, error: expect.stringContaining('10 dígitos') });
		});
	});
});
