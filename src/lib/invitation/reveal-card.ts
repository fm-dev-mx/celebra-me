export type EnvelopeSealIcon = 'boot' | 'heart' | 'monogram' | 'flower' | 'special-edition';

export const SEAL_ICON_MAP: Record<EnvelopeSealIcon, string> = {
	boot: 'Boot',
	heart: 'HeartSeal',
	monogram: 'MonogramSeal',
	flower: 'FlowerSeal',
	'special-edition': 'Diamond',
};

export interface RevealCardData {
	documentLabel: string;
	name: string;
	details: string;
	guestName?: string;
	sealIcon: EnvelopeSealIcon;
	sealInitials?: string;
}

export function formatRevealDate(date: string): string {
	return new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(date));
}

export function buildRevealCard(input: {
	date: string;
	city: string;
	documentLabel?: string;
	guestName?: string;
	name: string;
	sealIcon?: EnvelopeSealIcon;
	sealInitials?: string;
}): RevealCardData {
	return {
		documentLabel: input.documentLabel || 'Invitación',
		name: input.name,
		details: `${formatRevealDate(input.date)} • ${input.city}`,
		guestName: input.guestName,
		sealIcon: input.sealIcon || 'monogram',
		sealInitials: input.sealInitials,
	};
}
