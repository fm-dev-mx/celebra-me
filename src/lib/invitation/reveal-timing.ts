const CARD_RISE_FALLBACK_MARGIN_MS = 1200;
export const CARD_RISE_FALLBACK_FLOOR_MS = 4000;

/** Longest time in a comma-separated CSS time list (`1.2s, 300ms`), in milliseconds. */
const readLongestMs = (value: string) =>
	value.split(',').reduce((longest, part) => {
		const trimmed = part.trim();
		const parsed = Number.parseFloat(trimmed);
		if (!Number.isFinite(parsed)) return longest;
		return Math.max(longest, trimmed.endsWith('ms') ? parsed : parsed * 1000);
	}, 0);

/**
 * Longest plausible `envCardRise` runtime for the active theme, read from computed style so
 * preset overrides of `--duration-reveal` stay covered. Used as the safety deadline: if
 * `animationend` never arrives (missing stylesheet, interrupted or throttled animation,
 * non-animatable card), the reveal must still complete instead of stranding `sealed`.
 */
export const resolveCardRiseFallbackMs = (card: HTMLElement) => {
	const styles = getComputedStyle(card);
	const animated = readLongestMs(styles.animationDelay) + readLongestMs(styles.animationDuration);

	return Math.max(CARD_RISE_FALLBACK_FLOOR_MS, animated + CARD_RISE_FALLBACK_MARGIN_MS);
};

/**
 * Reading pause on the risen letter before the invitation takes over. Themes opt in through
 * `--env-letter-hold` (unset → 0, the letter hands over as soon as it lands).
 */
export const resolveLetterHoldMs = (host: HTMLElement) =>
	readLongestMs(getComputedStyle(host).getPropertyValue('--env-letter-hold'));
