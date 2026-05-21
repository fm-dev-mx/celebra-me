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
}

export type ColumnTarget = 'fullName' | 'phone' | 'phoneCountryCode' | 'email' | 'ignore';

export interface ColumnAssignment {
	sourceIndex: number;
	sourceName: string;
	target: ColumnTarget;
}

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
		if (guest.error) {
			guest._status = 'new';
			return guest;
		}

		let normalizedPhone: string | undefined;
		try {
			const normalized = normalizeImportedPhone(guest.phone, guest.phoneCountryCode);
			normalizedPhone = normalized || undefined;
		} catch {
			normalizedPhone = undefined;
		}

		const barePhone = normalizedPhone ? normalizePhone(normalizedPhone) : undefined;

		if (barePhone && existingPhones.has(barePhone)) {
			guest._status = 'existing-phone';
			return guest;
		}

		if (barePhone && seenPhones.has(normalizedPhone!)) {
			guest._status = 'duplicate-phone';
			return guest;
		}
		if (barePhone) {
			seenPhones.add(normalizedPhone!);
		}

		const normalizedName = normalizeName(guest.fullName);

		if (normalizedName && existingNames.has(normalizedName)) {
			guest._status = 'existing-name';
			return guest;
		}

		if (normalizedName && seenNames.has(normalizedName)) {
			guest._status = 'duplicate-name';
			return guest;
		}
		if (normalizedName) {
			seenNames.add(normalizedName);
		}

		guest._status = 'new';
		return guest;
	});
}

export { pluralS };
