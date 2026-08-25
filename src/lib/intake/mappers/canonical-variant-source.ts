export type CanonicalVariantContext = Readonly<{
	isDemo: boolean;
	priorPublishedContent?: Record<string, unknown>;
}>;

export function requireCanonicalVariant(path: string, ...candidates: unknown[]): string {
	const variant = candidates
		.map((candidate) => (typeof candidate === 'string' ? candidate.trim() : undefined))
		.find((candidate): candidate is string => Boolean(candidate));
	if (!variant) throw new Error(`Published content requires an explicit ${path}.variant.`);
	return variant;
}

export function resolveCanonicalVariantSource(
	ctx: CanonicalVariantContext,
	priorVariant: unknown,
	demoVariant: unknown,
): unknown {
	return ctx.isDemo || ctx.priorPublishedContent === undefined ? demoVariant : priorVariant;
}
