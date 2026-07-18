import { createHash } from 'node:crypto';
import { getEditorSectionForPublishedPath } from '@/lib/intake/invitation-section-registry';

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
	return createHash('md5').update(JSON.stringify(canonical)).digest('hex');
}

/** Fingerprint of the persisted jsonb document, without publication normalization. */
export function hashPublishedContentFingerprint(
	content: Record<string, unknown> | undefined,
): string {
	return createHash('md5')
		.update(toPostgresJsonbText(content ?? {}))
		.digest('hex');
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
	const metadataHash = createHash('md5').update(toPostgresJsonbText(projection)).digest('hex');
	return createHash('md5')
		.update(`${metadataHash}\u001f${hashPublishedContentFingerprint(publishedContent)}`)
		.digest('hex');
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

/** Normalizes values that are equivalent in the published contract. */
export function canonicalizePublicationValue(value: unknown): unknown {
	if (value === null || value === undefined || value === '') return undefined;
	if (typeof value === 'string') return value.trim() || undefined;
	if (Array.isArray(value)) {
		return value.map(canonicalizePublicationValue).filter((item) => item !== undefined);
	}
	if (!isPlainObject(value)) return value;

	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort()) {
		// Internal editor notes are never part of the public published contract.
		if (key === 'photoNotes') continue;
		// Uploaded URLs are derived when a snapshot is frozen and do not change its meaning.
		if (key === 'src' && value.type === 'uploaded') continue;
		const normalized = canonicalizePublicationValue(value[key]);
		if (normalized !== undefined) result[key] = normalized;
	}
	return Object.keys(result).length > 0 ? result : undefined;
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
