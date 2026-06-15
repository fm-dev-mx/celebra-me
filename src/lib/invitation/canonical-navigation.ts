import type { InvitationViewModel } from '@/lib/adapters/types';

type SectionKey = keyof InvitationViewModel['sections'];

interface NavItem {
	label: string;
	href: string;
}

type NavItemDef = {
	label: string;
	href: string;
	sectionKey: SectionKey | null;
};

const CANONICAL_NAV_ITEMS: readonly NavItemDef[] = [
	{ label: 'Inicio', href: '#inicio', sectionKey: null },
	{ label: 'Evento', href: '#event-location', sectionKey: 'location' },
	{ label: 'Programa', href: '#itinerary', sectionKey: 'itinerary' },
	{ label: 'Galería', href: '#galeria', sectionKey: 'gallery' },
	{ label: 'Confirmar', href: '#rsvp', sectionKey: 'rsvp' },
];

const NAV_ITEM_OVERRIDES: Record<string, readonly NavItemDef[]> = {
	'leah-lexa': [
		{ label: 'Ubicación', href: '#event-location', sectionKey: 'location' },
		{ label: 'Fecha', href: '#inicio', sectionKey: null },
		{ label: 'Regalos', href: '#regalos', sectionKey: 'gifts' },
		{ label: 'Confirmar', href: '#rsvp', sectionKey: 'rsvp' },
	],
};

export function buildCanonicalNavigation(
	sections: InvitationViewModel['sections'],
	slug?: string,
): NavItem[] {
	const items = slug ? (NAV_ITEM_OVERRIDES[slug] ?? CANONICAL_NAV_ITEMS) : CANONICAL_NAV_ITEMS;
	return items
		.filter((item) => {
			if (item.sectionKey === null) return true;
			return Boolean(sections[item.sectionKey]);
		})
		.map(({ sectionKey: _, ...rest }) => rest);
}
