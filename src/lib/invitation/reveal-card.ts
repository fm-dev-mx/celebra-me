import type { IconName } from '@/lib/icons/icon-catalog';
import type { ImageAsset } from '@/lib/assets/asset-registry';

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

export interface EnvelopeSealInput {
	sealStyle?: 'wax' | 'ribbon' | 'flower' | 'monogram';
	sealIcon?: EnvelopeSealIcon;
	sealInitials?: string;
	sealVariant?: string;
	sealColor?: string;
	sealImage?: ImageAsset;
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
	const initials = input.sealInitials?.trim() || undefined;
	const skin = input.sealColor || input.sealVariant;

	// 1. Raster image precedence (explicit asset input)
	if (input.sealImage && Boolean(input.sealImage.src)) {
		return {
			renderer: 'raster',
			image: input.sealImage,
			skin: input.sealVariant,
			initials,
		};
	}

	// 2. Canonical structural selection via sealIcon
	if (input.sealIcon === 'wax-medallion') {
		return {
			renderer: 'wax-medallion',
			skin,
			initials,
			icon: 'wax-medallion',
		};
	}

	if (input.sealIcon === 'wax-organic') {
		return {
			renderer: 'wax-organic',
			skin,
			initials,
			icon: 'wax-organic',
		};
	}

	// 3. Existing icon & style contracts
	if (input.sealIcon === 'wax-monogram') {
		return {
			renderer: 'wax-organic',
			skin,
			initials,
			icon: 'wax-monogram',
		};
	}

	if (input.sealIcon === 'monogram' || input.sealStyle === 'monogram') {
		return {
			renderer: 'monogram',
			skin,
			initials,
			icon: 'monogram',
		};
	}

	if (input.sealIcon && ['boot', 'heart', 'flower', 'special-edition'].includes(input.sealIcon)) {
		return {
			renderer: 'vector-icon',
			icon: input.sealIcon,
			skin,
			initials,
		};
	}

	if (input.sealStyle === 'flower') {
		return {
			renderer: 'vector-icon',
			icon: 'flower',
			skin,
			initials,
		};
	}

	if (input.sealStyle === 'ribbon') {
		return {
			renderer: 'vector-icon',
			icon: 'special-edition',
			skin,
			initials,
		};
	}

	// 4. Default fallback: wax-organic
	return {
		renderer: 'wax-organic',
		skin,
		initials,
		icon: 'wax-organic',
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
	return new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	})
		.format(new Date(date))
		.replace(/ /g, ' · ')
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
