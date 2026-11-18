/**
 * Acceptance evidence: the reviewed-paths gate for `accept` and the record kept beside the
 * accepted manifest, so one commit carries the references, the matrix hash and what was reviewed.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CandidateReview } from './visual-candidate-review.ts';

export const ACCEPTANCE_EVIDENCE_FILE = 'acceptance-evidence.json';

/** Splits `--reviewed` into capture paths; an entry ending in `/` covers a whole directory. */
export function parseReviewedPaths(value: string | undefined): string[] {
	if (value === undefined) {
		throw new Error(
			'accept needs --reviewed=<paths>: the capture files you looked at in changes.html (comma-separated; a trailing "/" covers a directory; "none" when the review lists no changes).',
		);
	}
	const entries = value
		.split(',')
		.map((entry) => entry.trim().replaceAll('\\', '/'))
		.filter(Boolean);
	if (entries.length === 0)
		throw new Error('--reviewed is empty. Pass the reviewed paths or "none".');
	return entries.length === 1 && entries[0] === 'none' ? [] : entries;
}

function isReviewed(file: string, reviewed: readonly string[]): boolean {
	const normalized = file.replaceAll('\\', '/');
	return reviewed.some((entry) =>
		entry.endsWith('/') ? normalized.startsWith(entry) : normalized === entry,
	);
}

/** Fails when the candidate review has a changed, new or removed capture outside the reviewed list. */
export function assertReviewedCoversChanges(
	review: CandidateReview | null,
	reviewed: readonly string[],
): CandidateReview {
	if (!review) {
		throw new Error(
			'Candidate review.json is missing. Regenerate the candidate before accepting.',
		);
	}
	// A removed capture loses its accepted reference, so it needs review like a change.
	const changed = [...review.items.map((item) => item.file), ...(review.removed ?? [])];
	const outside = changed.filter((file) => !isReviewed(file, reviewed));
	if (outside.length > 0) {
		const shown = `${outside.slice(0, 10).join(', ')}${outside.length > 10 ? ', …' : ''}`;
		throw new Error(
			`Candidate has ${outside.length} changed, new or removed capture(s) outside --reviewed: ${shown}. Review them in changes.html and list them.`,
		);
	}
	const unknown = reviewed.filter((entry) => !changed.some((file) => isReviewed(file, [entry])));
	if (unknown.length > 0) {
		throw new Error(
			`--reviewed lists path(s) with no change in the candidate: ${unknown.join(', ')}.`,
		);
	}
	return review;
}

export function buildAcceptanceEvidence(options: {
	review: CandidateReview;
	reviewed: readonly string[];
	diffsRoot: string;
	matrixHash?: string;
	candidateManifestSha256: string;
	acceptedManifestSha256: string;
	referenceSha: string;
	acceptedAt: string;
}) {
	const diffSha256 = (file?: string): string | undefined => {
		const path = file ? join(options.diffsRoot, file) : undefined;
		return path && existsSync(path)
			? createHash('sha256').update(readFileSync(path)).digest('hex')
			: undefined;
	};
	return {
		referenceSha: options.referenceSha,
		acceptedAt: options.acceptedAt,
		matrixHash: options.matrixHash,
		candidateManifestSha256: options.candidateManifestSha256,
		acceptedManifestSha256: options.acceptedManifestSha256,
		reviewedPaths: options.reviewed,
		items: options.review.items.map((item) => ({
			file: item.file,
			status: item.status,
			sha256: item.sha256,
			previousSha256: item.previousSha256,
			differentPixels: item.differentPixels,
			pixelRatio: item.pixelRatio,
			heightDelta: item.heightDelta,
			diffSha256: diffSha256(item.diff),
		})),
		renderNoise: options.review.renderNoise.length,
		removed: options.review.removed,
	};
}
