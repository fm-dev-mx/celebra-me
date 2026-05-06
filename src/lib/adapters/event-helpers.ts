import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
	isAssetRegistryKey,
	type AssetSource,
	type ImageAsset,
} from '@/lib/assets/asset-registry';
import {
	PREMIUM_THEMES,
	type IndicationIconKey,
	type ThemePreset,
} from '@/lib/theme/theme-contract';

const runtimeEnv = {
	PROD: process.env.NODE_ENV === 'production',
	DEV: process.env.NODE_ENV !== 'production',
};

export { runtimeEnv };

function normalizeAssetSource(source: AssetSource | string | undefined): AssetSource | undefined {
	if (!source) return undefined;
	if (typeof source !== 'string') return source;

	if (isAssetRegistryKey(source)) {
		return { type: 'internal', key: source };
	}

	if (source.startsWith('https://') || source.startsWith('/')) {
		return { type: 'external', src: source };
	}

	throw new Error(`[AssetRegistry] Invalid asset reference "${source}".`);
}

export function pickVariant<T extends readonly string[]>(
	scope: string,
	candidate: string | undefined,
	allowed: T,
	fallback: T[number],
): T[number] {
	if (!candidate) return fallback;

	if ((allowed as readonly string[]).includes(candidate)) {
		return candidate as T[number];
	}

	console.warn(
		`[ThemeVariant] Invalid variant "${candidate}" in ${scope}. Using fallback: "${fallback}".`,
	);
	return fallback;
}

export function pickPreset(candidate: string | undefined): ThemePreset {
	if (!candidate) return PREMIUM_THEMES[0];
	if ((PREMIUM_THEMES as readonly string[]).includes(candidate)) return candidate as ThemePreset;
	return PREMIUM_THEMES[0];
}

export function resolveAsset(
	eventSlug: string,
	source: AssetSource | string | undefined,
	eventTitle: string,
): ImageAsset | undefined {
	const normalizedSource = normalizeAssetSource(source);
	if (!normalizedSource) return undefined;

	if (normalizedSource.type === 'external') {
		return {
			src: normalizedSource.src,
			alt: `Recurso de ${eventTitle}`,
		};
	}

	if (isCommonAssetKey(normalizedSource.key)) {
		return getCommonAsset(normalizedSource.key);
	}

	if (!isEventAssetKey(normalizedSource.key)) {
		throw new Error(`[AssetRegistry] Unsupported asset key "${normalizedSource.key}".`);
	}

	const metadata = getEventAsset(eventSlug, normalizedSource.key);
	if (!metadata) {
		throw new Error(
			`[AssetRegistry] Missing asset "${normalizedSource.key}" for event "${eventSlug}".`,
		);
	}

	let alt = `Imagen de ${eventTitle}`;
	if (normalizedSource.key === 'hero') alt = `Portada de ${eventTitle}`;
	else if (normalizedSource.key === 'portrait') alt = `Retrato de ${eventTitle}`;
	else if (normalizedSource.key.startsWith('gallery')) {
		const num = normalizedSource.key.replace('gallery', '');
		alt = `Galería ${num} de ${eventTitle}`;
	} else if (normalizedSource.key.startsWith('interlude')) {
		alt = `Interludio de ${eventTitle}`;
	}

	return {
		src: metadata,
		alt,
	};
}

export function requireAsset(
	eventSlug: string,
	source: AssetSource | string,
	eventTitle: string,
): ImageAsset {
	const asset = resolveAsset(eventSlug, source, eventTitle);
	if (!asset) {
		throw new Error(`[AssetRegistry] Required asset is missing for event "${eventSlug}".`);
	}
	return asset;
}

export function adaptItineraryVariant(preset: string): ThemePreset {
	return (PREMIUM_THEMES as readonly string[]).includes(preset)
		? (preset as ThemePreset)
		: PREMIUM_THEMES[0];
}

export function adaptSharedSectionVariant(preset: string): ThemePreset {
	return (PREMIUM_THEMES as readonly string[]).includes(preset)
		? (preset as ThemePreset)
		: PREMIUM_THEMES[0];
}

export function adaptLocationVariant(variant: string | undefined): string {
	return pickVariant('location.variant', variant, PREMIUM_THEMES, PREMIUM_THEMES[0]);
}

export function adaptCountdownVariant(variant: string | undefined): string {
	return pickVariant('countdown.variant', variant, PREMIUM_THEMES, PREMIUM_THEMES[0]);
}

export function adaptQuoteVariant(variant: string | undefined): string {
	return pickVariant('quote.variant', variant, PREMIUM_THEMES, PREMIUM_THEMES[0]);
}

export function adaptIndicationIcon(icon: IndicationIconKey): string {
	return icon;
}
