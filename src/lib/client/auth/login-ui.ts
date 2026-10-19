import { isCanonicalHostLoginAlias } from '@/lib/auth/login-alias';

export interface LoginFormState {
	email: string;
	password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: string): string {
	return value.trim();
}

export function isValidEmail(email: string): boolean {
	return EMAIL_PATTERN.test(normalize(email));
}

export function isValidLoginAlias(alias: string): boolean {
	return isCanonicalHostLoginAlias(normalize(alias).toLowerCase());
}

export function isValidLoginIdentifier(identifier: string): boolean {
	const value = normalize(identifier).toLowerCase();
	return EMAIL_PATTERN.test(value) || isValidLoginAlias(value);
}

export function validateLoginForm(input: LoginFormState): string | null {
	if (!normalize(input.email)) {
		return 'Escribe tu correo o usuario para continuar.';
	}

	if (!isValidLoginIdentifier(input.email)) {
		return 'Escribe un correo o usuario valido para continuar.';
	}

	if (!normalize(input.password)) {
		return 'Ingresa tu contrasena para continuar con este metodo.';
	}

	return null;
}
