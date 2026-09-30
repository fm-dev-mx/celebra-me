export interface NameSplit {
	lead: string;
	rest: string;
}

/**
 * Splits a display name into its leading words and the remainder so a variant can set them as
 * two typographic lines. Returns undefined when no split is requested or when the lead would
 * consume every word, so callers render the name unchanged.
 */
export function splitLeadWords(name?: string | null, leadWords?: number): NameSplit | undefined {
	if (!name || typeof name !== 'string' || !leadWords || leadWords < 1) return undefined;
	const trimmed = name.trim();
	if (!trimmed) return undefined;
	const words = trimmed.split(/\s+/);
	if (leadWords >= words.length) return undefined;
	return {
		lead: words.slice(0, leadWords).join(' '),
		rest: words.slice(leadWords).join(' '),
	};
}
