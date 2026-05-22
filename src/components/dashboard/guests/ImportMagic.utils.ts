import { normalizeImportedPhone, normalizePhone, normalizeName } from '@/lib/rsvp/core/utils';

export type GuestImportStatus =
	| 'new'
	| 'existing-phone'
	| 'duplicate-phone'
	| 'existing-name'
	| 'duplicate-name';

export interface ParsedGuest {
	fullName: string;
	phone: string;
	phoneCountryCode: string;
	email: string | null;
	error?: string;
	fieldErrors?: {
		fullName?: string;
		phone?: string;
		phoneCountryCode?: string;
		email?: string;
	};
	_status?: GuestImportStatus;
	normalizedPhone?: string;
}

export type ColumnTarget = 'fullName' | 'phone' | 'phoneCountryCode' | 'email' | 'ignore';

export interface ColumnAssignment {
	sourceIndex: number;
	sourceName: string;
	target: ColumnTarget;
}

export const IMPORT_FATAL_ERROR =
	'Los datos son válidos, pero no se puede importar porque el evento no está disponible o no tienes permiso.';

function pluralS(count: number): string {
	return count !== 1 ? 's' : '';
}

export function classifyGuests(
	guests: ParsedGuest[],
	existingPhones: ReadonlySet<string>,
	existingNames: ReadonlySet<string>,
): ParsedGuest[] {
	const seenPhones = new Set<string>();
	const seenNames = new Set<string>();

	return guests.map((guest) => {
		const result: ParsedGuest = { ...guest };

		if (result.error) {
			result._status = 'new';
			result.normalizedPhone = undefined;
			return result;
		}

		let normalizedPhone: string | undefined;
		try {
			const normalized = normalizeImportedPhone(result.phone, result.phoneCountryCode);
			normalizedPhone = normalized || undefined;
		} catch {
			normalizedPhone = undefined;
		}
		result.normalizedPhone = normalizedPhone;

		const barePhone = normalizedPhone ? normalizePhone(normalizedPhone) : undefined;

		if (barePhone && existingPhones.has(barePhone)) {
			result._status = 'existing-phone';
			return result;
		}

		if (barePhone && seenPhones.has(normalizedPhone!)) {
			result._status = 'duplicate-phone';
			return result;
		}
		if (barePhone) {
			seenPhones.add(normalizedPhone!);
		}

		const normalizedName = normalizeName(result.fullName);

		if (normalizedName && existingNames.has(normalizedName)) {
			result._status = 'existing-name';
			return result;
		}

		if (normalizedName && seenNames.has(normalizedName)) {
			result._status = 'duplicate-name';
			return result;
		}
		if (normalizedName) {
			seenNames.add(normalizedName);
		}

		result._status = 'new';
		return result;
	});
}

export { pluralS };
