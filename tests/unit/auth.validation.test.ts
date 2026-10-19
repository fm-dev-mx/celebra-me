import {
	isValidEmail,
	isValidLoginIdentifier,
	validateLoginForm,
} from '@/lib/client/auth/login-ui';

describe('Authentication Validation Logic (Spanish UI)', () => {
	describe('isValidEmail', () => {
		test('should return true for valid email addresses', () => {
			expect(isValidEmail('test@example.com')).toBe(true);
			expect(isValidEmail('admin.user@celebra.me')).toBe(true);
			expect(isValidEmail('  spaced@test.com  ')).toBe(true);
		});

		test('should return false for invalid email addresses', () => {
			expect(isValidEmail('invalid-email')).toBe(false);
			expect(isValidEmail('@broken.com')).toBe(false);
			expect(isValidEmail('no-domain@')).toBe(false);
			expect(isValidEmail('')).toBe(false);
		});
	});

	describe('validateLoginForm', () => {
		const baseInput = {
			email: 'valid@test.com',
			password: 'securePassword123',
		};

		test('should return null for valid password input', () => {
			expect(validateLoginForm(baseInput)).toBeNull();
		});

		test('should accept a valid alias for password login', () => {
			expect(isValidLoginIdentifier('ximena_meza')).toBe(true);
			expect(
				validateLoginForm({
					...baseInput,
					email: 'ximena_meza',
					password: 'ximenameza2026',
				}),
			).toBeNull();
		});

		test('should return Spanish error for invalid login identifier', () => {
			const result = validateLoginForm({ ...baseInput, email: 'in valid' });
			expect(result).toBe('Escribe un correo o usuario valido para continuar.');
		});

		test('should return Spanish error for missing password', () => {
			const result = validateLoginForm({ ...baseInput, password: '' });
			expect(result).toBe('Ingresa tu contrasena para continuar con este metodo.');
		});
	});
});
