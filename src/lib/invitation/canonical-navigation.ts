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

/** Map known invitation anchors to the section that must exist for the item to render. */
const HREF_SECTION_KEYS: Readonly<Record<string, SectionKey | null>> = {
	'#inicio': null,
	'#event-location': 'location',
	'#location': 'location',
	'#itinerary': 'itinerary',
	'#galeria': 'gallery',
	'#regalos': 'gifts',
	'#rsvp': 'rsvp',
};

function toNavItemDef(item: NavItem): NavItemDef {
	const sectionKey = Object.hasOwn(HREF_SECTION_KEYS, item.href)
		? HREF_SECTION_KEYS[item.href]!
		: null;
	return {
		label: item.label,
		href: item.href,
		sectionKey,
	};
}

function filterNavItems(
	items: readonly NavItemDef[],
	sections: InvitationViewModel['sections'],
): NavItem[] {
	return items
		.filter((item) => {
			if (item.sectionKey === null) return true;
			return Boolean(sections[item.sectionKey]);
		})
		.map(({ sectionKey: _, ...rest }) => rest);
}

/**
 * Build invitation navigation from explicit content items when provided,
 * otherwise the shared canonical defaults. Section presence still filters items.
 */
export function buildCanonicalNavigation(
	sections: InvitationViewModel['sections'],
	explicitNavigation?: readonly NavItem[],
): NavItem[] {
	const items =
		explicitNavigation && explicitNavigation.length > 0
			? explicitNavigation.map(toNavItemDef)
			: CANONICAL_NAV_ITEMS;
	return filterNavItems(items, sections);
}
