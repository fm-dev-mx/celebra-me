import { validateInput } from '@utilities/validateInput';
import { contactFormValidationRules } from '@/core/utilities/contactFormValidationRules';

describe('validateInput - contactFormValidationRules', () => {
	it('returns no errors for valid input', () => {
		const data = {
			name: 'Juan Pérez',
			email: 'juan@example.com',
			mobile: '+5215512345678',
			message: 'Este es un mensaje válido con más de diez caracteres.',
		};

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({});
	});

	it('validates that name is required', () => {
		const data = {
			email: 'juan@example.com',
			message: 'Mensaje válido para la prueba.',
		} as any;

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({ name: 'Ingresa tu nombre.' });
	});

	it('validates name length', () => {
		const data = {
			name: 'A',
			email: 'juan@example.com',
			message: 'Mensaje válido para la prueba.',
		};

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({ name: 'El nombre debe tener entre 2 y 50 caracteres.' });
	});

	it('validates email format', () => {
		const data = {
			name: 'Juan',
			email: 'no-es-un-email',
			message: 'Mensaje válido para la prueba.',
		};

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({ email: 'Ingresa un correo electrónico válido.' });
	});

	it('validates optional mobile phone', () => {
		const data = {
			name: 'Juan',
			email: 'juan@example.com',
			mobile: '123',
			message: 'Mensaje válido para la prueba.',
		};

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({ mobile: 'Ingresa un número telefónico válido.' });
	});

	it('validates message length', () => {
		const data = {
			name: 'Juan',
			email: 'juan@example.com',
			message: 'corto',
		};

		const result = validateInput(data, contactFormValidationRules);
		expect(result).toEqual({ message: 'El mensaje debe tener entre 10 y 500 caracteres.' });
	});
});
