import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
} from '@/lib/assets/asset-registry';
import type { EditableAssetSource } from '@/lib/assets/asset-source';

export function resolveSrc(source: { src: string | { src: string } }): string {
	return typeof source.src === 'string' ? source.src : source.src.src;
}

export function resolveFrozenSrc(value: Record<string, unknown>): string | undefined {
	return 'src' in value && typeof value.src === 'string' ? value.src : undefined;
}

export function resolveAssetSrc(
	value: string | EditableAssetSource | undefined | null,
	previewSlug?: string,
	assets?: { id: string; src: string }[],
): string | undefined {
	if (!value) return undefined;
	if (typeof value === 'string') {
		if (value.startsWith('/') || value.startsWith('https://')) return value;
		if (isEventAssetKey(value)) return getEventAsset(previewSlug ?? '', value)?.src;
		if (isCommonAssetKey(value)) return resolveSrc(getCommonAsset(value));
		return undefined;
	}
	if (value.type === 'external') return value.src;
	if (value.type === 'uploaded') {
		return (
			assets?.find((a) => a.id === value.assetId)?.src ??
			resolveFrozenSrc(value as unknown as Record<string, unknown>)
		);
	}
	if (isEventAssetKey(value.key))
		return previewSlug ? getEventAsset(previewSlug, value.key)?.src : undefined;
	return resolveSrc(getCommonAsset(value.key));
}
