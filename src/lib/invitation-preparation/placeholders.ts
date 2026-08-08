/**
 * Controlled placeholder tokens for non-blocking missing preparation data.
 * Tokens must remain grep-able and never masquerade as verified client content.
 */

/** Matches [[PENDIENTE:FIELD_ID]] tokens. */
export const PLACEHOLDER_TOKEN_PATTERN = /\[\[PENDIENTE:([A-Z0-9_]+)\]\]/g;

export function toPlaceholderFieldKey(fieldId: string): string {
	return fieldId
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toUpperCase();
}

export function createPlaceholderToken(fieldId: string): string {
	const key = toPlaceholderFieldKey(fieldId);
	if (!key) {
		throw new Error('Placeholder field id must not be empty');
	}
	return `[[PENDIENTE:${key}]]`;
}

export function isPlaceholderToken(value: string): boolean {
	const trimmed = value.trim();
	const re = new RegExp(`^${PLACEHOLDER_TOKEN_PATTERN.source}$`, 'u');
	return re.test(trimmed);
}

export function findPlaceholderTokens(text: string): string[] {
	const found = new Set<string>();
	const re = new RegExp(PLACEHOLDER_TOKEN_PATTERN.source, 'g');
	for (const match of text.matchAll(re)) {
		found.add(match[0]);
	}
	return [...found].sort();
}

/**
 * Find controlled placeholder tokens anywhere in a serializable invitation value.
 * Draft and implementation stages may retain these tokens; release boundaries use
 * this helper to inspect the final published projection without enumerating fields.
 */
export function findPlaceholderTokensInValue(value: unknown): string[] {
	if (value === undefined) return [];
	const serialized = JSON.stringify(value);
	return serialized ? findPlaceholderTokens(serialized) : [];
}

export interface PlaceholderRecord {
	token: string;
	fieldId: string;
	reason: string;
	/** Blocking placeholders force NOT_READY. */
	blocking: boolean;
	replacementRequirement: string;
}

export function validatePlaceholderRecords(
	records: readonly PlaceholderRecord[],
): { ok: true } | { ok: false; reasons: string[] } {
	const reasons: string[] = [];
	const tokens = new Set<string>();
	for (const record of records) {
		if (!isPlaceholderToken(record.token)) {
			reasons.push(`Invalid placeholder token: ${record.token}`);
		}
		const fieldKey = toPlaceholderFieldKey(record.fieldId);
		if (!fieldKey) {
			reasons.push(`Placeholder fieldId must not be empty (token ${record.token})`);
		} else {
			const expected = createPlaceholderToken(record.fieldId);
			if (record.token !== expected) {
				reasons.push(
					`Token ${record.token} does not match fieldId ${record.fieldId} (expected ${expected})`,
				);
			}
		}
		if (!record.reason.trim()) {
			reasons.push(`Placeholder ${record.token} is missing a reason`);
		}
		if (!record.replacementRequirement.trim()) {
			reasons.push(`Placeholder ${record.token} is missing a replacement requirement`);
		}
		if (tokens.has(record.token)) {
			reasons.push(`Duplicate placeholder token: ${record.token}`);
		}
		tokens.add(record.token);
	}
	return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
