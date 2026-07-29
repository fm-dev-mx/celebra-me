import { createHash } from 'node:crypto';
import { getEditorSectionForPublishedPath } from '@/lib/intake/invitation-section-registry';
import { canonicalizePublicationValue } from '@/lib/intake/services/publication-canonicalize';

export { canonicalizePublicationValue } from '@/lib/intake/services/publication-canonicalize';

/**
 * Generates a 32-character MD5 hex digest for publication optimistic concurrency control.
 *
 * ACCEPTED RISK / NON-AUTHENTICATION FINGERPRINT:
 * MD5 is used exclusively to produce a lightweight projection digest for optimistic
 * locking during atomic publication. The PostgreSQL migration RPC `publish_invitation_atomic`
 * recomputes the exact same MD5 digest inside PostgreSQL (`md5(...)`) while holding
 * `FOR UPDATE` row locks. Concurrency safety is guaranteed by PostgreSQL database locks
 * and transactions, not cryptographic collision resistance. Node and PostgreSQL MUST produce
 * identical fingerprints to maintain publication compatibility.
 */
// codeql[js/weak-cryptographic-algorithm]
function optimisticLockHash(content: string): string {
	return createHash('md5').update(content).digest('hex');
}

export interface PublicationChange {
	path: string;
	sectionId: string;
	sectionLabel: string;
}

export interface PublicationComparison {
	canonicalDraftProjection: Record<string, unknown>;
	canonicalPublishedProjection: Record<string, unknown>;
	changedPaths: string[];
	changedSections: PublicationChange[];
	projectionHash: string;
}

export function hashPublicationProjection(projection: Record<string, unknown>): string {
	const canonical =
		(canonicalizePublicationValue(projection) as Record<string, unknown> | undefined) ?? {};
	return optimisticLockHash(JSON.stringify(canonical));
}

/** Fingerprint of the persisted jsonb document, without publication normalization. */
export function hashPublishedContentFingerprint(
	content: Record<string, unknown> | undefined,
): string {
	return optimisticLockHash(toPostgresJsonbText(content ?? {}));
}

/** Stable optimistic-lock token for the invitation fields that affect public output. */
/**
 * Every mutable invitation value consumed by public resolution. Contact and
 * operational fields are deliberately excluded: they cannot alter the page.
 * The text format mirrors PostgreSQL jsonb::text so the RPC can compare the
 * reviewed baseline while holding the invitation lock.
 */
export function hashPublicMetadata(
	input: {
		slug: string | null;
		title: string;
		eventType: string;
		baseDemoId: string;
		themeId: string;
		kind: string;
		snapshot: unknown;
		status: string;
		archivedAt: string | null;
	},
	publishedContent?: Record<string, unknown>,
): string {
	// This baseline must reflect the stored jsonb exactly. Publication-content
	// normalization is intentionally not used here: even an empty snapshot field
	// may affect a downstream resolver.
	const snapshot = input.snapshot ?? {};
	const projection = {
		archivedAt: input.archivedAt,
		baseDemoId: input.baseDemoId,
		eventType: input.eventType,
		kind: input.kind,
		slug: input.slug,
		snapshot,
		status: input.status,
		themeId: input.themeId,
		title: input.title,
	};
	const metadataHash = optimisticLockHash(toPostgresJsonbText(projection));
	return optimisticLockHash(
		`${metadataHash}\u001f${hashPublishedContentFingerprint(publishedContent)}`,
	);
}

function toPostgresJsonbText(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(toPostgresJsonbText).join(', ')}]`;
	if (isPlainObject(value)) {
		return `{${Object.keys(value)
			// PostgreSQL jsonb orders object keys by byte length then bytewise value.
			.sort(
				(left, right) =>
					left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
			)
			.map((key) => `${JSON.stringify(key)}: ${toPostgresJsonbText(value[key])}`)
			.join(', ')}}`;
	}
	return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function collectChangedPaths(left: unknown, right: unknown, path = ''): string[] {
	if (valuesEqual(left, right)) return [];
	// `content` is a contract container, not an editor section. Descend once when an
	// entire optional section was removed so confirmation can name that section.
	if (
		path === 'content' &&
		((left === undefined && isPlainObject(right)) ||
			(right === undefined && isPlainObject(left)))
	) {
		const source = (left ?? right) as Record<string, unknown>;
		return Object.keys(source)
			.sort()
			.map((key) => `${path}.${key}`);
	}
	if (
		Array.isArray(left) ||
		Array.isArray(right) ||
		!isPlainObject(left) ||
		!isPlainObject(right)
	) {
		return [path];
	}

	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	return Array.from(keys)
		.sort()
		.flatMap((key) =>
			collectChangedPaths(left[key], right[key], path ? `${path}.${key}` : key),
		);
}

export function createPublicationComparison(input: {
	draftProjection: Record<string, unknown>;
	publishedProjection?: Record<string, unknown>;
}): PublicationComparison {
	const canonicalDraftProjection =
		(canonicalizePublicationValue(input.draftProjection) as
			| Record<string, unknown>
			| undefined) ?? {};
	const canonicalPublishedProjection =
		(canonicalizePublicationValue(input.publishedProjection ?? {}) as
			| Record<string, unknown>
			| undefined) ?? {};
	const changedPaths = collectChangedPaths(
		canonicalDraftProjection,
		canonicalPublishedProjection,
	);
	const seenSections = new Set<string>();
	const changedSections = changedPaths.flatMap((path) => {
		const section = getEditorSectionForPublishedPath(path);
		if (!section || seenSections.has(section.id)) return [];
		seenSections.add(section.id);
		return [{ path, sectionId: section.id, sectionLabel: section.label }];
	});
	const projectionHash = hashPublicationProjection(canonicalDraftProjection);

	return {
		canonicalDraftProjection,
		canonicalPublishedProjection,
		changedPaths,
		changedSections,
		projectionHash,
	};
}
