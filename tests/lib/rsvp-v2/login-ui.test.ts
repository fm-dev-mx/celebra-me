import { getLoginQueryPrefill } from '@/lib/client/auth/login-bridge';
import {
	getMethodHelpText as getMethodHelpTextUi,
	isValidEmail as isValidEmailUi,
	isValidLoginIdentifier as isValidLoginIdentifierUi,
	validateLoginForm as validateLoginFormUi,
	validateRegisterForm as validateRegisterFormUi,
} from '@/lib/client/auth/login-ui';

describe('rsvp login UI helpers', () => {
	it('validates email format', () => {
		expect(isValidEmailUi('host@test.com')).toBe(true);
		expect(isValidEmailUi('host@test')).toBe(false);
	});

	it('validates login identifiers for password access', () => {
		expect(isValidLoginIdentifierUi('host@test.com')).toBe(true);
		expect(isValidLoginIdentifierUi('ximena_meza')).toBe(true);
		expect(isValidLoginIdentifierUi('xx')).toBe(false);
	});

	it('validates login form based on selected method', () => {
		expect(
			validateLoginFormUi({
				method: 'password',
				email: 'host@test.com',
				password: '',
			}),
		).toBe('Ingresa tu contrasena para continuar con este metodo.');

		expect(
			validateLoginFormUi({
				method: 'magic_link',
				email: 'host@test.com',
				password: '',
			}),
		).toBeNull();

		expect(
			validateLoginFormUi({
				method: 'password',
				email: 'ximena_meza',
				password: 'ximenameza2026',
			}),
		).toBeNull();
	});

	it('requires claimCode for register form submissions', () => {
		expect(
			validateRegisterFormUi({
				method: 'password',
				email: 'host@test.com',
				password: 'Pass123!',
				claimCode: '',
			}),
		).toBe('Ingresa tu claimCode para continuar.');
	});

	it('returns clear helper text per auth method', () => {
		expect(getMethodHelpTextUi('password')).toContain('Acceso inmediato');
		expect(getMethodHelpTextUi('magic_link')).toContain('Suele llegar');
	});

	it('hydrates only safe login params from the query string', () => {
		expect(
			getLoginQueryPrefill(
				'?method=password&email=celebra.me.com%40gmail.com&password=Testtest00%21',
			),
		).toEqual({
			method: 'password',
			email: 'celebra.me.com@gmail.com',
			hasPasswordParam: true,
		});
	});

	it('ignores invalid auth methods in the query string', () => {
		expect(getLoginQueryPrefill('?method=token&email=ximena_meza')).toEqual({
			method: null,
			email: 'ximena_meza',
			hasPasswordParam: false,
		});
	});
});
