// src/utilities/validationRules.ts

import validator from 'validator';

/**
 * Shared validation rules for form fields.
 */
export const validationRules = {
	name: [
		{
			validator: (value: string) => !validator.isEmpty(value),
			message: "El campo de nombre no puede estar vacío.",
		},
		{
			validator: (value: string) => validator.isLength(value.trim(), { min: 2, max: 50 }),
			message: "El nombre debe tener entre 2 y 50 caracteres.",
		},
	],
	email: [
		{
			validator: (value: string) => validator.isEmail(value),
			message: "Ingresa un correo electrónico válido.",
		},
	],
	mobile: [
		{
			validator: (value: string) =>
				validator.isMobilePhone(value, ["es-MX", "en-US"], { strictMode: true }) ||
				/^\d{10}$/.test(value),
			message: "Ingresa un número de telefónico válido.",
		},
	],
	message: [
		{
			validator: (value: string) => !validator.isEmpty(value),
			message: "El mensaje no puede estar vacío.",
		},
		{
			validator: (value: string) => validator.isLength(value.trim(), { min: 10, max: 500 }),
			message: "El mensaje debe tener entre 10 y 500 caracteres.",
		},
	],
};
