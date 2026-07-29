/**
 * Resolve the three-way merge common ancestor for managed invitation applies.
 * Prefer the last successfully applied managed projection when it is still fresh
 * relative to the target publication; otherwise fall back to published content.
 */

export function resolvePublicationTimestamp(
	published:
		| { published_at?: unknown; updated_at?: unknown }
		| null
		| undefined,
): string | null {
	if (typeof published?.published_at === 'string') return published.published_at;
	if (typeof published?.updated_at === 'string') return published.updated_at;
	return null;
}

export function resolveManagedMergeBaseline(input: {
	managedProjection?: Record<string, unknown> | null;
	managedAppliedAt?: string | null;
	publishedContent?: Record<string, unknown> | null;
	publishedAt?: string | null;
	draftContent: Record<string, unknown>;
}): Record<string, unknown> {
	const managed = input.managedProjection;
	if (managed) {
		const managedAt = input.managedAppliedAt ? Date.parse(input.managedAppliedAt) : NaN;
		const publishedAt = input.publishedAt ? Date.parse(input.publishedAt) : NaN;
		const managedIsStale =
			Number.isFinite(managedAt) && Number.isFinite(publishedAt) && publishedAt > managedAt;
		if (!managedIsStale) return managed;
	}

	return input.publishedContent ?? input.draftContent;
}
