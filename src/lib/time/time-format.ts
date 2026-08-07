function str(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;
	return undefined;
}

const TIME_24H_REGEX = /^(\d{2}):(\d{2})(?::\d{2})?$/;
/** Accepts `6:00 PM`, `6:00 pm`, and Spanish display forms `6:00 p. m.` / `6:00 a.m.`. */
const TIME_12H_REGEX = /^(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)$/i;

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
		const periodToken = h12Match[3].replace(/[.\s]/g, '').toUpperCase();
		const period = periodToken.startsWith('P') ? 'PM' : 'AM';

		if (hours < 1 || hours > 12) return null;
		if (minutes < 0 || minutes > 59) return null;

		if (period === 'PM') {
			if (hours !== 12) hours += 12;
		} else if (hours === 12) {
			hours = 0;
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

/** Spanish display form used by many published invitations (`5:30 p. m.`). */
export function formatTimeSpanish(value: string): string {
	const parsed = parseTime(value);
	if (!parsed) return value;

	const { hours, minutes } = parsed;
	const period = hours >= 12 ? 'p. m.' : 'a. m.';
	const displayHours = hours % 12 === 0 ? 12 : hours % 12;
	const displayMinutes = minutes.toString().padStart(2, '0');

	return `${displayHours}:${displayMinutes} ${period}`;
}

/** True when both values resolve to the same HH:mm instant. */
export function timesSemanticallyEqual(left: unknown, right: unknown): boolean {
	const a = normalizeTime(left);
	const b = normalizeTime(right);
	return a !== undefined && a === b;
}
