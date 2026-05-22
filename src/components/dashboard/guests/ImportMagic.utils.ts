import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { normalizeImportedPhone, normalizePhone, normalizeName } from '@/lib/rsvp/core/utils';

export type ImportRowStatus =
	| 'new'
	| 'exact_duplicate'
	| 'probable_duplicate'
	| 'same_phone_update'
	| 'same_name_different_phone'
	| 'same_name_missing_phone'
	| 'ambiguous_name_match'
	| 'internal_duplicate'
	| 'invalid';

export type ImportRowAction = 'create' | 'update' | 'skip';
export interface ParsedGuest {
	fullName: string;
	phone: string;
	phoneCountryCode: string;
	email: string | null;
	maxAllowedAttendees?: number;
	tags?: string[];
	error?: string;
	fieldErrors?: {
		fullName?: string;
		phone?: string;
		phoneCountryCode?: string;
		email?: string;
	};
	_status?: ImportRowStatus;
	action?: ImportRowAction;
	actionTouched?: boolean;
	requiresReview?: boolean;
	hiddenByDefault?: boolean;
	matchedGuestId?: string;
	matchedGuestName?: string;
	normalizedPhone?: string;
	normalizedName?: string;
}

export type ColumnTarget =
	| 'fullName'
	| 'phone'
	| 'phoneCountryCode'
	| 'email'
	| 'maxAllowedAttendees'
	| 'tags'
	| 'ignore';

export interface ColumnAssignment {
	sourceIndex: number;
	sourceName: string;
	target: ColumnTarget;
}

export interface CsvParseResult {
	rows: ParsedGuest[];
	headerMapping: Map<string, keyof ParsedGuest> | null;
	rawRows: string[][];
	headers: string[] | null;
}

export const IMPORT_FATAL_ERROR =
	'Los datos son válidos, pero no se puede importar porque el evento no está disponible o no tienes permiso.';

export const KNOWN_IMPORT_HEADERS: Record<string, keyof ParsedGuest> = {
	nombre: 'fullName',
	name: 'fullName',
	full_name: 'fullName',
	teléfono: 'phone',
	telefono: 'phone',
	phone: 'phone',
	clave_pais: 'phoneCountryCode',
	country_code: 'phoneCountryCode',
	correo: 'email',
	email: 'email',
	max_allowed_attendees: 'maxAllowedAttendees',
	tags: 'tags',
};

export const IGNORED_EXPORT_HEADERS = new Set([
	'guest_id',
	'invite_id',
	'attendance_status',
	'attendee_count',
	'delivery_status',
	'first_viewed_at',
	'responded_at',
	'updated_at',
	'guest_comment',
]);

function pluralS(count: number): string {
	return count !== 1 ? 's' : '';
}

export function normalizeGuestName(value: string | null | undefined): string {
	return normalizeName(value ?? '');
}

export function normalizePhoneForComparison(
	phone: string | null | undefined,
	countryCode?: string | null,
): string {
	const rawPhone = (phone ?? '').trim();
	const rawCountryCode = (countryCode ?? '').trim();
	if (!rawPhone) return '';
	try {
		const normalized = normalizeImportedPhone(rawPhone, rawCountryCode || undefined);
		return normalized ? normalizePhone(normalized) : '';
	} catch {
		return normalizePhone(rawPhone);
	}
}

function normalizePhoneForPayload(guest: ParsedGuest): string | undefined {
	try {
		const normalized = normalizeImportedPhone(guest.phone, guest.phoneCountryCode);
		return normalized || undefined;
	} catch {
		return undefined;
	}
}

