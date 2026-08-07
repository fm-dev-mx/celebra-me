/**
 * Venue date/time presentation helpers.
 *
 * Persistence contract (canonical):
 *   date → YYYY-MM-DD
 *   time → HH:mm
 *
 * Legacy Published prose (`28 de noviembre de 2026`, `5:30 p. m.`) is accepted
 * only at this read/normalize boundary. Spanish formatting is presentation-only.
 */
import { toEditorDate, trimmedStr } from '@/lib/shared/data-utils';
import { formatTimeSpanish, normalizeTime } from '@/lib/time/time-format';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a persisted date string is already canonical `YYYY-MM-DD`. */
export function isCanonicalVenueDate(value: unknown): boolean {
	return typeof value === 'string' && ISO_DATE.test(value);
}

/** True when a persisted time string is already canonical `HH:mm`. */
export function isCanonicalVenueTime(value: unknown): boolean {
	return typeof value === 'string' && normalizeTime(value) === value;
}

/** True when value looks like Spanish long-date prose (or other non-canonical text). */
export function isLegacyVenueDateProse(value: unknown): boolean {
	const raw = trimmedStr(value);
	if (!raw || isCanonicalVenueDate(raw)) return false;
	return toEditorDate(raw) !== undefined;
}

/** True when value is a display time that normalizes to HH:mm but is not already HH:mm. */
export function isLegacyVenueTimeProse(value: unknown): boolean {
	const raw = trimmedStr(value);
	if (!raw || isCanonicalVenueTime(raw)) return false;
	return normalizeTime(raw) !== undefined;
}

/**
 * Normalize a venue date to canonical Draft/Published machine form.
 * Returns undefined when the value cannot be parsed.
 */
export function toCanonicalVenueDate(value: unknown): string | undefined {
	return toEditorDate(value);
}

/**
 * Normalize a venue time to canonical Draft/Published machine form (`HH:mm`).
 * Returns undefined when the value cannot be parsed.
 */
export function toCanonicalVenueTime(value: unknown): string | undefined {
	return normalizeTime(value);
}

/**
 * Spanish long date for venue cards (`14 de agosto de 2026`).
 * Accepts canonical YYYY-MM-DD, ISO datetime, or legacy Spanish prose.
 */
export function formatVenueDateForDisplay(value: unknown): string | null {
	const canonical = toCanonicalVenueDate(value);
	if (!canonical) return null;
	const d = new Date(`${canonical}T00:00:00.000Z`);
	if (isNaN(d.getTime())) return null;
	return d.toLocaleDateString('es-MX', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

/**
 * Spanish display time for venue cards (`5:30 p. m.`).
 * Accepts canonical HH:mm or legacy `a. m.` / `p. m.` / AM/PM forms.
 */
export function formatVenueTimeForDisplay(value: unknown): string | null {
	const canonical = toCanonicalVenueTime(value);
	if (!canonical) {
		const raw = trimmedStr(value);
		return raw ?? null;
	}
	return formatTimeSpanish(canonical);
}
