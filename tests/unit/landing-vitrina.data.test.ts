import path from 'node:path';

import { DEMO_SHOWROOM_EVENTS, getFeaturedDemoShowroomItems } from '@/data/demo-showroom.data';
import {
	VITRINA_EVENTS,
	VITRINA_LEAD_DEMO_SLUG,
	buildVitrinaMessage,
	buildVitrinaRef,
	getVitrinaEvent,
	getVitrinaLeadDemo,
} from '@/data/landing-vitrina.data';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import { daysUntil, eventFromHash, withWhatsAppText } from '@/lib/landing/vitrina';
import { listFeaturedDemoRouteSlugs } from '@/lib/seo/demo-sitemap-pages';

describe('landing showroom data', () => {
	it('follows the showroom event order and lists every featured demo', () => {
		expect(VITRINA_EVENTS.map((event) => event.publicSlug)).toEqual(
			DEMO_SHOWROOM_EVENTS.filter((event) =>
				getFeaturedDemoShowroomItems().some((item) => item.eventType === event.eventType),
			).map((event) => event.publicSlug),
		);
		const listed = VITRINA_EVENTS.flatMap((event) => event.demos.map((demo) => demo.slug));
		for (const item of getFeaturedDemoShowroomItems()) {
			expect(listed).toContain(item.slug);
		}
		expect(new Set(listed).size).toBe(listed.length);
	});

	it('leads XV with the lead demo and marks only it as the lead', () => {
		const xv = getVitrinaEvent('xv');
		expect(xv?.demos[0]?.slug).toBe(VITRINA_LEAD_DEMO_SLUG);
		expect(getVitrinaLeadDemo().slug).toBe(VITRINA_LEAD_DEMO_SLUG);
		const leads = VITRINA_EVENTS.flatMap((event) => event.demos.filter((demo) => demo.isLead));
		expect(leads.map((demo) => demo.slug)).toEqual([VITRINA_LEAD_DEMO_SLUG]);
	});

	it('gives every demo a complete presentation', () => {
		for (const event of VITRINA_EVENTS) {
			for (const demo of event.demos) {
				expect(demo.palette).toHaveLength(4);
				expect(demo.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(demo.href).toMatch(/^\/[a-z0-9-]+$/);
				expect(demo.href.startsWith(`/${event.eventType}/`)).toBe(false);
				expect(demo.ref).toMatch(/^[A-Z]+$/);
			}
		}
	});

	it('builds the quote reference and message for each entry point', () => {
		const boda = getVitrinaEvent('boda')!;
		const brisa = boda.demos[0]!;
		expect(buildVitrinaRef(boda, brisa, 'VITRINA')).toBe('BODA-BRISA-VITRINA');
		expect(buildVitrinaMessage(boda, brisa, 'BARRA')).toBe(
			'Hola, vi la demo Brisa de boda en su página y quiero una invitación así. Ref. BODA-BRISA-BARRA',
		);
	});
});

describe('landing showroom helpers', () => {
	it('reads the event from the location hash only when the showroom has it', () => {
		expect(eventFromHash('#boda', ['xv', 'boda'])).toBe('boda');
		expect(eventFromHash('#tipo-evento', ['xv', 'boda'])).toBeUndefined();
		expect(eventFromHash('', ['xv'])).toBeUndefined();
	});

	it('counts whole days to the event and never goes negative', () => {
		const now = new Date(2026, 9, 23, 18, 30);
		expect(daysUntil('2026-10-24', now)).toBe(1);
		expect(daysUntil('2026-10-23', now)).toBe(0);
		expect(daysUntil('2026-01-01', now)).toBe(0);
	});

	it('swaps the WhatsApp text and keeps the link host', () => {
		const base = 'https://celebra-me.com/';
		expect(withWhatsAppText('/api/whatsapp?text=Hola', 'Ref. XV', base)).toBe(
			'/api/whatsapp?text=Ref.+XV',
		);
		expect(withWhatsAppText('https://wa.me/521?text=Hola', 'Adiós', base)).toBe(
			'https://wa.me/521?text=Adi%C3%B3s',
		);
	});
});

describe('demo sitemap pages', () => {
	it('lists exactly the featured, approved demos of the catalog', () => {
		const expected = DEMO_INVITATIONS.filter(
			(demo) =>
				demo.showroom?.visibility === 'featured' &&
				demo.showroom?.reviewStatus === 'approved',
		)
			.map((demo) => demo.routeSlug)
			.sort();
		const listed = listFeaturedDemoRouteSlugs(
			path.join(process.cwd(), 'src/invitations/demos'),
		);
		expect(listed).toEqual(expected);
		expect(listed).not.toContain('jardin-de-luz');
	});
});
