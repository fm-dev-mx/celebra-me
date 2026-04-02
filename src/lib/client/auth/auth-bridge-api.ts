/**
 * Client-side API abstraction for authentication endpoints.
 * Centralizes login, register, and logout fetch calls so that
 * UI bridges never call fetch() directly.
 */

export interface AuthLoginPayload {
	method: 'password' | 'magic_link';
	email: string;
	password: string;
}

export interface AuthRegisterPayload {
	method: 'password' | 'magic_link';
	email: string;
	password: string;
	claimCode: string;
}

export interface AuthResponse {
	message?: string;
	error?: {
		message?: string;
	};
	next?: string;
	[key: string]: unknown;
}

async function parseJsonSafe(response: Response): Promise<AuthResponse> {
	try {
		return (await response.json()) as AuthResponse;
	} catch {
		return {};
	}
}

function getErrorMessage(data: AuthResponse, fallback: string): string {
	if (typeof data.message === 'string' && data.message.trim()) {
		return data.message;
	}

	const nestedMessage = data.error?.message;
	if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
		return nestedMessage;
	}

	return fallback;
}

class AuthBridgeApi {
	async login(payload: AuthLoginPayload): Promise<AuthResponse> {
		const response = await fetch('/api/auth/login-host', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const data = await parseJsonSafe(response);

		if (!response.ok) {
			throw new Error(getErrorMessage(data, 'Unable to sign in.'));
		}

		return data;
	}

	async register(payload: AuthRegisterPayload): Promise<AuthResponse> {
		const response = await fetch('/api/auth/register-host', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const data = await parseJsonSafe(response);

		if (!response.ok) {
			throw new Error(getErrorMessage(data, 'Unable to register.'));
		}

		return data;
	}

	async logout(): Promise<void> {
		const response = await fetch('/api/auth/logout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
		});

		if (!response.ok) {
			const data = await parseJsonSafe(response);
			throw new Error(getErrorMessage(data, 'Unable to sign out.'));
		}
	}
}

export const authBridgeApi = new AuthBridgeApi();
