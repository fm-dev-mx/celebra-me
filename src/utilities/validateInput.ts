// src/utilities/validateInput.ts
import validator from 'validator';
import type { ContactFormData } from '@/components/ui/ContactForm';

/**
 * Validates input data for the contact form.
 * Provides specific error messages if any fields are invalid.
 * @param data - Object containing name, email, mobile, and message.
 * @returns {Partial<ContactFormData>} - An object containing validation errors for each field or an empty object if valid.
 */
export function validateInput(data: ContactFormData): Partial<ContactFormData> {
	const { name, email, mobile, message } = data;
	const errors: Partial<ContactFormData> = {};

	// Validate the name field
	if (validator.isEmpty(name)) {
		errors.name = 'El campo de nombre no puede estar vacío.';
	} else if (!validator.isLength(name.trim(), { min: 2, max: 50 })) {
		errors.name = 'El nombre debe tener entre 2 y 50 caracteres.';
	}

	// Validate the email field
	if (!validator.isEmail(email)) {
		errors.email = 'Ingresa un correo electrónico válido.';
	}

	// Validate the mobile field (more general validation)
	if (!validator.isMobilePhone(mobile, undefined, { strictMode: false })) {
		errors.mobile = 'Ingresa un número de teléfono válido.';
	}

	// Validate the message field
	if (validator.isEmpty(message)) {
		errors.message = 'El mensaje no puede estar vacío.';
	} else if (!validator.isLength(message.trim(), { min: 10, max: 500 })) {
		errors.message = 'El mensaje debe tener entre 10 y 500 caracteres.';
	}

	return errors;
}
