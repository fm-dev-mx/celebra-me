export type AuthMethod = 'password' | 'magic_link';
export type AuthPanel = 'login' | 'register';

export interface LoginFormState {
	method: AuthMethod;
	email: string;
	password: string;
}

export interface RegisterFormState extends LoginFormState {
	eventSlug: string;
	claimCode: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: string): string {
	return value.trim();
}

export function isValidEmail(email: string): boolean {
	return EMAIL_PATTERN.test(normalize(email));
}

export function getMethodHelpText(method: AuthMethod): string {
	if (method === 'magic_link') {
		return 'Te enviaremos un enlace seguro por correo. Suele llegar en menos de 2 minutos.';
	}
	return 'Acceso inmediato con tu correo y contrasena.';
}

export function validateLoginForm(input: LoginFormState): string | null {
	if (!normalize(input.email) || !isValidEmail(input.email)) {
		return 'Escribe un correo valido para continuar.';
	}

	if (input.method === 'password' && !normalize(input.password)) {
		return 'Ingresa tu contrasena para continuar con este metodo.';
	}

	return null;
}

export function validateRegisterForm(input: RegisterFormState): string | null {
	const loginError = validateLoginForm(input);
	if (loginError) return loginError;

	if (!normalize(input.eventSlug) || !normalize(input.claimCode)) {
		return 'Completa eventSlug y claimCode para crear y vincular tu cuenta.';
	}

	return null;
}
