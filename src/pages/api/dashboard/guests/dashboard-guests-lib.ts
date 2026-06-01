import { ApiError } from '@/lib/rsvp/core/errors';
import { formatPhoneError, normalizeOptionalNationalPhone } from '@/lib/rsvp/core/utils';
import { isSupportedCountryCode } from '@/lib/phone/country-codes';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { getIp } from '@/lib/rsvp/core/http';

export async function requireDashboardRateLimit(entityId: string, request: Request): Promise<void> {
	const allowed = await checkRateLimit({
		namespace: 'dashboard',
		entityId,
		ip: getIp(request),
		maxHits: 30,
		windowSec: 60,
	});
	if (!allowed) {
		throw new ApiError(429, 'rate_limited', 'Too many requests.');
	}
}

export function validateGuestPhoneInput(
	rawPhone: string,
	countryCode: string | undefined,
):
	| { ok: true; phone: string | null; countryCode: string | undefined }
	| { ok: false; message: string } {
	const phoneResult = normalizeOptionalNationalPhone(rawPhone || null);
	if (!phoneResult.ok) {
		return { ok: false, message: formatPhoneError(phoneResult.reason) };
	}
	const normalizedCountryCode = phoneResult.phone ? countryCode : undefined;
	if (phoneResult.phone && !normalizedCountryCode) {
		return { ok: false, message: 'La clave país es obligatoria cuando hay teléfono.' };
	}
	if (normalizedCountryCode && !isSupportedCountryCode(normalizedCountryCode)) {
		return { ok: false, message: 'Código de país no válido.' };
	}
	return { ok: true, phone: phoneResult.phone, countryCode: normalizedCountryCode };
}
