export const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number];

export interface CountdownPresentationOptions {
	/** Subset of countdown units to render. Absent/undefined → all four units. */
	visibleUnits?: CountdownUnit[];
}

const COUNTDOWN_UNIT_SET = new Set<string>(COUNTDOWN_UNITS);

/**
 * Resolve countdown visible units. Absent options → all units.
 * Unknown units are dropped. An empty/invalid selection falls back to all units
 * so the section never renders with zero segments at runtime; schemas reject
 * empty arrays at the content boundary.
 */
export function resolveCountdownVisibleUnits(
	options: CountdownPresentationOptions | undefined,
): CountdownUnit[] {
	const requested = options?.visibleUnits;
	if (!requested || requested.length === 0) {
		return [...COUNTDOWN_UNITS];
	}
	const unique = [
		...new Set(requested.filter((unit): unit is CountdownUnit => COUNTDOWN_UNIT_SET.has(unit))),
	];
	return unique.length > 0 ? unique : [...COUNTDOWN_UNITS];
}
