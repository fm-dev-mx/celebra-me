import {
	getMethodHelpText,
	isValidEmail,
	validateLoginForm,
	validateRegisterForm,
} from '@/lib/rsvp-v2/loginUi';

describe('rsvp-v2 login UI helpers', () => {
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

	it('validates register form required claim fields', () => {
		expect(
			validateRegisterForm({
				method: 'password',
				email: 'host@test.com',
				password: 'Pass123!',
				eventSlug: '',
				claimCode: '',
			}),
		).toBe('Completa eventSlug y claimCode para crear y vincular tu cuenta.');
	});

	it('returns clear helper text per auth method', () => {
		expect(getMethodHelpText('password')).toContain('Acceso inmediato');
		expect(getMethodHelpText('magic_link')).toContain('Suele llegar');
	});
});
