/**
 * Idempotency Key Utilities
 * Previene operaciones duplicadas en POST/PATCH
 */

import { badRequest } from '@/lib/rsvp/core/http';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_TTL_SECONDS = 3600;

export interface IdempotencyRecord {
	key: string;
	response: unknown;
	createdAt: string;
}

const idempotencyCache = new Map<string, IdempotencyRecord>();

export function extractIdempotencyKey(request: Request): string | null {
	const key = request.headers.get(IDEMPOTENCY_KEY_HEADER);
	if (!key) return null;

	if (key.length < 16 || key.length > 128) {
		return null;
	}

	return key.trim();
}

export function getIdempotentResponse(key: string): { data: unknown; createdAt: string } | null {
	const record = idempotencyCache.get(key);
	if (!record) return null;

	const now = Date.now();
	const created = new Date(record.createdAt).getTime();
	const ageSeconds = (now - created) / 1000;

	if (ageSeconds > IDEMPOTENCY_KEY_TTL_SECONDS) {
		idempotencyCache.delete(key);
		return null;
	}

	return { data: record.response, createdAt: record.createdAt };
}

export function setIdempotentResponse(key: string, response: unknown): void {
	idempotencyCache.set(key, {
		key,
		response,
		createdAt: new Date().toISOString(),
	});
}

export function validateIdempotencyKey(request: Request): string | Response {
	const key = extractIdempotencyKey(request);

	if (!key) {
		return badRequest(
			`Header '${IDEMPOTENCY_KEY_HEADER}' es requerido para operaciones de escritura.`,
		);
	}

	const cached = getIdempotentResponse(key);
	if (cached) {
		return new Response(JSON.stringify(cached.data), {
			status: 200,
			headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
		});
	}

	return key;
}

export function clearExpiredIdempotencyKeys(): void {
	const now = Date.now();
	for (const [key, record] of idempotencyCache) {
		const created = new Date(record.createdAt).getTime();
		const ageSeconds = (now - created) / 1000;
		if (ageSeconds > IDEMPOTENCY_KEY_TTL_SECONDS) {
			idempotencyCache.delete(key);
		}
	}
}

setInterval(clearExpiredIdempotencyKeys, 300000);
