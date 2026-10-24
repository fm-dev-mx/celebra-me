import type { DemoShowroomPublicSlug } from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventAssetKey } from '@/lib/assets/asset-keys';
import type { EventType } from '@/lib/theme/theme-contract';
import {
	DEMO_SHOWROOM_EVENTS,
	DEMO_SHOWROOM_ITEMS,
	getFeaturedDemoShowroomItems,
} from '@/data/demo-showroom.data';
import { DEMO_INVITATIONS } from '@/invitations/demos';

/**
 * Landing showroom ("vitrina"): event tabs, a device mockup with the live demo, and a WhatsApp
 * quote whose message carries a reference code, `Ref. XV-SERENATA-VITRINA`
 * (event, style, entry point), so each conversation says which demo and which button started it.
 */

/** Demo that opens the XV showroom and the hero: Serenata, the main XV demo. */
export const VITRINA_LEAD_DEMO_SLUG = 'demo-xv-serenata';

/**
 * Where a quote starts: the showroom detail, the mobile sticky bar or the header button on the
 * landing; inside a demo, its floating button, gallery panel or closing panel.
 */
export type VitrinaEntry = 'VITRINA' | 'BARRA' | 'HEADER' | 'FLOTANTE' | 'GALERIA' | 'CIERRE';

export interface VitrinaEventConfig {
	publicSlug: DemoShowroomPublicSlug;
	eventType: EventType;
	/** Chip label. */
	label: string;
	/** Event name inside the WhatsApp message: «la demo Brisa de boda». */
	messageLabel: string;
	ref: string;
	/** Icon name from the catalog event. */
	icon: string;
}

/** Showroom copy and preview data per demo; names and dates are preview-only samples. */
interface VitrinaDemoPresentation {
	name: string;
	ref: string;
	tags: readonly string[];
	description: string;
	kicker: string;
	person: string;
	/** Preview date, `YYYY-MM-DD`. */
	date: string;
	/** Focal point of the phone cover, so the face stays centered on every frame. */
	focal: string;
	cover: EventAssetKey;
}

export interface VitrinaDemo extends VitrinaDemoPresentation {
	slug: string;
	publicSlug: DemoShowroomPublicSlug;
	/** Public address, e.g. `/jardin-de-luz`. */
	href: string;
	isLead: boolean;
}

export interface VitrinaEvent extends VitrinaEventConfig {
	demos: readonly VitrinaDemo[];
}

const EVENT_CONFIG: Record<
	DemoShowroomPublicSlug,
	Omit<VitrinaEventConfig, 'publicSlug' | 'eventType' | 'icon'> | undefined
> = {
	xv: { label: 'XV años', messageLabel: 'XV años', ref: 'XV' },
	boda: { label: 'Boda', messageLabel: 'boda', ref: 'BODA' },
	bautizo: { label: 'Bautizo', messageLabel: 'bautizo', ref: 'BAUTIZO' },
	'primera-comunion': {
		label: 'Comunión',
		messageLabel: 'primera comunión',
		ref: 'COMUNION',
	},
	cumpleanos: { label: 'Cumpleaños', messageLabel: 'cumpleaños', ref: 'CUMPLE' },
	bautismo: undefined,
	cumple: undefined,
};

const PRESENTATION: Record<string, VitrinaDemoPresentation> = {
	'demo-xv-serenata': {
		name: 'Serenata',
		ref: 'SERENATA',
		tags: ['Jardín', 'Elegante'],
		description:
			'Verde salvia y champaña bajo un olivar, con sobre, música y una canción dedicada.',
		kicker: 'Mis XV años',
		person: 'Regina',
		date: '2027-11-20',
		focal: '72% 55%',
		cover: 'hero',
	},
	'demo-xv-celestial-blue': {
		name: 'Celestial Blue',
		ref: 'CELESTIAL',
		tags: ['Clásica', 'Azul y dorado'],
		description: 'Azul noche y dorado, con sobre, música y galería.',
		kicker: 'Mis XV años',
		person: 'Camila',
		date: '2027-09-12',
		focal: '50% 25%',
		cover: 'portrait',
	},
	'demo-xv-enchanted-rose': {
		name: 'Enchanted Rose',
		ref: 'ROSE',
		tags: ['Romántica', 'Rosas'],
		description: 'Rosas y tonos cálidos para una fiesta de cuento.',
		kicker: 'Mis XV años',
		person: 'Isabella',
		date: '2027-11-20',
		focal: '62% 38%',
		cover: 'portrait',
	},
	'demo-xv-editorial': {
		name: 'Editorial',
		ref: 'EDITORIAL',
		tags: ['Moderna', 'Blanco y negro'],
		description: 'Letras grandes y fotos de revista, en blanco y negro.',
		kicker: 'XV años',
		person: 'Valentina',
		date: '2027-09-18',
		focal: '50% 40%',
		cover: 'portrait',
	},
	'demo-brisa': {
		name: 'Brisa',
		ref: 'BRISA',
		tags: ['Playa', 'Luminosa'],
		description: 'Boda frente al mar, con padrinos, vestimenta y pase personal.',
		kicker: 'Nos casamos',
		person: 'Ximena & Diego',
		date: '2027-11-13',
		focal: '50% 35%',
		cover: 'portrait',
	},
	'demo-bautizo-angelic-presence': {
		name: 'Angelical',
		ref: 'ANGELICAL',
		tags: ['Suave', 'Familiar'],
		description: 'Tonos suaves, padrinos y el programa del día.',
		kicker: 'Mi bautizo',
		person: 'María',
		date: '2027-10-17',
		focal: '55% 40%',
		cover: 'hero',
	},
	'demo-primera-comunion-angelic-presence': {
		name: 'Angelical ilustrada',
		ref: 'ANGELICAL',
		tags: ['Ilustrada', 'Serena'],
		description: 'Ilustraciones serenas, familia y padrinos.',
		kicker: 'Mi primera comunión',
		person: 'Camila Aurora',
		date: '2027-09-11',
		focal: '50% 70%',
		cover: 'hero',
	},
	'demo-cumple-luxury-hacienda': {
		name: 'Hacienda',
		ref: 'HACIENDA',
		tags: ['Elegante', 'Campestre'],
		description: 'Elegancia de hacienda para un cumpleaños de 60.',
		kicker: '60 años',
		person: 'Alberto',
		date: '2027-10-23',
		focal: '45% 40%',
		cover: 'portrait',
	},
};

