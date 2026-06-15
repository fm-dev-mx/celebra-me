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

export function hasRsvpContent(content: Record<string, unknown> | undefined): boolean {
	if (!content) return false;
	const rsvp = content.rsvp as Record<string, unknown> | undefined;
	return Boolean(rsvp?.title || rsvp?.guestCap);
}

export function normalizeDate(value: unknown): string {
	const raw = strFallback(value);
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00.000Z`;
	return raw;
}

const TIME_24H_REGEX = /^(\d{2}):(\d{2})$/;
const TIME_12H_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

export function parseTime(value: unknown): { hours: number; minutes: number } | null {
	const raw = str(value);
	if (!raw) return null;

	const h24Match = raw.match(TIME_24H_REGEX);
	if (h24Match) {
		const hours = parseInt(h24Match[1], 10);
		const minutes = parseInt(h24Match[2], 10);
		if (hours < 0 || hours > 23) return null;
		if (minutes < 0 || minutes > 59) return null;
		return { hours, minutes };
	}

	const h12Match = raw.match(TIME_12H_REGEX);
	if (h12Match) {
		let hours = parseInt(h12Match[1], 10);
		const minutes = parseInt(h12Match[2], 10);
		const period = h12Match[3].toUpperCase() as 'AM' | 'PM';

		if (hours < 1 || hours > 12) return null;
		if (minutes < 0 || minutes > 59) return null;

		if (period === 'PM') {
			if (hours === 12) hours = 12;
			else hours += 12;
		} else {
			if (hours === 12) hours = 0;
		}

		return { hours, minutes };
	}

	return null;
}

export function normalizeTime(value: unknown): string | undefined {
	const parsed = parseTime(value);
	if (!parsed) return undefined;
	const { hours, minutes } = parsed;
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function isValidTime(value: unknown): boolean {
	return parseTime(value) !== null;
}

export function formatTime12h(value: string): string {
	const parsed = parseTime(value);
	if (!parsed) return value;

	const { hours, minutes } = parsed;
	const period = hours >= 12 ? 'PM' : 'AM';
	const displayHours = hours % 12 === 0 ? 12 : hours % 12;
	const displayMinutes = minutes.toString().padStart(2, '0');

	return `${displayHours}:${displayMinutes} ${period}`;
}

/** Shared venue label resolver — centralizes the type→label mapping used in 4 places. */
/** Guard: returns the string trimmed, or undefined if not a non-blank string. Shared by both draft ↔ published mappers. */
export function trimmedStr(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) return value.trim();
	return undefined;
}

export function venueLabel(type: string, label?: string): string {
	return label || (type === 'ceremony' ? 'Ceremonia' : type === 'reception' ? 'Recepción' : '');
}

export function mergeOverlay(
	base: Record<string, unknown>,
	overlay: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const key of Object.keys(overlay)) {
		const baseVal = result[key];
		const overlayVal = overlay[key];
		if (
			baseVal !== null &&
			overlayVal !== null &&
			typeof baseVal === 'object' &&
			typeof overlayVal === 'object' &&
			!Array.isArray(baseVal) &&
			!Array.isArray(overlayVal)
		) {
			result[key] = mergeOverlay(
				baseVal as Record<string, unknown>,
				overlayVal as Record<string, unknown>,
			);
		} else {
			result[key] = overlayVal;
		}
	}
	return result;
}
