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
	name: string;
	date: string;
	tagline?: string;
	guestName?: string;
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
	label?: string;
	name: string;
	tagline?: string;
}): RevealCardData {
	return {
		label: input.label || 'Invitación',
		name: input.name,
		date: formatCardDate(input.date),
		guestName: input.guestName,
		tagline: input.tagline,
	};
}
