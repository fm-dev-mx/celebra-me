import { timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/utils/env';

const REALM = 'RSVP Admin';

function safeCompare(left: string, right: string): boolean {
	try {
		const a = Buffer.from(left, 'utf8');
		const b = Buffer.from(right, 'utf8');
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

function parseBasicCredentials(
	authorization: string | null,
): { user: string; password: string } | null {
	if (!authorization || !authorization.startsWith('Basic ')) return null;
	const encoded = authorization.slice('Basic '.length).trim();
	if (!encoded) return null;
	try {
		const decoded = Buffer.from(encoded, 'base64').toString('utf8');
		const separator = decoded.indexOf(':');
		if (separator < 0) return null;
		return {
			user: decoded.slice(0, separator),
			password: decoded.slice(separator + 1),
		};
	} catch {
		return null;
	}
}

function ensureAdminEnv(): { expectedUser: string; expectedPassword: string } {
	const expectedUser = getEnv('RSVP_ADMIN_USER');
	const expectedPassword = getEnv('RSVP_ADMIN_PASSWORD');
	if (!expectedUser || !expectedPassword) {
		throw new Error(
			'RSVP admin auth no configurada. Define RSVP_ADMIN_USER y RSVP_ADMIN_PASSWORD.',
		);
	}
	return { expectedUser, expectedPassword };
}

export function isAuthorizedBasicAuth(authorization: string | null): boolean {
	const creds = parseBasicCredentials(authorization);
	if (!creds) return false;
	const { expectedUser, expectedPassword } = ensureAdminEnv();
	return safeCompare(creds.user, expectedUser) && safeCompare(creds.password, expectedPassword);
}

export function unauthorizedJsonResponse(): Response {
	return new Response(JSON.stringify({ message: 'No autorizado.' }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
		},
	});
}

export function unauthorizedTextResponse(): Response {
	return new Response('No autorizado.', {
		status: 401,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
		},
	});
}
