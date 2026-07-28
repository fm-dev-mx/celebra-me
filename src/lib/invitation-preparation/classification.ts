/**
 * Canonical information classifications for invitation preparation.
 * Client statements, agent inference, and owner decisions must remain distinguishable.
 */

export const INFO_CLASSIFICATIONS = [
	'verified',
	'inferred',
	'ambiguous',
	'missing',
	'not_applicable',
	'requires_owner_decision',
] as const;

export type InfoClassification = (typeof INFO_CLASSIFICATIONS)[number];

export function isInfoClassification(value: string): value is InfoClassification {
	return (INFO_CLASSIFICATIONS as readonly string[]).includes(value);
}

/** Classifications that count as a resolved value for completeness checks. */
export const RESOLVED_CLASSIFICATIONS: readonly InfoClassification[] = [
	'verified',
	'inferred',
	'not_applicable',
] as const;

export function isResolvedClassification(value: InfoClassification): boolean {
	return (RESOLVED_CLASSIFICATIONS as readonly InfoClassification[]).includes(value);
}

/**
 * `verified` requires explicit client/source evidence.
 * `inferred` must never be presented as a client statement.
 */
export function assertClassificationRules(input: {
	classification: InfoClassification;
	hasSourceEvidence: boolean;
	representedAsClientStatement: boolean;
}): { ok: true } | { ok: false; reason: string } {
	const { classification, hasSourceEvidence, representedAsClientStatement } = input;
	if (classification === 'verified' && !hasSourceEvidence) {
		return {
			ok: false,
			reason: 'verified requires explicit supporting client or source evidence',
		};
	}
	if (classification === 'inferred' && representedAsClientStatement) {
		return {
			ok: false,
			reason: 'inferred must never be represented as a client statement',
		};
	}
	return { ok: true };
}
