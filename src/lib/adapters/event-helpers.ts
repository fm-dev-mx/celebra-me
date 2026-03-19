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
	COUNTDOWN_VARIANTS,
	ITINERARY_VARIANTS,
	LEGACY_INDICATION_ICON_MAP,
	LOCATION_VARIANTS,
	QUOTE_VARIANTS,
	SHARED_SECTION_VARIANTS,
	THEME_PRESETS,
	type IndicationIconKey,
	type ItineraryVariant,
	type SharedSectionVariant,
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
	if (!candidate) {
		console.log(`[ThemeVariant] No candidate for ${scope}, using fallback: ${fallback}`);
		return fallback;
	}
	if ((allowed as readonly string[]).includes(candidate)) {
		console.log(`[ThemeVariant] Match for ${scope}: ${candidate}`);
		return candidate as T[number];
	}
	console.warn(
		`[ThemeVariant] Invalid variant "${candidate}" in ${scope}. Fallback applied: "${fallback}".`,
	);
	return fallback;
}

export function pickPreset(candidate: string | undefined): ThemePreset {
	if (!candidate) return THEME_PRESETS[0];
	if ((THEME_PRESETS as readonly string[]).includes(candidate)) return candidate as ThemePreset;

	if (runtimeEnv.PROD) {
		throw new Error(`[ThemePreset] Invalid preset "${candidate}" in theme.preset.`);
	}

	console.warn(
		`[ThemePreset] Invalid preset "${candidate}". Using fallback "${THEME_PRESETS[0]}".`,
	);
	return THEME_PRESETS[0];
}

export function hexToRgb(hex: string): string {
	hex = hex.replace(/^#/, '');
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}
	const bigint = parseInt(hex, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return `${r}, ${g}, ${b}`;
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

export function adaptItineraryVariant(preset: string): ItineraryVariant {
	return (ITINERARY_VARIANTS as readonly string[]).includes(preset)
		? (preset as ItineraryVariant)
		: 'base';
}

export function adaptSharedSectionVariant(preset: string): SharedSectionVariant {
	return (SHARED_SECTION_VARIANTS as readonly string[]).includes(preset)
		? (preset as SharedSectionVariant)
		: 'standard';
}

export function adaptLocationVariant(variant: string | undefined): string {
	return pickVariant('location.variant', variant, LOCATION_VARIANTS, 'structured');
}

export function adaptCountdownVariant(variant: string | undefined): string {
	return pickVariant('countdown.variant', variant, COUNTDOWN_VARIANTS, 'minimal');
}

export function adaptQuoteVariant(variant: string | undefined): string {
	return pickVariant('quote.variant', variant, QUOTE_VARIANTS, 'elegant');
}

export function adaptIndicationIcon(icon: IndicationIconKey): string {
	return LEGACY_INDICATION_ICON_MAP[icon] || icon;
}
