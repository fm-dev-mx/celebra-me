export const MAX_TEXT_LEN = 500;

/**
 * Sanitizes a string by trimming and slicing to a maximum length.
 */
export function sanitize(value: unknown, maxLen = MAX_TEXT_LEN): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

/**
 * Normalizes a guest name for comparison and storage.
 * Removes accents, converts to lowercase, and collapses whitespace.
 */
export function normalizeName(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Ensures an attendee count is a safe, non-negative integer within bounds.
 */
export function toSafeAttendeeCount(raw: unknown, max = 20): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) {
		const parsed = parseInt(String(raw), 10);
		if (isNaN(parsed)) return 0;
		raw = parsed;
	}
	return Math.max(0, Math.min(Math.trunc(raw as number), max));
}

/**
 * Normalizes a phone number by removing non-digit characters.
 */
export function normalizePhone(phone: string): string {
	return sanitize(phone, 40).replace(/[^\d]/g, '');
}
