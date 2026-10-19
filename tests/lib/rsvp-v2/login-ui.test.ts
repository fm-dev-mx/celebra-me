import { getLoginQueryPrefill } from '@/lib/client/auth/login-bridge';
import {
	isValidEmail as isValidEmailUi,
	isValidLoginIdentifier as isValidLoginIdentifierUi,
	validateLoginForm as validateLoginFormUi,
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

	it('requires a login identifier and a password', () => {
		expect(
			validateLoginFormUi({
				email: 'host@test.com',
				password: '',
			}),
		).toBe('Ingresa tu contrasena para continuar con este metodo.');

		expect(
			validateLoginFormUi({
				email: '',
				password: 'Pass123!',
			}),
		).toBe('Escribe tu correo o usuario para continuar.');

		expect(
			validateLoginFormUi({
				email: 'ximena_meza',
				password: 'ximenameza2026',
			}),
		).toBeNull();
	});

	it('hydrates only safe login params from the query string', () => {
		expect(
			getLoginQueryPrefill(
				'?method=password&email=owner%40example.com&password=Testtest00%21',
			),
		).toEqual({
			email: 'owner@example.com',
			hasPasswordParam: true,
		});
	});

	it('ignores the legacy method param in the query string', () => {
		expect(getLoginQueryPrefill('?method=magic_link&email=ximena_meza')).toEqual({
			email: 'ximena_meza',
			hasPasswordParam: false,
		});
	});
});
