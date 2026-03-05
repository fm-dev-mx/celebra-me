import {
	getMethodHelpText,
	isValidEmail,
	validateLoginForm,
	validateRegisterForm,
} from '@/lib/rsvp/login-ui';

describe('rsvp login UI helpers', () => {
	it('validates email format', () => {
		expect(isValidEmail('host@test.com')).toBe(true);
		expect(isValidEmail('host@test')).toBe(false);
	});

	it('validates login form based on selected method', () => {
		expect(
			validateLoginForm({
				method: 'password',
				email: 'host@test.com',
				password: '',
			}),
		).toBe('Ingresa tu contrasena para continuar con este metodo.');

		expect(
			validateLoginForm({
				method: 'magic_link',
				email: 'host@test.com',
				password: '',
			}),
		).toBeNull();
	});

	it('allows register form with empty optional claim fields', () => {
		expect(
			validateRegisterForm({
				method: 'password',
				email: 'host@test.com',
				password: 'Pass123!',
				claimCode: '',
			}),
		).toBeNull();
	});

	it('returns clear helper text per auth method', () => {
		expect(getMethodHelpText('password')).toContain('Acceso inmediato');
		expect(getMethodHelpText('magic_link')).toContain('Suele llegar');
	});
});
