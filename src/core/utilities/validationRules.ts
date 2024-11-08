// src/core/utilities/validationRules.ts

import validator from 'validator';
import type { ValidationRules } from '../interfaces/validationRules.interface';

/**
 * Shared validation rules for form fields.
 *
 * **Adding New Validation Rules:**
 * - Define a new field in this object with an array of `ValidationRule`.
 * - Each `ValidationRule` consists of a validator function and an error message.
 */
export const validationRules: ValidationRules = {
	name: [
		{
			validator: (value: string | undefined) => !validator.isEmpty(value || ''),
			message: 'El campo de nombre no puede estar vacío.',
		},
		{
			validator: (value: string | undefined) => validator.isLength(value?.trim() || '', { min: 2, max: 50 }),
			message: 'El nombre debe tener entre 2 y 50 caracteres.',
		},
	],
	email: [
		{
			validator: (value: string | undefined) => validator.isEmail(value || ''),
			message: 'Ingresa un correo electrónico válido.',
		},
	],
	mobile: [
		{
			validator: (value: string | undefined) =>
				!value || // Permite que el campo sea opcional
				validator.isMobilePhone(value, ['es-MX', 'en-US'], { strictMode: true }) ||
				/^\d{10}$/.test(value || ''),
			message: 'Ingresa un número de telefónico válido.',
		},
	],
	message: [
		{
			validator: (value: string | undefined) => !validator.isEmpty(value || ''),
			message: 'El mensaje no puede estar vacío.',
		},
		{
			validator: (value: string | undefined) => validator.isLength(value?.trim() || '', { min: 10, max: 500 }),
			message: 'El mensaje debe tener entre 10 y 500 caracteres.',
		},
	],
};
