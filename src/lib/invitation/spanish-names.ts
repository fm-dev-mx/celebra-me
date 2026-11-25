const STARTS_WITH_I_SOUND = /^(?:[ií]|h[ií](?![aeoáéó]))/iu;

/** Joins two names with the Spanish conjunction: "y" becomes "e" before an /i/ sound. */
export function joinSpanishNames(first: string, second: string): string {
	const conjunction = STARTS_WITH_I_SOUND.test(second.trim()) ? 'e' : 'y';
	return `${first} ${conjunction} ${second}`;
}
