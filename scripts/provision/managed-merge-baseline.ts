/**
 * Resolve the three-way merge common ancestor for managed invitation applies.
 * Prefer the last successfully applied managed projection when present.
 */

export function resolveManagedMergeBaseline(input: {
	managedProjection?: Record<string, unknown> | null;
	publishedContent?: Record<string, unknown> | null;
	draftContent: Record<string, unknown>;
}): Record<string, unknown> {
	return input.managedProjection ?? input.publishedContent ?? input.draftContent;
}
