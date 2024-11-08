// tests/models/emailModel.test.ts

import { EmailModel } from '@/backend/models/emailModel';
import { EmailData } from '@/core/interfaces/emailData.interface';

describe('EmailModel', () => {
	let emailData: EmailData;

	beforeEach(() => {
		// Base valid data for email tests
		emailData = {
			name: 'John Doe',
			email: 'john.doe@example.com',
			mobile: '1234567890',
			message: 'Hello, this is a valid test message.',
		};
	});

	it('should validate valid email data successfully', () => {
		const emailModel = new EmailModel(emailData);
		const validationErrors = emailModel.validate();

		// Expect no validation errors for valid data
		expect(Object.keys(validationErrors)).toHaveLength(0);
	});

	it('should return all expected errors for invalid email data', () => {
		const invalidData: EmailData = {
			name: '',
			email: 'invalid-email',
			mobile: 'invalid-phone',
			message: 'Hi',
		};

		const emailModel = new EmailModel(invalidData);
		const validationErrors = emailModel.validate();

		// Expected validation errors
		const expectedErrors = {
			name: 'El campo de nombre no puede estar vacío.',
			email: 'Ingresa un correo electrónico válido.',
			mobile: 'Ingresa un número de telefónico válido.',
			message: 'El mensaje debe tener entre 10 y 500 caracteres.',
		};

		// Check that all expected errors are returned
		expect(validationErrors).toEqual(expectedErrors);
	});

	it('should handle optional mobile field', () => {
		const dataWithoutMobile: EmailData = {
			...emailData,
			mobile: undefined,
		};

		const emailModel = new EmailModel(dataWithoutMobile);
		const validationErrors = emailModel.validate();

		// Expect no validation errors if mobile is not provided
		expect(Object.keys(validationErrors)).toHaveLength(0);
	});

	it('should allow empty mobile field', () => {
		const dataWithEmptyMobile: EmailData = {
			...emailData,
			mobile: '',
		};

		const emailModel = new EmailModel(dataWithEmptyMobile);
		const validationErrors = emailModel.validate();

		// Expect no validation errors for empty mobile field
		expect(Object.keys(validationErrors)).toHaveLength(0);
	});

	it('should not allow invalid mobile formats when provided', () => {
		const dataWithInvalidMobile: EmailData = {
			...emailData,
			mobile: '12345',
		};

		const emailModel = new EmailModel(dataWithInvalidMobile);
		const validationErrors = emailModel.validate();

		// Expect validation error for invalid mobile format
		expect(validationErrors).toHaveProperty('mobile');
		expect(validationErrors.mobile).toBe('Ingresa un número de telefónico válido.');
	});

	// Testing boundary values for message length
	it('should return error if message is shorter than 10 characters', () => {
		const shortMessageData: EmailData = {
			...emailData,
			message: 'Short',
		};

		const emailModel = new EmailModel(shortMessageData);
		const validationErrors = emailModel.validate();

		// Expect validation error for too short message
		expect(validationErrors).toHaveProperty('message');
		expect(validationErrors.message).toBe('El mensaje debe tener entre 10 y 500 caracteres.');
	});

	it('should return error if message exceeds 500 characters', () => {
		const longMessage = 'a'.repeat(501); // Message with 501 characters
		const longMessageData: EmailData = {
			...emailData,
			message: longMessage,
		};

		const emailModel = new EmailModel(longMessageData);
		const validationErrors = emailModel.validate();

		// Expect validation error for too long message
		expect(validationErrors).toHaveProperty('message');
		expect(validationErrors.message).toBe('El mensaje debe tener entre 10 y 500 caracteres.');
	});

	it.each([
		[
			{
				name: '',
				email: 'invalid-email',
				mobile: 'invalid-phone',
				message: 'Hi',
			},
			{
				name: 'El campo de nombre no puede estar vacío.',
				email: 'Ingresa un correo electrónico válido.',
				mobile: 'Ingresa un número de telefónico válido.',
				message: 'El mensaje debe tener entre 10 y 500 caracteres.',
			},
		],
		// Additional test cases can be added here if needed
	])('should return correct errors for various invalid data cases', (invalidData, expectedErrors) => {
		const emailModel = new EmailModel(invalidData as EmailData);
		const validationErrors = emailModel.validate();

		// Check that all specific expected errors are returned
		expect(validationErrors).toEqual(expectedErrors);
	});
});