function splitCsvRows(content: string): string[][] {
	const rows: string[][] = [];
	let current = '';
	let row: string[] = [];
	let inQuotes = false;
	let delimiter: string | null = null;

	const chooseDelimiter = (char: string) => {
		if (!delimiter && (char === ',' || char === '\t' || char === ';')) delimiter = char;
		return delimiter === char;
	};

	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		const next = content[i + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (!inQuotes && chooseDelimiter(char)) {
			row.push(current);
			current = '';
			continue;
		}

		if (!inQuotes && (char === '\n' || char === '\r')) {
			if (char === '\r' && next === '\n') i++;
			row.push(current);
			if (row.some((cell) => cell.trim() !== '')) rows.push(row);
			row = [];
			current = '';
			delimiter = null;
			continue;
		}

		current += char;
	}

	row.push(current);
	if (row.some((cell) => cell.trim() !== '')) rows.push(row);
	return rows;
}

function parseTags(value: string): string[] {
	return value
		.split(/[;,]/)
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function applyFieldValue(result: ParsedGuest, key: keyof ParsedGuest, value: string): void {
	if (key === 'fullName') result.fullName = value;
	else if (key === 'phone') result.phone = value;
	else if (key === 'phoneCountryCode') result.phoneCountryCode = value;
	else if (key === 'email') result.email = value || null;
	else if (key === 'maxAllowedAttendees') {
		const parsed = Number.parseInt(value, 10);
		if (Number.isFinite(parsed)) result.maxAllowedAttendees = parsed;
	} else if (key === 'tags') {
		result.tags = parseTags(value);
	}
}

export function parsePositional(parts: string[]): ParsedGuest {
	const result: ParsedGuest = {
		fullName: parts[0]?.trim() ?? '',
		phone: parts[1]?.trim() ?? '',
		phoneCountryCode: '',
		email: null,
	};

	if (parts.length >= 4) {
		result.phoneCountryCode = parts[2]?.trim() ?? '';
		result.email = parts[3]?.trim() || null;
	} else if (parts.length === 3) {
		const third = parts[2]?.trim() ?? '';
		if (third.startsWith('+') || /^\d{1,4}$/.test(third)) result.phoneCountryCode = third;
		else result.email = third || null;
	} else {
		result.email = parts[2]?.trim() || null;
	}

	if (result.phoneCountryCode && !result.phoneCountryCode.startsWith('+')) {
		result.phoneCountryCode = '+' + result.phoneCountryCode;
	}
	return result;
}

export function parseMappedRow(
	parts: string[],
	columnMapping: Map<string, keyof ParsedGuest> | null,
): ParsedGuest {
	const result: ParsedGuest = {
		fullName: '',
		phone: '',
		phoneCountryCode: '',
		email: null,
	};

	if (!columnMapping) return parsePositional(parts);

	for (const [idxStr, field] of columnMapping.entries()) {
		applyFieldValue(result, field, parts[Number(idxStr)]?.trim() ?? '');
	}

	if (result.phoneCountryCode && !result.phoneCountryCode.startsWith('+')) {
		result.phoneCountryCode = '+' + result.phoneCountryCode;
	}
	return result;
}

export function validateGuestRow(guest: ParsedGuest): {
	rowError?: string;
	fieldErrors?: NonNullable<ParsedGuest['fieldErrors']>;
} {
	const fieldErrors: NonNullable<ParsedGuest['fieldErrors']> = {};
	const name = guest.fullName.trim();
	const phone = guest.phone.trim();
	const countryCode = guest.phoneCountryCode.trim();

	if (!name) {
		fieldErrors.fullName = 'El nombre es obligatorio.';
	}

	if (!phone && !countryCode) {
		// valid
	} else if (phone && !phone.startsWith('+') && !countryCode) {
		fieldErrors.phone =
			'Agrega el código de país o escribe el número completo empezando con +.';
		fieldErrors.phoneCountryCode =
			'La clave país es obligatoria cuando el teléfono no empieza con +.';
	} else if (phone && !phone.startsWith('+') && countryCode) {
		try {
			normalizeImportedPhone(phone, countryCode);
		} catch {
			fieldErrors.phoneCountryCode = 'Código de país no válido.';
		}
	} else if (phone.startsWith('+') && countryCode) {
		try {
			normalizeImportedPhone(phone, countryCode);
		} catch {
			fieldErrors.phone =
				'El teléfono internacional no coincide con el código de país proporcionado.';
			fieldErrors.phoneCountryCode = 'El código de país no coincide con el teléfono.';
		}
	}

	const hasErrors = Object.keys(fieldErrors).length > 0;
	return {
		rowError: hasErrors
			? fieldErrors.phone ||
				fieldErrors.phoneCountryCode ||
				fieldErrors.fullName ||
				'Corrige los errores de esta fila.'
			: undefined,
		fieldErrors: hasErrors ? fieldErrors : undefined,
	};
}

export function applyValidation(guest: ParsedGuest): ParsedGuest {
	const result: ParsedGuest = { ...guest };
	delete result.error;
	delete result.fieldErrors;
	const validation = validateGuestRow(result);
	if (validation.rowError) result.error = validation.rowError;
	if (validation.fieldErrors) result.fieldErrors = validation.fieldErrors;
	return result;
}

export function detectHeaderMapping(parts: string[]): Map<string, keyof ParsedGuest> | null {
	const headers = parts.map((part) =>
		part
			.trim()
			.toLowerCase()
			.replace(/^\uFEFF/, ''),
	);
	const knownHeaderCount = headers.filter((header) => KNOWN_IMPORT_HEADERS[header]).length;
	if (knownHeaderCount < 2) return null;

	const mapping = new Map<string, keyof ParsedGuest>();
	headers.forEach((header, index) => {
		const target = KNOWN_IMPORT_HEADERS[header];
		if (target) mapping.set(String(index), target);
	});
	return mapping;
}

export function looksLikeDataValue(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith('+')) return true;
	if (/^\d{6,}$/.test(trimmed)) return true;
	if (trimmed.includes('@')) return true;
	return false;
}

