import type { IconName } from '@/lib/icons/icon-catalog';
import type { ImageAsset } from '@/lib/assets/asset-registry';

/** Canonical editable seal palette accepted by the Envelope contract. */
export const ENVELOPE_SEAL_COLORS = [
	'roseGold',
	'champagne',
	'blush',
	'mauve',
	'deepMauve',
] as const;

export type EnvelopeSealColor = (typeof ENVELOPE_SEAL_COLORS)[number];

export function isEnvelopeSealColor(value: unknown): value is EnvelopeSealColor {
	return typeof value === 'string' && (ENVELOPE_SEAL_COLORS as readonly string[]).includes(value);
}

export type EnvelopeSealIcon =
	| 'boot'
	| 'heart'
	| 'monogram'
	| 'wax-monogram'
	| 'wax-organic'
	| 'wax-medallion'
	| 'flower'
	| 'special-edition';

export const SEAL_ICON_MAP: Record<EnvelopeSealIcon, IconName> = {
	boot: 'BootSeal',
	heart: 'HeartSeal',
	monogram: 'MonogramSeal',
	'wax-monogram': 'WaxMonogramSeal',
	'wax-organic': 'WaxMonogramSeal',
	'wax-medallion': 'WaxMonogramSeal',
	flower: 'FlowerSeal',
	'special-edition': 'Diamond',
};

export type SealRendererType =
	'wax-organic' | 'wax-medallion' | 'monogram' | 'vector-icon' | 'raster';

export interface SealPresentation {
	renderer: SealRendererType;
	skin?: string;
	initials?: string;
	icon?: EnvelopeSealIcon;
	image?: ImageAsset;
}

/** Structural renderer selection, intentionally independent from skin tokens. */
export interface SealStructure {
	renderer: SealRendererType;
	initials?: string;
	icon?: EnvelopeSealIcon;
	image?: ImageAsset;
}

export interface EnvelopeSealInput {
	sealStyle?: 'wax' | 'ribbon' | 'flower' | 'monogram';
	sealIcon?: EnvelopeSealIcon;
	sealInitials?: string;
	sealVariant?: string;
	sealColor?: string;
	sealImage?: ImageAsset;
}

export function resolveSealSkin(input: Pick<EnvelopeSealInput, 'sealColor' | 'sealVariant'> = {}) {
	return input.sealColor || input.sealVariant;
}

/** Normalize legacy seal inputs into a structural renderer contract. */
export function resolveSealStructure(input: EnvelopeSealInput = {}): SealStructure {
	const initials = input.sealInitials?.trim() || undefined;

	if (input.sealImage && Boolean(input.sealImage.src)) {
		return { renderer: 'raster', image: input.sealImage, initials };
	}

	if (input.sealIcon === 'wax-medallion') {
		return { renderer: 'wax-medallion', initials, icon: 'wax-medallion' };
	}

	if (input.sealIcon === 'wax-organic') {
		return { renderer: 'wax-organic', initials, icon: 'wax-organic' };
	}

	if (input.sealIcon === 'wax-monogram') {
		return { renderer: 'wax-organic', initials, icon: 'wax-monogram' };
	}

	if (input.sealIcon === 'monogram' || input.sealStyle === 'monogram') {
		return { renderer: 'monogram', initials, icon: 'monogram' };
	}

	if (input.sealIcon && ['boot', 'heart', 'flower', 'special-edition'].includes(input.sealIcon)) {
		return { renderer: 'vector-icon', icon: input.sealIcon, initials };
	}

	if (input.sealStyle === 'flower') {
		return { renderer: 'vector-icon', icon: 'flower', initials };
	}

	if (input.sealStyle === 'ribbon') {
		return { renderer: 'vector-icon', icon: 'special-edition', initials };
	}

	return { renderer: 'wax-organic', initials, icon: 'wax-organic' };
}

/**
 * Pure resolver mapping raw envelope configuration to a normalized SealPresentation.
 *
 * Precedence:
 * 1. Raster Image (`sealImage` present) -> 'raster'
 * 2. Explicit Structural Selection (`wax-medallion` / `wax-organic`) -> 'wax-medallion' | 'wax-organic'
 * 3. Existing Icon & Style Contracts (`wax-monogram` -> 'wax-organic', `monogram` -> 'monogram', etc.)
 * 4. Fallback Default -> 'wax-organic'
 */
export function resolveSealPresentation(input: EnvelopeSealInput = {}): SealPresentation {
	return {
		...resolveSealStructure(input),
		skin: resolveSealSkin(input),
	};
}

export interface RevealCardData {
	label: string;
	primaryName: string;
	secondaryName?: string;
	date: string;
	tagline?: string;
	guestLabel: string;
	guestName?: string;
}

export interface OpeningViewModel {
	envelope: {
		name: string;
	};
	card: RevealCardData;
}

interface OpeningEnvelopeInput {
	envelopeName?: string;
	cardLabel?: string;
	cardName?: string;
	cardSecondaryName?: string;
	cardTagline?: string;
	documentLabel?: string;
	guestLabel?: string;
	guestNameFallback?: string;
}

interface OpeningHeroInput {
	name: string;
	secondaryName?: string;
	label?: string;
	date: string;
}

function optionalTrim(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function joinHonoreeNames(primaryName: string, secondaryName: string | undefined): string {
	const primary = optionalTrim(primaryName) ?? '';
	const secondary = optionalTrim(secondaryName);
	return secondary ? `${primary} y ${secondary}` : primary;
}

export function formatCardDate(date: string): string {
	const rawFormatted = new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(date));

	return rawFormatted
		.replace(/sept\.?/i, 'SEP')
		.replace(/\./g, '')
		.replace(/\s+/g, ' · ')
		.toUpperCase();
}

export function buildRevealCard(input: {
	date: string;
	guestName?: string;
	guestLabel?: string;
	label?: string;
	name: string;
	secondaryName?: string;
	tagline?: string;
}): RevealCardData {
	return {
		label: input.label || 'Invitación',
		primaryName: input.name,
		secondaryName: optionalTrim(input.secondaryName),
		date: formatCardDate(input.date),
		guestLabel: input.guestLabel || 'Entrega especial para:',
		guestName: input.guestName,
		tagline: input.tagline,
	};
}

export function buildOpeningViewModel(input: {
	hero: OpeningHeroInput;
	envelope?: OpeningEnvelopeInput;
	guestName?: string;
}): OpeningViewModel {
	const envelope = input.envelope ?? {};
	const primaryName = optionalTrim(envelope.cardName) ?? input.hero.name;
	const secondaryName =
		optionalTrim(envelope.cardSecondaryName) ?? optionalTrim(input.hero.secondaryName);
	const guestName = optionalTrim(input.guestName) ?? optionalTrim(envelope.guestNameFallback);

	return {
		envelope: {
			name:
				optionalTrim(envelope.envelopeName) ??
				joinHonoreeNames(input.hero.name, input.hero.secondaryName),
		},
		card: buildRevealCard({
			name: primaryName,
			secondaryName,
			date: input.hero.date,
			label:
				optionalTrim(envelope.cardLabel) ??
				optionalTrim(envelope.documentLabel) ??
				optionalTrim(input.hero.label),
			tagline: optionalTrim(envelope.cardTagline),
			guestLabel: optionalTrim(envelope.guestLabel),
			guestName,
		}),
	};
}
