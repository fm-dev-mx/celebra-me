// src/core/utilities/contactFormValidationRules.ts

import FormValidationHelper from './formValidationHelper';
import type { ValidationRules } from '@/core/types/validation/validationRules.type';

/**
 * Shared validation rules for form fields.
 */
export const contactFormValidationRules: ValidationRules = {
	name: [
		FormValidationHelper.isRequired('Ingresa tu nombre.'),
		FormValidationHelper.lengthInRange(2, 50, 'El nombre debe tener entre 2 y 50 caracteres.'),
	],
	email: [
		FormValidationHelper.isRequired('Ingresa tu correo electrónico.'),
		FormValidationHelper.isValidEmail('Ingresa un correo electrónico válido.'),
	],
	mobile: [FormValidationHelper.isOptionalPhone('Ingresa un número telefónico válido.')],
	message: [
		FormValidationHelper.isRequired('Ingresa la información de tu evento.'),
		FormValidationHelper.lengthInRange(
			10,
			500,
			'El mensaje debe tener entre 10 y 500 caracteres.',
		),
	],
};
