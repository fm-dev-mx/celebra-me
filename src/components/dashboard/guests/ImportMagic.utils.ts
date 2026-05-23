import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { isSupportedCountryCode } from '@/lib/phone/country-codes';
import { normalizeName, splitPhoneForExport, SUPPORTED_COUNTRY_CODES } from '@/lib/rsvp/core/utils';

export type ImportRowStatus =
	| 'new'
	| 'exact_duplicate'
	| 'probable_duplicate'
	| 'possible_duplicate'
	| 'phone_conflict'
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

export interface NormalizedPhone {
	phone: string | undefined;
	countryCode: string | undefined;
}

export type PhoneNormResult =
	| ({ ok: true } & NormalizedPhone)
	| { ok: false; field: 'phone' | 'phoneCountryCode'; message: string };

/** Normalises raw import phone + countryCode into national phone + prefix.
 *
 *  - empty phone → { ok: true, phone: undefined, countryCode: undefined }
 *  - national phone + countryCode → validated 10‑digit + normalised prefix
 *  - international phone (+) + empty countryCode → split via known prefixes
 *  - international phone (+) + matching countryCode → prefix stripped
 *  - international phone (+) + mismatched countryCode → error
 *  - national phone without countryCode → error
 *  - non‑10‑digit national phone with countryCode → error
 */
export function normalizeImportPhone(phone: string, countryCode: string): PhoneNormResult {
	const rawPhone = phone.trim();
	const rawCC = countryCode.trim();

	if (!rawPhone) {
		return { ok: true, phone: undefined, countryCode: undefined };
	}

	if (rawPhone.startsWith('+')) {
		return normalizeInternationalPhone(rawPhone, rawCC);
	}

	return normalizeNationalPhone(rawPhone, rawCC);
}

function normalizeInternationalPhone(phone: string, countryCode: string): PhoneNormResult {
	if (countryCode) {
		const cc = countryCode.startsWith('+') ? countryCode : '+' + countryCode;
		if (!isSupportedCountryCode(cc)) {
			return {
				ok: false,
				field: 'phoneCountryCode',
				message: 'Código de país no válido.',
			};
		}
		if (!phone.startsWith(cc)) {
			return {
				ok: false,
				field: 'phone',
				message:
					'El teléfono internacional no coincide con el código de país proporcionado.',
			};
		}
		const national = phone.slice(cc.length).replace(/[^\d]/g, '');
		if (national.length !== 10) {
			return {
				ok: false,
				field: 'phone',
				message: 'El teléfono debe tener exactamente 10 dígitos.',
			};
		}
		return { ok: true, phone: national, countryCode: cc };
	}

	const split = splitPhoneForExport(phone);
	if (!split) {
		return {
			ok: false,
			field: 'phone',
			message:
				'Código de país no reconocido. Escribe solo el número local y usa la columna clave_pais.',
		};
	}
	if (split.localPhone.length !== 10) {
		return {
			ok: false,
			field: 'phone',
			message: 'El teléfono debe tener exactamente 10 dígitos.',
		};
	}
	return { ok: true, phone: split.localPhone, countryCode: split.countryCode };
}

function normalizeNationalPhone(phone: string, countryCode: string): PhoneNormResult {
	if (!countryCode) {
		return {
			ok: false,
			field: 'phoneCountryCode',
			message: 'La clave país es obligatoria cuando el teléfono no empieza con +.',
		};
	}

	const cc = countryCode.startsWith('+') ? countryCode : '+' + countryCode;
	const digits = phone.replace(/[^\d]/g, '');

	if (digits.length !== 10) {
		return {
			ok: false,
			field: 'phone',
			message: 'El teléfono debe tener exactamente 10 dígitos.',
		};
	}

	if (!SUPPORTED_COUNTRY_CODES.includes(cc as (typeof SUPPORTED_COUNTRY_CODES)[number])) {
		return {
			ok: false,
			field: 'phoneCountryCode',
			message: 'Código de país no válido.',
		};
	}

	return { ok: true, phone: digits, countryCode: cc };
}

