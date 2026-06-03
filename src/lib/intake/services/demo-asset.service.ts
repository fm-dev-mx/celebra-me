import { isValidEvent, getEventAsset } from '@/lib/assets/asset-registry';
import { EVENT_KEYS } from '@/lib/assets/asset-keys';
import type { DemoAssetEntry } from '@/lib/intake/types';

const KEY_LABELS: Record<string, string> = {
	hero: 'Portada',
	portrait: 'Retrato',
	family: 'Familia',
	ceremony: 'Ceremonia',
	reception: 'Recepción',
	gallery01: 'Galería 1',
	gallery02: 'Galería 2',
	gallery03: 'Galería 3',
	gallery04: 'Galería 4',
	gallery05: 'Galería 5',
	gallery06: 'Galería 6',
	gallery07: 'Galería 7',
	gallery08: 'Galería 8',
	gallery09: 'Galería 9',
	gallery10: 'Galería 10',
	gallery11: 'Galería 11',
	gallery12: 'Galería 12',
	gallery13: 'Galería 13',
	gallery14: 'Galería 14',
	gallery15: 'Galería 15',
	interlude01: 'Interludio 1',
	interlude02: 'Interludio 2',
	interlude03: 'Interludio 3',
	interlude04: 'Interludio 4',
	thankYouPortrait: 'Retrato de agradecimiento',
};

export function getDemoPresetAssets(previewSlug: string): DemoAssetEntry[] {
	if (!isValidEvent(previewSlug)) return [];

	const results: DemoAssetEntry[] = [];

	for (const key of EVENT_KEYS) {
		const metadata = getEventAsset(previewSlug, key);
		if (!metadata) continue;

		const src = metadata.src;
		results.push({
			key,
			displayName: KEY_LABELS[key] ?? key,
			src,
			width: typeof metadata.width === 'number' ? metadata.width : undefined,
			height: typeof metadata.height === 'number' ? metadata.height : undefined,
		});
	}

	return results;
}
