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
 * Landing showroom ("vitrina"): event chips, a device mockup with a scrollable mini-invitation per
 * demo, and a WhatsApp quote whose message carries a reference code, `Ref. XV-JARDIN-VITRINA`
 * (event, style, entry point), so each conversation says which demo and which button started it.
 */

/**
 * Demo that opens the XV showroom and the hero. Lantern Garden is hidden from the catalog; the
 * owner authorized showing it here until the new main XV demo is merged, then this points there.
 */
export const VITRINA_LEAD_DEMO_SLUG = 'demo-xv-lantern-garden';

/** Where a quote starts: the showroom detail, the mobile sticky bar or the header button. */
export type VitrinaEntry = 'VITRINA' | 'BARRA' | 'HEADER';

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

/** Mini-invitation palette: page background, ink, accent band and text on the accent band. */
type VitrinaPalette = readonly [string, string, string, string];

/** Showroom copy and preview data per demo; names, dates and places are preview-only samples. */
interface VitrinaDemoPresentation {
	name: string;
	ref: string;
	tags: readonly string[];
	description: string;
	kicker: string;
	person: string;
	/** Preview date, `YYYY-MM-DD`. */
	date: string;
	place: string;
	palette: VitrinaPalette;
	/** Focal point of the phone cover, so the face stays centered on every frame. */
	focal: string;
	cover: EventAssetKey;
	/** Wide photo for the PC frame; without it the cover sits whole over a blurred copy. */
	wideCover?: EventAssetKey;
	gallery: readonly EventAssetKey[];
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
	'demo-xv-lantern-garden': {
		name: 'Jardín de Luz',
		ref: 'JARDIN',
		tags: ['Nocturna', 'Emotiva'],
		description:
			'Una noche lila, una carta y el cariño de su familia. Sobre, música y galería.',
		kicker: 'Mis XV años',
		person: 'Luciana',
		date: '2027-10-16',
		place: 'Jardín de las Linternas',
		palette: ['hsl(265 30% 14%)', 'hsl(40 60% 88%)', 'hsl(275 35% 72%)', 'hsl(265 30% 14%)'],
		focal: '50% 45%',
		cover: 'hero',
		gallery: ['gallery01', 'gallery02', 'gallery03'],
	},
	'demo-xv-celestial-blue': {
		name: 'Celestial Blue',
		ref: 'CELESTIAL',
		tags: ['Clásica', 'Azul y dorado'],
		description: 'Azul noche y dorado, con sobre, música y galería.',
		kicker: 'Mis XV años',
		person: 'Camila',
		date: '2027-09-12',
		place: 'Cuernavaca',
		palette: ['hsl(220 45% 14%)', 'hsl(45 50% 92%)', 'hsl(42 60% 60%)', 'hsl(220 45% 14%)'],
		focal: '50% 25%',
		cover: 'portrait',
		wideCover: 'heroDesktop',
		gallery: ['gallery01', 'gallery02', 'gallery03'],
	},
	'demo-xv-enchanted-rose': {
		name: 'Enchanted Rose',
		ref: 'ROSE',
		tags: ['Romántica', 'Rosas'],
		description: 'Rosas y tonos cálidos para una fiesta de cuento.',
		kicker: 'Mis XV años',
		person: 'Isabella',
		date: '2027-11-20',
		place: 'Salón Versalles',
		palette: ['hsl(345 30% 97%)', 'hsl(345 40% 22%)', 'hsl(345 45% 42%)', 'hsl(0 0% 100%)'],
		focal: '62% 38%',
		cover: 'portrait',
		wideCover: 'heroDesktop',
		gallery: ['gallery01', 'gallery02', 'gallery03'],
	},
	'demo-xv-editorial': {
		name: 'Editorial',
		ref: 'EDITORIAL',
		tags: ['Moderna', 'Blanco y negro'],
		description: 'Letras grandes y fotos de revista, en blanco y negro.',
		kicker: 'XV años',
		person: 'Valentina',
		date: '2027-09-18',
		place: 'Ciudad de México',
		palette: ['hsl(0 0% 98%)', 'hsl(0 0% 8%)', 'hsl(0 0% 8%)', 'hsl(0 0% 98%)'],
		focal: '50% 40%',
		cover: 'portrait',
		gallery: ['gallery01', 'gallery02', 'gallery03'],
	},
	'demo-brisa': {
		name: 'Brisa',
		ref: 'BRISA',
		tags: ['Playa', 'Luminosa'],
		description: 'Boda frente al mar, con padrinos, vestimenta y pase personal.',
		kicker: 'Nos casamos',
		person: 'Ximena & Diego',
		date: '2027-11-13',
		place: 'Punta Mita',
		palette: ['hsl(40 40% 97%)', 'hsl(200 35% 20%)', 'hsl(190 35% 45%)', 'hsl(0 0% 100%)'],
		focal: '50% 35%',
		cover: 'portrait',
		gallery: ['ceremony', 'reception', 'family'],
	},
	'demo-bautizo-angelic-presence': {
		name: 'Angelical',
		ref: 'ANGELICAL',
		tags: ['Suave', 'Familiar'],
		description: 'Tonos suaves, padrinos y el programa del día.',
		kicker: 'Mi bautizo',
		person: 'María',
		date: '2027-10-17',
		place: 'Ciudad de México',
		palette: ['hsl(40 40% 97%)', 'hsl(215 25% 25%)', 'hsl(205 45% 80%)', 'hsl(215 25% 20%)'],
		focal: '55% 40%',
		cover: 'hero',
		gallery: ['ceremony', 'reception', 'family'],
	},
	'demo-primera-comunion-angelic-presence': {
		name: 'Angelical ilustrada',
		ref: 'ANGELICAL',
		tags: ['Ilustrada', 'Serena'],
		description: 'Ilustraciones serenas, familia y padrinos.',
		kicker: 'Mi primera comunión',
		person: 'Camila Aurora',
		date: '2027-09-11',
		place: 'Parroquia del Carmen',
		palette: ['hsl(45 40% 97%)', 'hsl(210 25% 25%)', 'hsl(45 55% 70%)', 'hsl(210 25% 20%)'],
		focal: '50% 70%',
		cover: 'hero',
		gallery: ['ceremony', 'reception'],
	},
	'demo-cumple-luxury-hacienda': {
		name: 'Hacienda',
		ref: 'HACIENDA',
		tags: ['Elegante', 'Campestre'],
		description: 'Elegancia de hacienda para un cumpleaños de 60.',
		kicker: '60 años',
		person: 'Alberto',
		date: '2027-10-23',
		place: 'Hacienda San Gabriel',
		palette: ['hsl(35 30% 95%)', 'hsl(25 35% 18%)', 'hsl(25 40% 32%)', 'hsl(35 30% 95%)'],
		focal: '45% 40%',
		cover: 'portrait',
		gallery: ['jardin', 'signature', 'family'],
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
 * Per-demo palette and photo focal point as `[data-demo-style]` rules, rendered once by the
 * showroom for the hero fan, the showroom and the sticky bar (inline style attributes are not
 * allowed in components).
 */
export function buildVitrinaDemoStyles(): string {
	return VITRINA_EVENTS.flatMap((event) => event.demos)
		.map((demo) => {
			const [bg, ink, accent, onAccent] = demo.palette;
			return `[data-demo-style='${demo.slug}']{--demo-focal:${demo.focal};--mini-bg:${bg};--mini-ink:${ink};--mini-accent:${accent};--mini-on-accent:${onAccent}}`;
		})
		.join('');
}

/** `XV-JARDIN-VITRINA`: event, style and entry point. */
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
