import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';

export type PhoneValidationResult = { ok: true; phone: string } | { ok: false; reason: string };

export function stripAllNonDigits(input: string): string {
	return input.replace(/\D/g, '');
}

/**
 * Validates a 10-digit national phone number.
 * Accepts digits only; strips common formatting chars first.
 * Returns the clean 10-digit string on success.
 */
export function validateNationalPhone(input: string): PhoneValidationResult {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, reason: 'empty' };
	}

	const stripped = trimmed.replace(/[\s()\-.]/g, '');
	if (/[^\d]/.test(stripped)) {
		return {
			ok: false,
			reason: 'El teléfono solo puede contener números, espacios, guiones o paréntesis.',
		};
	}

	if (stripped.length !== 10) {
		return { ok: false, reason: 'El teléfono debe tener exactamente 10 dígitos.' };
	}

	return { ok: true, phone: stripped };
}

/**
 * Parses a phone input that may contain an international prefix.
 *
 * - If input starts with '+' and matches a known country code → splits into countryCode + national digits
 * - If national digits after split are exactly 10 → accepts
 * - If input starts with '+' but no known prefix matches → error
 * - If input does NOT start with '+' → delegates to validateNationalPhone
 */
export function parsePhoneInput(
	input: string,
): { ok: true; phone: string; countryCode: string } | { ok: false; reason: string } {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: true, phone: '', countryCode: DEFAULT_COUNTRY_CODE };
	}

	if (!trimmed.startsWith('+')) {
		const result = validateNationalPhone(trimmed);
		if (!result.ok) return result;
		return { ok: true, phone: result.phone, countryCode: DEFAULT_COUNTRY_CODE };
	}

	// International format: try to match a known prefix
	const cleaned = '+' + trimmed.slice(1).replace(/[^\d]/g, '');
	for (const opt of COUNTRY_OPTIONS) {
		if (cleaned.startsWith(opt.value)) {
			const national = cleaned.slice(opt.value.length);
			const valid = validateNationalPhone(national);
			if (!valid.ok) {
				return { ok: false, reason: valid.reason };
			}
			return { ok: true, phone: valid.phone, countryCode: opt.value };
		}
	}

	return {
		ok: false,
		reason: 'Este código de país no está soportado. Usa +52 (México), +34 (España) o +1 (EE. UU./Canadá).',
	};
}

/** Loose pre-check: true when phone contains at least 10 digits. */
export function hasValidPhone(phone: string): boolean {
	return stripAllNonDigits(phone).length >= 10;
}

/** Builds a digits-only number for wa.me URLs. */
export function buildWhatsAppNumber(
	phone: string | null | undefined,
	countryCode?: string,
): string {
	const stripped = stripAllNonDigits(phone ?? '');
	if (!stripped) return '';

	const cc = countryCode ? stripAllNonDigits(countryCode) : '';

	if (cc && stripped.startsWith(cc)) {
		return stripped;
	}

	return cc + stripped;
}
