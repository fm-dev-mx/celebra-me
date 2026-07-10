export interface NormalizedCommercialPhone {
	countryCode: string;
	national: string;
	e164: string;
}

const SUPPORTED_COUNTRY_CODES = new Set(['+1', '+52']);

function normalizeCountryCode(countryCode: string | undefined): string | undefined {
	const digits = countryCode?.replace(/\D/g, '');
	if (!digits) return undefined;
	const normalized = `+${digits}`;
	return SUPPORTED_COUNTRY_CODES.has(normalized) ? normalized : undefined;
}

export function normalizeCommercialPhone(
	phone: string | undefined,
	defaultCountryCode = '+52',
): NormalizedCommercialPhone | undefined {
	const trimmed = phone?.trim();
	if (!trimmed) return undefined;

	const defaultCode = normalizeCountryCode(defaultCountryCode);
	if (!defaultCode) return undefined;

	const digits = trimmed.replace(/\D/g, '');
	if (!digits) return undefined;

	const explicitCode = [...SUPPORTED_COUNTRY_CODES].find((code) =>
		digits.startsWith(code.slice(1)),
	);
	const countryCode = explicitCode ?? defaultCode;
	const countryDigits = countryCode.slice(1);
	const national = explicitCode ? digits.slice(countryDigits.length) : digits;

	if (national.length !== 10) return undefined;

	return {
		countryCode,
		national,
		e164: `${countryCode}${national}`,
	};
}

export function normalizeCommercialEmail(email: string | undefined): string | undefined {
	const normalized = email?.trim().toLowerCase();
	return normalized && normalized.includes('@') ? normalized : undefined;
}

/**
 * Returns a usable E.164 digits-only string suitable for wa.me links,
 * or undefined when the phone cannot be validated as a usable WhatsApp target.
 *
 * Does NOT silently infer missing country codes — only accepts
 * phoneE164 (pre‑normalized) or a raw phone that already carries an
 * explicit '+' prefix followed by a recognizable country code.
 */
export function getUsableWhatsAppE164(
	phoneE164: string | null | undefined,
	rawPhone?: string | null,
): string | undefined {
	// Try the pre‑normalized E.164 first (most reliable when present)
	if (phoneE164) {
		const normalized = normalizeCommercialPhone(phoneE164);
		if (normalized) return normalized.e164.replace(/\D/g, '');
	}
	// Fall back to the raw phone ONLY when it already has a country code
	if (rawPhone?.startsWith('+')) {
		const normalized = normalizeCommercialPhone(rawPhone);
		if (normalized) return normalized.e164.replace(/\D/g, '');
	}
	return undefined;
}
