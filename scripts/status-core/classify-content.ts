/**
 * Pure package-hash CONTENT classification for managed invitations.
 * Deterministic for equivalent evidence. No I/O.
 */

export type ContentStatusVocabulary =
	| 'MATCH_CANONICAL'
	| 'BEHIND_CANONICAL'
	| 'DIVERGED'
	| 'IDENTITY_CONFLICT'
	| 'NOT_PRESENT'
	| 'UNREACHABLE'
	| 'CREDENTIALS_REQUIRED'
	| 'UNVERIFIED';

export interface PackageHashContentInput {
	activeMatchCount: number;
	resolvedId: string | null;
	provenancePackageHash: string | null;
	canonicalHash: string | null;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedAt: string | null;
}

export interface PackageHashContentResult {
	status: ContentStatusVocabulary;
	detail: string;
	isDiverged: boolean;
}

export function classifyPackageHashContent(
	input: PackageHashContentInput,
): PackageHashContentResult {
	if (input.activeMatchCount === 0) {
		return {
			status: 'NOT_PRESENT',
			detail: 'Invitation not present in target DB',
			isDiverged: false,
		};
	}
	if (input.activeMatchCount > 1) {
		return {
			status: 'IDENTITY_CONFLICT',
			detail: `IDENTITY_CONFLICT: ${input.activeMatchCount} active invitations found`,
			isDiverged: false,
		};
	}

	const isDiverged = Boolean(
		input.draftStatus === 'draft' &&
			input.draftUpdatedAt &&
			input.publishedAt &&
			new Date(input.draftUpdatedAt).getTime() > new Date(input.publishedAt).getTime(),
	);

	let status: ContentStatusVocabulary = 'UNVERIFIED';
	let detail = `Active invitation resolved`;

	if (input.provenancePackageHash && input.canonicalHash) {
		if (input.provenancePackageHash !== input.canonicalHash) {
			status = 'BEHIND_CANONICAL';
		} else if (isDiverged) {
			status = 'DIVERGED';
		} else {
			status = 'MATCH_CANONICAL';
		}
	} else if (input.provenancePackageHash && isDiverged) {
		status = 'DIVERGED';
	} else if (!input.canonicalHash) {
		detail = `Active invitation resolved; canonical package hash unavailable — not a proven MATCH`;
	} else if (!input.provenancePackageHash) {
		detail = `Active invitation resolved; managed provenance package hash missing — not a proven MATCH`;
	}

	return { status, detail, isDiverged };
}
