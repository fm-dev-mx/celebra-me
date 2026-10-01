/**
 * Playwright's default 0.2 threshold on normalized YIQ color distance (pixelmatch semantics),
 * shared by capture stabilization and review triage so both agree on "visibly changed".
 */
const MAXIMUM_YIQ_DISTANCE = 35215 * 0.2 ** 2;

export function isVisiblePixelChange(
	before: Uint8Array,
	beforeOffset: number,
	after: Uint8Array,
	afterOffset: number,
): boolean {
	if (before[beforeOffset + 3] !== after[afterOffset + 3]) return true;
	const r = before[beforeOffset] - after[afterOffset];
	const g = before[beforeOffset + 1] - after[afterOffset + 1];
	const b = before[beforeOffset + 2] - after[afterOffset + 2];
	if (r === 0 && g === 0 && b === 0) return false;
	const y = r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
	const i = r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
	const q = r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
	return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q > MAXIMUM_YIQ_DISTANCE;
}

/** Compares two equally sized RGBA buffers; any above-threshold pixel is a visible change. */
export function hasVisiblePixelChange(before: Uint8Array, after: Uint8Array): boolean {
	for (let offset = 0; offset < before.length; offset += 4) {
		if (isVisiblePixelChange(before, offset, after, offset)) return true;
	}
	return false;
}
