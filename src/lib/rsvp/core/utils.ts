export const MAX_TEXT_LEN = 500;
export const MAX_GUEST_COMMENT_LEN = 1000;
export const DEFAULT_COUNTRY_CODE = '+52';

/**
 * Sanitizes a string by trimming and slicing to a maximum length.
 */
export function sanitize(value: unknown, maxLen = MAX_TEXT_LEN): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

/**
 * Parses a raw Cookie header into a key-value map.
 */
export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	return cookieHeader
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.reduce(
			(acc, part) => {
				const separator = part.indexOf('=');
				if (separator <= 0) return acc;
				const key = decodeURIComponent(part.slice(0, separator).trim());
				const value = decodeURIComponent(part.slice(separator + 1).trim());
				acc[key] = value;
				return acc;
			},
			{} as Record<string, string>,
		);
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

import { SUPPORTED_COUNTRY_CODES } from '@/lib/phone/country-codes';
export type { SupportedCountryCode } from '@/lib/phone/country-codes';
export { SUPPORTED_COUNTRY_CODES };

const COUNTRY_CODE_NUMBERS: readonly string[] = SUPPORTED_COUNTRY_CODES.map((cc) => cc.slice(1));

/**
 * Normalizes an optional phone + countryCode pair.
 * Ensures the DB invariant: either both are present or neither is.
 * If phone is empty/missing, countryCode is also stripped.
 */
export function normalizeOptionalPhonePair(input: {
	phone?: string | null;
	countryCode?: string | null;
}): { phone: string | undefined; countryCode: string | undefined } {
	const phone =
		typeof input.phone === 'string'
			? input.phone.trim() || undefined
			: input.phone || undefined;
	const countryCode = phone ? input.countryCode || undefined : undefined;
	return { phone, countryCode };
}

export function formatPhoneError(
	reason: 'invalid_length' | 'invalid_characters' | 'country_code_in_phone',
): string {
	const messages: Record<typeof reason, string> = {
		country_code_in_phone:
			'No incluyas el código de país en el teléfono. Usa el selector de país.',
		invalid_length: 'El teléfono debe tener exactamente 10 dígitos.',
		invalid_characters:
			'El teléfono solo puede contener números, espacios, guiones o paréntesis.',
	};
	return messages[reason];
}

export type OptionalNationalPhoneResult =
	| { ok: true; phone: string | null }
	| {
			ok: false;
			reason: 'invalid_length' | 'invalid_characters' | 'country_code_in_phone';
	  };

/**
 * Normalizes an optional national phone number.
 *
 * - null / undefined / empty → { ok: true, phone: null }
 * - Valid 10-digit (with optional formatting) → { ok: true, phone: '6561234567' }
 * - Contains '+' → country_code_in_phone
 * - More than 10 digits with leading country code digits → country_code_in_phone
 * - Any other length mismatch → invalid_length
 * - Non-formatting, non-digit characters → invalid_characters
 *
 * Does NOT trim, slice, or auto-correct. Rejects invalid input explicitly.
 */
export function normalizeOptionalNationalPhone(
	input: string | null | undefined,
): OptionalNationalPhoneResult {
	if (input == null || input.trim() === '') {
		return { ok: true, phone: null };
	}

	const trimmed = input.trim();

	const noPlus = trimmed.replace(/^\+/, '');
	if (noPlus.length !== trimmed.length) {
		return { ok: false, reason: 'country_code_in_phone' };
	}

	const stripped = noPlus.replace(/[\s()\-.]+/g, '');

	if (/[^\d]/.test(stripped)) {
		return { ok: false, reason: 'invalid_characters' };
	}

	if (stripped.length !== 10) {
		if (stripped.length > 10 && stripped.length <= 14) {
			const extra = stripped.slice(0, stripped.length - 10);
			if (COUNTRY_CODE_NUMBERS.some((cc) => extra.startsWith(cc))) {
				return { ok: false, reason: 'country_code_in_phone' };
			}
		}
		return { ok: false, reason: 'invalid_length' };
	}

	return { ok: true, phone: stripped };
}

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
