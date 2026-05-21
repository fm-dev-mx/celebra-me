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

// Supported country calling codes for import/export.
// Listed longer-first so matching and splitting prefer the more specific prefix.
export const SUPPORTED_COUNTRY_CODES = ['+52', '+34', '+1'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

/**
 * Normalizes an imported phone number with an explicit country calling code.
 *
 * Rules:
 *  - If phone is empty/null/whitespace → returns '' (caller decides whether to accept).
 *  - If phone starts with '+': clean formatting and preserve the international number.
 *    If countryCode is also provided and the phone does NOT start with that code → throws.
 *  - If phone does NOT start with '+': countryCode is required.
 *    Combines as countryCode + cleaned(phone) → returns '+<cc><digits>'.
 *  - Never infers country. Never prepends a default prefix.
 *  - Never replaces a usable phone with a PENDING_ placeholder.
 *
 * @throws {Error} with a descriptive message if validation fails.
 */
export function normalizeImportedPhone(phone: string, countryCode?: string): string {
	const trimmed = phone?.trim() ?? '';
	if (!trimmed) return '';

	// PENDING_ placeholders are a data-model concern, not a real phone — pass through as-is.
	if (trimmed.startsWith('PENDING_')) return trimmed;

	if (trimmed.startsWith('+')) {
		const cleaned = '+' + trimmed.slice(1).replace(/[^\d]/g, '');
		if (countryCode) {
			const cc = countryCode.startsWith('+') ? countryCode : '+' + countryCode;
			if (!cleaned.startsWith(cc)) {
				throw new Error(
					`El teléfono internacional (${cleaned}) no coincide con el código de país proporcionado (${cc}).`,
				);
			}
		}
		return cleaned;
	}

	// Local phone — countryCode is required.
	const cc = (countryCode ?? '').trim();
	if (!cc) {
		throw new Error(
			'El teléfono no tiene código de país. Agrega el código de país o escribe el número completo empezando con +.',
		);
	}

	const digits = trimmed.replace(/[^\d]/g, '');
	if (!digits) return '';

	const prefix = cc.startsWith('+') ? cc : '+' + cc;
	return prefix + digits;
}

/**
 * Attempts to split a stored international phone into country code + local number.
 * Returns undefined if the phone cannot be matched to a known supported prefix.
 * Longer prefixes are matched before shorter ones.
 */
export function splitPhoneForExport(
	phone: string,
): { countryCode: string; localPhone: string } | undefined {
	if (!phone || phone.startsWith('PENDING_')) return undefined;

	for (const cc of SUPPORTED_COUNTRY_CODES) {
		if (phone.startsWith(cc)) {
			return { countryCode: cc, localPhone: phone.slice(cc.length) };
		}
	}
	return undefined;
}
