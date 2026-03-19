/**
 * src/lib/rsvp/auth-bridge-api.ts
 *
 * Client-side API abstraction for authentication endpoints.
 * Centralizes login, register, and logout fetch calls so that
 * UI bridges (login-bridge.ts, logout-client.ts) never call
 * fetch() directly.
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

class AuthBridgeApi {
	async login(payload: AuthLoginPayload): Promise<AuthResponse> {
		const response = await fetch('/api/auth/login-host', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const data = await parseJsonSafe(response);

		if (!response.ok) {
			throw new Error(data.message || 'No se pudo iniciar sesion.');
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
			throw new Error(data.message || 'No se pudo registrar.');
		}

		return data;
	}

	async logout(): Promise<void> {
		await fetch('/api/auth/logout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

export const authBridgeApi = new AuthBridgeApi();
