// src/core/utilities/validationRules.ts

import ValidationHelper from './validationHelper';
import type { ValidationRules } from '../interfaces/validationRules.interface';

/**
 * Shared validation rules for form fields.
 */
export const validationRules: ValidationRules = {
	name: [
		ValidationHelper.isRequired('Ingresa tu nombre.'),
		ValidationHelper.lengthInRange(2, 50, 'El nombre debe tener entre 2 y 50 caracteres.'),
	],
	email: [
		ValidationHelper.isRequired('Ingresa tu correo electrónico.'),
		ValidationHelper.isValidEmail('Ingresa un correo electrónico válido.'),
	],
	mobile: [
		ValidationHelper.isOptionalPhone('Ingresa un número telefónico válido.'),
	],
	message: [
		ValidationHelper.isRequired('Ingresa la información de tu evento.'),
		ValidationHelper.lengthInRange(10, 500, 'El mensaje debe tener entre 10 y 500 caracteres.'),
	],
};