export function normalizePhoneForComparison(
	phone: string | null | undefined,
	countryCode?: string | null,
): string {
	const rawPhone = (phone ?? '').trim();
	const rawCountryCode = (countryCode ?? '').trim();
	if (!rawPhone) return '';

	const norm = normalizeImportPhone(rawPhone, rawCountryCode);
	if (norm.ok && norm.phone) return norm.phone;

	return rawPhone.replace(/[^\d]/g, '');
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

const FIELD_SETTERS: Record<string, (r: ParsedGuest, v: string) => void> = {
	fullName: (r, v) => {
		r.fullName = v;
	},
	phone: (r, v) => {
		r.phone = v;
	},
	phoneCountryCode: (r, v) => {
		r.phoneCountryCode = v;
	},
	email: (r, v) => {
		r.email = v || null;
	},
	maxAllowedAttendees: (r, v) => {
		const p = Number.parseInt(v, 10);
		if (Number.isFinite(p)) r.maxAllowedAttendees = p;
	},
	tags: (r, v) => {
		r.tags = parseTags(v);
	},
};

function applyFieldValue(result: ParsedGuest, key: keyof ParsedGuest, value: string): void {
	FIELD_SETTERS[key]?.(result, value);
}

function ensurePrefix(cc: string): string {
	return cc && !cc.startsWith('+') ? '+' + cc : cc;
}

export function parsePositional(parts: string[]): ParsedGuest {
	const result: ParsedGuest = {
		fullName: parts[0]?.trim() ?? '',
		phone: parts[1]?.trim() ?? '',
		phoneCountryCode: '',
		email: null,
	};

	if (parts.length >= 4) {
		result.phoneCountryCode = ensurePrefix(parts[2]?.trim() ?? '');
		result.email = parts[3]?.trim() || null;
	} else if (parts.length === 3) {
		const third = parts[2]?.trim() ?? '';
		if (third.startsWith('+') || /^\d{1,4}$/.test(third))
			result.phoneCountryCode = ensurePrefix(third);
		else result.email = third || null;
	} else {
		result.email = parts[2]?.trim() || null;
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

	result.phoneCountryCode = ensurePrefix(result.phoneCountryCode);
	return result;
}

export function validateGuestRow(guest: ParsedGuest): {
	rowError?: string;
	fieldErrors?: NonNullable<ParsedGuest['fieldErrors']>;
} {
	const fieldErrors: NonNullable<ParsedGuest['fieldErrors']> = {};
	const name = guest.fullName.trim();

	if (!name) {
		fieldErrors.fullName = 'El nombre es obligatorio.';
	}

	const result = normalizeImportPhone(guest.phone, guest.phoneCountryCode);
	if (!result.ok) {
		fieldErrors[result.field] = result.message;
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
	const validation = validateGuestRow(guest);
	return {
		...guest,
		error: validation.rowError,
		fieldErrors: validation.fieldErrors,
	};
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
		const phone = normalizePhoneForComparison(guest.phone, guest.countryCode);
		if (phone) byPhone.set(phone, guest);

		const name = normalizeName(guest.fullName ?? '');
		if (name) {
			const list = byName.get(name) ?? [];
			list.push(guest);
			byName.set(name, list);
		}
	}

	return { byPhone, byName };
}

function defaultActionForStatus(status: ImportRowStatus): ImportRowAction {
	if (status === 'new') return 'create';
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
			status === 'possible_duplicate' ||
			status === 'phone_conflict' ||
			status === 'ambiguous_name_match'
		);
	}
	return (
		Boolean(matchedGuestId) && (status === 'phone_conflict' || status === 'possible_duplicate')
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

function detectRowStatus(
	result: ParsedGuest,
	byPhone: Map<string, DashboardGuestItem>,
	byName: Map<string, DashboardGuestItem[]>,
	seenPhones: Set<string>,
	seenExactKeys: Set<string>,
	comparePhone: string | undefined,
	normalizedName: string | undefined,
	exactKey: string,
): { status: ImportRowStatus; matchedGuest: DashboardGuestItem | undefined } {
	if (
		(comparePhone && seenPhones.has(comparePhone)) ||
		(normalizedName && seenExactKeys.has(exactKey))
	) {
		result.requiresReview = true;
		return { status: 'internal_duplicate', matchedGuest: undefined };
	}

	const matchedGuest = comparePhone ? byPhone.get(comparePhone) : undefined;
	const nameMatches = normalizedName ? (byName.get(normalizedName) ?? []) : [];

	if (matchedGuest) {
		result.matchedGuestId = matchedGuest.guestId;
		result.matchedGuestName = matchedGuest.fullName;
		const matchedName = normalizeName(matchedGuest.fullName ?? '');
		const status: ImportRowStatus =
			matchedName === normalizedName ? 'exact_duplicate' : 'phone_conflict';
		result.hiddenByDefault = status === 'exact_duplicate';
		result.requiresReview = status === 'phone_conflict';
		return { status, matchedGuest };
	}

	if (nameMatches.length > 1) {
		result.requiresReview = true;
		return { status: 'ambiguous_name_match', matchedGuest: undefined };
	}

	if (nameMatches.length === 1) {
		const candidate = nameMatches[0];
		result.matchedGuestId = candidate.guestId;
		result.matchedGuestName = candidate.fullName;
		const existingPhone = normalizePhoneForComparison(candidate.phone, candidate.countryCode);
		if (!existingPhone && !comparePhone) {
			result.hiddenByDefault = true;
			return { status: 'probable_duplicate', matchedGuest: candidate };
		}
		result.hiddenByDefault = true;
		result.requiresReview = true;
		return { status: 'possible_duplicate', matchedGuest: candidate };
	}

	return { status: 'new', matchedGuest: undefined };
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
		const normalizedName = normalizeName(result.fullName ?? '');
		const comparePhone = normalizePhoneForComparison(result.phone, result.phoneCountryCode);
		const exactKey = `${normalizedName}|${comparePhone}`;

		result.normalizedName = normalizedName;
		result.requiresReview = false;
		result.hiddenByDefault = false;
		result.matchedGuestId = undefined;
		result.matchedGuestName = undefined;

		const { status } = detectRowStatus(
			result,
			byPhone,
			byName,
			seenPhones,
			seenExactKeys,
			comparePhone,
			normalizedName,
			exactKey,
		);

		const finalStatus = result.error && status === 'new' ? 'invalid' : status;

		if (comparePhone) seenPhones.add(comparePhone);
		if (normalizedName) seenExactKeys.add(exactKey);

		result._status = finalStatus;
		result.action = applyActionPreference(result, finalStatus, result.matchedGuestId);
		if (finalStatus === 'invalid') {
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

type DisplayCategory = 'create' | 'update' | 'review' | 'omitted' | 'error';

export interface DisplayCategories {
	total: number;
	create: number;
	update: number;
	review: number;
	omitted: number;
	error: number;
	actionable: number;
	hiddenReview: number;
}

function getDisplayCategory(row: ParsedGuest): DisplayCategory {
	if (row.error || row._status === 'invalid') return 'error';
	if (row.action === 'create') return 'create';
	if (row.action === 'update' && row.matchedGuestId) return 'update';
	if (row.requiresReview) return 'review';
	return 'omitted';
}

export function computeDisplayCategories(guests: ParsedGuest[]): DisplayCategories {
	let create = 0;
	let update = 0;
	let review = 0;
	let omitted = 0;
	let error = 0;
	let hiddenReview = 0;

	for (const row of guests) {
		const cat = getDisplayCategory(row);
		if (cat === 'create') create++;
		else if (cat === 'update') update++;
		else if (cat === 'review') {
			review++;
			if (row.hiddenByDefault) hiddenReview++;
		} else if (cat === 'omitted') {
			omitted++;
		} else if (cat === 'error') error++;
	}

	return {
		total: guests.length,
		create,
		update,
		review,
		omitted,
		error,
		actionable: create + update,
		hiddenReview,
	};
}
