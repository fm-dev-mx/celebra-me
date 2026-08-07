export function str(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;
	return undefined;
}

export function strFallback(value: unknown): string {
	if (typeof value === 'string') return value;
	return '';
}

export function bool(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	return undefined;
}

export function boolFallback(value: unknown): boolean {
	return typeof value === 'boolean' ? value : false;
}

export function num(value: unknown): number | undefined {
	if (typeof value === 'number') return value;
	return undefined;
}

export function numFallback(value: unknown): number {
	return typeof value === 'number' ? value : 0;
}

export function moveArrayItem<T>(items: T[], fromIndex: number, offset: -1 | 1): T[] {
	const destination = fromIndex + offset;
	if (destination < 0 || destination >= items.length) return items;
	const next = [...items];
	[next[fromIndex], next[destination]] = [next[destination], next[fromIndex]];
	return next;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_NO_SEC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ISO_DATETIME_FULL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
/** `14 de agosto de 2026` or `sábado, 14 de agosto de 2026`. */
const SPANISH_LONG_DATE = /(?:^|,\s*)(\d{1,2})\s+de\s+([a-záéíóúüñ]+)\s+de\s+(\d{4})\s*$/i;

const SPANISH_MONTHS: Record<string, number> = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	setiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
};

function pad2(value: number): string {
	return value.toString().padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const dt = new Date(Date.UTC(year, month - 1, day));
	return (
		dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
	);
}

export function normalizeDate(value: unknown): string {
	const raw = strFallback(value);
	if (ISO_DATE.test(raw)) return `${raw}T00:00:00.000Z`;
	if (ISO_DATETIME_NO_SEC.test(raw)) return `${raw}:00.000Z`;
	if (ISO_DATETIME_FULL.test(raw)) return raw;
	return raw;
}

/**
 * Editor-consumable calendar day for `<input type="date">` (`YYYY-MM-DD`).
 * Accepts ISO date/datetime and Spanish long prose used in published venues.
 */
export function toEditorDate(value: unknown): string | undefined {
	const raw = trimmedStr(value);
	if (!raw) return undefined;

	if (ISO_DATE.test(raw)) return raw;

	const isoPrefix = raw.match(ISO_DATE_PREFIX);
	if (
		isoPrefix &&
		(ISO_DATETIME_NO_SEC.test(raw) || ISO_DATETIME_FULL.test(raw) || raw.includes('T'))
	) {
		return isoPrefix[1];
	}

	const spanish = raw.match(SPANISH_LONG_DATE);
	if (spanish) {
		const day = parseInt(spanish[1], 10);
		const month = SPANISH_MONTHS[spanish[2].toLowerCase()];
		const year = parseInt(spanish[3], 10);
		if (month && isValidCalendarDate(year, month, day)) {
			return `${year}-${pad2(month)}-${pad2(day)}`;
		}
	}

	return undefined;
}

/** True when both values resolve to the same calendar day. */
export function datesSemanticallyEqual(left: unknown, right: unknown): boolean {
	const a = toEditorDate(left);
	const b = toEditorDate(right);
	return a !== undefined && a === b;
}

export function trimmedStr(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) return value.trim();
	return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && Object.keys(value).length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		value.constructor === Object
	);
}

export function mergeOverlay(
	base: Record<string, unknown>,
	overlay: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const key of Object.keys(overlay)) {
		const baseVal = result[key];
		const overlayVal = overlay[key];
		if (isPlainObject(baseVal) && isPlainObject(overlayVal)) {
			result[key] = mergeOverlay(baseVal, overlayVal);
		} else {
			result[key] = overlayVal;
		}
	}
	return result;
}
