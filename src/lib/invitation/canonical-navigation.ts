import type { InvitationViewModel } from '@/lib/adapters/types';

type SectionKey = keyof InvitationViewModel['sections'];

interface NavItem {
	label: string;
	href: string;
}

const CANONICAL_NAV_ITEMS: ReadonlyArray<{
	label: string;
	href: string;
	sectionKey: SectionKey | null;
}> = [
	{ label: 'Inicio', href: '#inicio', sectionKey: null },
	{ label: 'Evento', href: '#event-location', sectionKey: 'location' },
	{ label: 'Programa', href: '#itinerary', sectionKey: 'itinerary' },
	{ label: 'Galería', href: '#galeria', sectionKey: 'gallery' },
	{ label: 'Confirmar', href: '#rsvp', sectionKey: 'rsvp' },
];

export function buildCanonicalNavigation(sections: InvitationViewModel['sections']): NavItem[] {
	return CANONICAL_NAV_ITEMS.filter((item) => {
		if (item.sectionKey === null) return true;
		return Boolean(sections[item.sectionKey]);
	}).map(({ sectionKey: _, ...rest }) => rest);
}
