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

export function normalizeDate(value: unknown): string {
	const raw = strFallback(value);
	if (ISO_DATE.test(raw)) return `${raw}T00:00:00.000Z`;
	if (ISO_DATETIME_NO_SEC.test(raw)) return `${raw}:00.000Z`;
	if (ISO_DATETIME_FULL.test(raw)) return raw;
	return raw;
}

export function trimmedStr(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) return value.trim();
	return undefined;
}

export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length > 0
	);
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
