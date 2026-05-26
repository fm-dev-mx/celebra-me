import { parsePhoneInput } from '@/lib/phone/validation';

interface ResolvePhonePayloadInput {
	phone: string;
	countryCode: string;
	mode: 'create' | 'edit';
	initialPhone?: string;
}

export type ResolvePhonePayloadResult =
	| { ok: true; phone: string | null | undefined; countryCode?: string }
	| { ok: false; error: string };

export function resolvePhonePayload(input: ResolvePhonePayloadInput): ResolvePhonePayloadResult {
	const phone = input.phone.trim();

	if (!phone) {
		return {
			ok: true,
			phone: input.mode === 'edit' && input.initialPhone ? null : undefined,
		};
	}

	const result = parsePhoneInput(phone);
	if (!result.ok) {
		return { ok: false, error: result.reason };
	}

	return {
		ok: true,
		phone: result.phone,
		countryCode: phone.startsWith('+') ? result.countryCode : input.countryCode,
	};
}
