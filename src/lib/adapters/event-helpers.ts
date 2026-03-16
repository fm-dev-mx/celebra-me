import { getEventAsset, type EventAssetKey, type ImageAsset } from '@/lib/assets/asset-registry';
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

export function pickVariant<T extends readonly string[]>(
	scope: string,
	candidate: string | undefined,
	allowed: T,
	fallback: T[number],
): T[number] {
	if (!candidate) return fallback;
	if ((allowed as readonly string[]).includes(candidate)) return candidate as T[number];
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
	keyOrUrl: string | undefined,
	eventTitle: string,
): ImageAsset | undefined {
	if (!keyOrUrl) return undefined;

	if (keyOrUrl.startsWith('http') || keyOrUrl.startsWith('/')) {
		return {
			src: keyOrUrl,
			alt: `Recurso de ${eventTitle}`,
		};
	}

	const metadata = getEventAsset(eventSlug, keyOrUrl as EventAssetKey);
	if (!metadata) return undefined;

	let alt = `Imagen de ${eventTitle}`;
	if (keyOrUrl === 'hero') alt = `Portada de ${eventTitle}`;
	else if (keyOrUrl === 'portrait') alt = `Retrato de ${eventTitle}`;
	else if (keyOrUrl.startsWith('gallery')) {
		const num = keyOrUrl.replace('gallery', '');
		alt = `Galería ${num} de ${eventTitle}`;
	} else if (keyOrUrl.startsWith('interlude')) {
		alt = `Interludio de ${eventTitle}`;
	}

	return {
		src: metadata,
		alt,
	};
}

export function requireAsset(eventSlug: string, keyOrUrl: string, eventTitle: string): ImageAsset {
	const asset = resolveAsset(eventSlug, keyOrUrl, eventTitle);
	if (!asset) {
		console.warn(`[AssetWarning] Asset not found for key: ${keyOrUrl} in event ${eventSlug}`);
		return { src: '', alt: 'Recurso faltante' };
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
