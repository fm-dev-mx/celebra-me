export type AuthMethod = 'password' | 'magic_link';
export type AuthPanel = 'login' | 'register';

export interface LoginFormState {
	method: AuthMethod;
	email: string;
	password: string;
}

export interface RegisterFormState extends LoginFormState {
	claimCode: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ALIAS_PATTERN = /^[a-z0-9._-]{3,60}$/;

function normalize(value: string): string {
	return value.trim();
}

export function isValidEmail(email: string): boolean {
	return EMAIL_PATTERN.test(normalize(email));
}

export function isValidLoginIdentifier(identifier: string): boolean {
	const value = normalize(identifier).toLowerCase();
	return EMAIL_PATTERN.test(value) || LOGIN_ALIAS_PATTERN.test(value);
}

export function getMethodHelpText(method: AuthMethod): string {
	if (method === 'magic_link') {
		return 'Te enviaremos un enlace seguro por correo. Suele llegar en menos de 2 minutos.';
	}
	return 'Acceso inmediato con tu correo o usuario y contrasena.';
}

export function validateLoginForm(input: LoginFormState): string | null {
	if (!normalize(input.email)) {
		return input.method === 'magic_link'
			? 'Escribe un correo valido para continuar.'
			: 'Escribe tu correo o usuario para continuar.';
	}

	if (input.method === 'magic_link' && !isValidEmail(input.email)) {
		return 'Escribe un correo valido para continuar.';
	}

	if (input.method === 'password' && !isValidLoginIdentifier(input.email)) {
		return 'Escribe un correo o usuario valido para continuar.';
	}

	if (input.method === 'password' && !normalize(input.password)) {
		return 'Ingresa tu contrasena para continuar con este metodo.';
	}

	return null;
}

export function validateRegisterForm(input: RegisterFormState): string | null {
	if (!normalize(input.email) || !isValidEmail(input.email)) {
		return 'Escribe un correo valido para continuar.';
	}

	if (input.method === 'password' && !normalize(input.password)) {
		return 'Ingresa tu contrasena para continuar con este metodo.';
	}

	// In rsvp, claimCode is handled by the backend.
	// The mandatory check is removed to allow Superadmins to skip it.
	return null;
}