export function isProbablyHeaderRow(parts: string[]): boolean {
	const headers = parts.map((part) =>
		part
			.trim()
			.toLowerCase()
			.replace(/^\uFEFF/, ''),
	);
	if (
		headers.some((header) => KNOWN_IMPORT_HEADERS[header] || IGNORED_EXPORT_HEADERS.has(header))
	) {
		return true;
	}
	return parts.every((part) => !looksLikeDataValue(part));
}

export function parseCsvLikeContent(content: string): CsvParseResult {
	const rawRows = splitCsvRows(content);
	if (rawRows.length === 0) {
		return { rows: [], headerMapping: null, rawRows: [], headers: null };
	}

	const headerMapping = detectHeaderMapping(rawRows[0]);
	const firstRowIsHeader = Boolean(headerMapping) || isProbablyHeaderRow(rawRows[0]);
	const dataRows = firstRowIsHeader ? rawRows.slice(1) : rawRows;
	const rows = dataRows
		.map((parts) => applyValidation(parseMappedRow(parts, headerMapping)))
		.filter((row) => row.fullName.trim() || row.phone.trim() || (row.email ?? '').trim());

	return {
		rows,
		headerMapping,
		rawRows: dataRows,
		headers: firstRowIsHeader ? rawRows[0] : null,
	};
}

function buildExistingIndexes(existingGuests: DashboardGuestItem[]) {
	const byPhone = new Map<string, DashboardGuestItem>();
	const byName = new Map<string, DashboardGuestItem[]>();

	for (const guest of existingGuests) {
		const phone = normalizePhoneForComparison(guest.phone, guest.phoneCountryCode);
		if (phone) byPhone.set(phone, guest);

		const name = normalizeGuestName(guest.fullName);
		if (name) {
			const list = byName.get(name) ?? [];
			list.push(guest);
			byName.set(name, list);
		}
	}

	return { byPhone, byName };
}

function defaultActionForStatus(status: ImportRowStatus): ImportRowAction {
	if (status === 'new' || status === 'same_name_different_phone') return 'create';
	if (status === 'same_phone_update') return 'update';
	return 'skip';
}

