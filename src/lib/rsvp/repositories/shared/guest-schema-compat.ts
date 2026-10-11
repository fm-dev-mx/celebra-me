import { ApiError } from '@/lib/rsvp/core/errors';
import {
	GUEST_BASE_COLUMNS,
	GUEST_COLUMNS,
	GUEST_ENGAGEMENT_COLUMN_LIST,
} from '@/lib/rsvp/repositories/shared/rows';

/**
 * Expand-phase compatibility for guest engagement columns (migration 20261010120000).
 *
 * The application can reach a database that does not have the engagement columns yet (a Preview
 * or Production database whose migration is queued behind other pending migrations). Guest reads
 * and writes then retry once with the base columns instead of failing, and every instance
 * re-probes after a short interval so it recovers on its own once the migration is applied.
 *
 * Remove this module in the contract release, once every hosted database has the migration.
 */
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
/** `42703` undefined column in a select; `PGRST204` unknown column in a write body. */
const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

let engagementColumnsMissingUntil = 0;

export interface GuestColumnSet {
	columns: string;
	engagement: boolean;
}

export function isMissingEngagementColumnError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const err = error as { name?: unknown; code?: unknown; body?: unknown };
	if (err.name !== 'SupabaseHttpError' || typeof err.code !== 'string') return false;
	if (!MISSING_COLUMN_CODES.has(err.code)) return false;
	const body = typeof err.body === 'string' ? err.body : '';
	return GUEST_ENGAGEMENT_COLUMN_LIST.some((column) => body.includes(column));
}

/**
 * Runs a guest query with the full column set, or with the base set when the database lacks the
 * engagement columns. Only a missing-engagement-column error triggers the fallback; PostgREST
 * rejects such a statement before executing it, so the retry cannot apply a write twice.
 */
export async function withGuestColumns<T>(
	run: (set: GuestColumnSet) => Promise<T>,
	now: () => number = Date.now,
): Promise<T> {
	if (now() < engagementColumnsMissingUntil) {
		return run({ columns: GUEST_BASE_COLUMNS, engagement: false });
	}
	try {
		return await run({ columns: GUEST_COLUMNS, engagement: true });
	} catch (error) {
		if (!isMissingEngagementColumnError(error)) throw error;
		engagementColumnsMissingUntil = now() + RECHECK_INTERVAL_MS;
		console.warn(
			'[rsvp] Guest engagement columns are missing; using base columns until migration 20261010120000 is applied.',
		);
		return run({ columns: GUEST_BASE_COLUMNS, engagement: false });
	}
}

/**
 * Removes engagement fields from a write body for a database without them. Marking a test guest
 * cannot be dropped silently, so it fails with a clear message instead.
 */
export function stripEngagementWriteFields(
	body: Record<string, unknown>,
	set: GuestColumnSet,
): Record<string, unknown> {
	if (set.engagement || !('is_test' in body)) return body;
	if (body.is_test === true) {
		throw new ApiError(
			503,
			'service_unavailable',
			'La opción «Invitado de prueba» estará disponible cuando se actualice la base de datos.',
		);
	}
	const { is_test: _isTest, ...rest } = body;
	return rest;
}

/** Test hook: forget a cached missing-column result. */
export function resetGuestSchemaCompatForTests(): void {
	engagementColumnsMissingUntil = 0;
}
