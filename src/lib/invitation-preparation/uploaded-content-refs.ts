/** Collect `{ type: 'uploaded', assetId }` refs with the same path strings publish uses. */

export interface UploadedContentRef {
	path: string;
	assetId: string;
}

/**
 * Walk published or draft content and record every uploaded asset reference.
 * Path format matches the publication validator (`hero.backgroundImageMobile`,
 * `gallery.items[0].image`, `interludes[1].image`).
 */
export function collectUploadedContentRefs(content: unknown): UploadedContentRef[] {
	const refs: UploadedContentRef[] = [];

	const walk = (value: unknown, path: string): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach((child, index) => walk(child, `${path}[${index}]`));
			return;
		}
		const obj = value as Record<string, unknown>;
		if (obj.type === 'uploaded' && typeof obj.assetId === 'string') {
			refs.push({ path, assetId: obj.assetId });
			return;
		}
		for (const [key, child] of Object.entries(obj)) {
			walk(child, path ? `${path}.${key}` : key);
		}
	};

	walk(content, '');
	return refs;
}

export function collectUploadedAssetIds(content?: unknown): Set<string> {
	return new Set(collectUploadedContentRefs(content).map((ref) => ref.assetId));
}