function isActionAllowed(
	action: ImportRowAction,
	status: ImportRowStatus,
	matchedGuestId?: string,
): boolean {
	if (action === 'skip') return true;
	if (action === 'create') {
		return (
			status === 'new' ||
			status === 'same_name_different_phone' ||
			status === 'same_name_missing_phone' ||
			status === 'ambiguous_name_match'
		);
	}
	return (
		Boolean(matchedGuestId) &&
		(status === 'same_phone_update' || status === 'same_name_missing_phone')
	);
}

function applyActionPreference(
	row: ParsedGuest,
	status: ImportRowStatus,
	matchedGuestId?: string,
): ImportRowAction {
	if (row.actionTouched && row.action && isActionAllowed(row.action, status, matchedGuestId)) {
		return row.action;
	}
	return defaultActionForStatus(status);
}

export function classifyImportedRows(
	guests: ParsedGuest[],
	existingGuests: DashboardGuestItem[],
): ParsedGuest[] {
	const { byPhone, byName } = buildExistingIndexes(existingGuests);
	const seenPhones = new Set<string>();
	const seenExactKeys = new Set<string>();

	return guests.map((guest) => {
		const result: ParsedGuest = { ...guest };
		const normalizedName = normalizeGuestName(result.fullName);
		const comparePhone = normalizePhoneForComparison(result.phone, result.phoneCountryCode);
		const normalizedPhone = normalizePhoneForPayload(result);
		const exactKey = `${normalizedName}|${comparePhone}`;

		result.normalizedName = normalizedName;
		result.normalizedPhone = normalizedPhone;
		result.requiresReview = false;
		result.hiddenByDefault = false;
		result.matchedGuestId = undefined;
		result.matchedGuestName = undefined;

		let status: ImportRowStatus = 'new';
		let matchedGuest: DashboardGuestItem | undefined;

		if (result.error) {
			status = 'invalid';
		} else if (
			(comparePhone && seenPhones.has(comparePhone)) ||
			(normalizedName && seenExactKeys.has(exactKey))
		) {
			status = 'internal_duplicate';
			result.requiresReview = true;
		} else {
			matchedGuest = comparePhone ? byPhone.get(comparePhone) : undefined;
			const nameMatches = normalizedName ? (byName.get(normalizedName) ?? []) : [];

			if (matchedGuest) {
				result.matchedGuestId = matchedGuest.guestId;
				result.matchedGuestName = matchedGuest.fullName;
				const matchedName = normalizeGuestName(matchedGuest.fullName);
				status = matchedName === normalizedName ? 'exact_duplicate' : 'same_phone_update';
				result.hiddenByDefault = status === 'exact_duplicate';
				result.requiresReview = status === 'same_phone_update';
			} else if (nameMatches.length > 1) {
				status = 'ambiguous_name_match';
				result.requiresReview = true;
			} else if (nameMatches.length === 1) {
				matchedGuest = nameMatches[0];
				result.matchedGuestId = matchedGuest.guestId;
				result.matchedGuestName = matchedGuest.fullName;
				const existingPhone = normalizePhoneForComparison(
					matchedGuest.phone,
					matchedGuest.phoneCountryCode,
				);
				if (!existingPhone && !comparePhone) {
					status = 'probable_duplicate';
					result.hiddenByDefault = true;
				} else if (!existingPhone || !comparePhone) {
					status = 'same_name_missing_phone';
					result.requiresReview = true;
				} else {
					status = 'same_name_different_phone';
					result.requiresReview = true;
				}
			}
		}

		if (comparePhone) seenPhones.add(comparePhone);
		if (normalizedName) seenExactKeys.add(exactKey);

		result._status = status;
		result.action = applyActionPreference(result, status, result.matchedGuestId);
		if (status === 'invalid') {
			result.action = 'skip';
			result.requiresReview = true;
		}
		return result;
	});
}

export function reclassifyEditedRow(
	rows: ParsedGuest[],
	index: number,
	updatedRow: ParsedGuest,
	existingGuests: DashboardGuestItem[],
): ParsedGuest[] {
	const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? updatedRow : row));
	return classifyImportedRows(nextRows, existingGuests);
}

export { pluralS };
