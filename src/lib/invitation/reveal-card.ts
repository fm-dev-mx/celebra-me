import type { IconName } from '@/lib/icons/icon-catalog';

export type EnvelopeSealIcon = 'boot' | 'heart' | 'monogram' | 'flower' | 'special-edition';

export const SEAL_ICON_MAP: Record<EnvelopeSealIcon, IconName> = {
	boot: 'BootSeal',
	heart: 'HeartSeal',
	monogram: 'MonogramSeal',
	flower: 'FlowerSeal',
	'special-edition': 'Diamond',
};

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