function toVitrinaDemo(slug: string, publicSlug: DemoShowroomPublicSlug): VitrinaDemo {
	const item = DEMO_SHOWROOM_ITEMS.find((candidate) => candidate.slug === slug);
	const presentation = PRESENTATION[slug];
	if (!item) throw new Error(`Vitrina demo ${slug} is not in the demo catalog.`);
	if (!presentation) throw new Error(`Vitrina demo ${slug} has no showroom presentation.`);
	return {
		...presentation,
		slug,
		publicSlug,
		href: item.href,
		isLead: slug === VITRINA_LEAD_DEMO_SLUG,
	};
}

/** Showroom events in catalog order; the lead demo opens its event, then featured demos follow. */
export const VITRINA_EVENTS: readonly VitrinaEvent[] = DEMO_SHOWROOM_EVENTS.flatMap((event) => {
	const config = EVENT_CONFIG[event.publicSlug];
	if (!config) return [];
	const lead = DEMO_INVITATIONS.find(
		(demo) => demo.slug === VITRINA_LEAD_DEMO_SLUG && demo.eventType === event.eventType,
	);
	const slugs = [
		...(lead ? [lead.slug] : []),
		...getFeaturedDemoShowroomItems(event.eventType)
			.map((item) => item.slug)
			.filter((slug) => slug !== VITRINA_LEAD_DEMO_SLUG),
	];
	if (slugs.length === 0) return [];
	return [
		{
			...config,
			publicSlug: event.publicSlug,
			eventType: event.eventType,
			icon: event.icon,
			demos: slugs.map((slug) => toVitrinaDemo(slug, event.publicSlug)),
		},
	];
});

export function getVitrinaEvent(publicSlug: string): VitrinaEvent | undefined {
	return VITRINA_EVENTS.find((event) => event.publicSlug === publicSlug);
}

export function getVitrinaLeadDemo(): VitrinaDemo {
	const lead = VITRINA_EVENTS.flatMap((event) => event.demos).find((demo) => demo.isLead);
	if (!lead) throw new Error(`Missing vitrina lead demo: ${VITRINA_LEAD_DEMO_SLUG}`);
	return lead;
}

export function findVitrinaDemo(slug: string): VitrinaDemo | undefined {
	return VITRINA_EVENTS.flatMap((event) => event.demos).find((demo) => demo.slug === slug);
}

/**
 * Per-demo photo focal point as `[data-demo-style]` rules, rendered once by the
 * showroom for the hero fan, the showroom and the sticky bar (inline style attributes are not
 * allowed in components).
 */
export function buildVitrinaDemoStyles(): string {
	return VITRINA_EVENTS.flatMap((event) => event.demos)
		.map((demo) => `[data-demo-style='${demo.slug}']{--demo-focal:${demo.focal}}`)
		.join('');
}

/** `XV-SERENATA-VITRINA`: event, style and entry point. */
export function buildVitrinaRef(
	event: VitrinaEventConfig,
	demo: VitrinaDemo,
	entry: VitrinaEntry,
): string {
	return `${event.ref}-${demo.ref}-${entry}`;
}

export function buildVitrinaMessage(
	event: VitrinaEventConfig,
	demo: VitrinaDemo,
	entry: VitrinaEntry,
): string {
	return `Hola, vi la demo ${demo.name} de ${event.messageLabel} en su página y quiero una invitación así. Ref. ${buildVitrinaRef(event, demo, entry)}`;
}
