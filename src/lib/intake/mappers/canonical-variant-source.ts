/** The published content would miss a structural value the invitation never defined. */
export class PublishedContentContractError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PublishedContentContractError';
	}
}

export function requireCanonicalVariant(path: string, ...candidates: unknown[]): string {
	const variant = candidates
		.map((candidate) => (typeof candidate === 'string' ? candidate.trim() : undefined))
		.find((candidate): candidate is string => Boolean(candidate));
	if (!variant) {
		throw new PublishedContentContractError(
			`Published content requires an explicit ${path}.variant.`,
		);
	}
	return variant;
}
