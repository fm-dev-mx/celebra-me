import { landingData } from '@/data/landing-page.data';
import { CLIENT_TESTIMONIALS } from '@/data/testimonials.data';
import {
	formatMxn,
	getExpressDelivery,
	getCatalogPackage,
	PACKAGE_CATALOG,
} from '@/data/promo-campaign.data';

describe('landing product value data', () => {
	it('states the hero promise without repeating the WhatsApp scene', () => {
		const hero = landingData.hero;

		expect(hero.title).toBe('Invitaciones con pase y confirmación para cada invitado');
		expect(hero.title).toContain(hero.titleEmphasis);
		expect(hero.mobileSubtitle).toBe(
			'La diseñamos para su evento; usted la comparte desde su panel.',
		);
		expect(hero.eyebrow).toBe('Invitaciones digitales');
		expect(hero.paymentNote).toBe('Sin anticipo: pague al recibir su invitación terminada.');

		// The envelope scene carries the guest features; the section that repeated them is gone.
		expect('guestExperience' in landingData).toBe(false);
		expect('services' in landingData).toBe(false);
	});

	it('describes the guest panel with the labels the dashboard uses', () => {
		const features = landingData.productProof.features;

		expect(features.map((feature) => feature.title)).toEqual([
			'Lista desde Excel',
			'Envío por WhatsApp',
			'Vistas y confirmaciones',
			'Exportación',
		]);
		expect(JSON.stringify(landingData.productProof)).not.toMatch(/Abiertas/);
	});
});

describe('landing package catalog', () => {
	it('lists Esencial, Signature (recommended) and Atelier in screen order', () => {
		const { tiers } = landingData.pricing;

		expect(tiers.map((tier) => tier.packageId)).toEqual(PACKAGE_CATALOG.map((pkg) => pkg.id));
		expect(tiers.map((tier) => getCatalogPackage(tier.packageId).name)).toEqual([
			'Esencial',
			'Signature',
			'Atelier',
		]);
		expect(tiers.filter((tier) => tier.isPrimary).map((tier) => tier.packageId)).toEqual([
			'signature',
		]);
	});

	it('describes upper tiers incrementally and never labels lower tiers as branded', () => {
		const [esencial, signature, atelier] = landingData.pricing.tiers;

		expect(esencial.includesFrom).toBeUndefined();
		expect(signature.includesFrom).toBe('Todo lo de Esencial, más:');
		expect(signature.includes).toContain(
			'QR para que sus invitados compartan fotos y videos del evento',
		);
		expect(atelier.includesFrom).toBe('Todo lo de Signature, más:');
		expect(atelier.includes).toContain('Su invitación a su nombre, sin la firma de Celebra-me');

		const copy = JSON.stringify(landingData.pricing);
		expect(copy).not.toMatch(/con marca|con publicidad/i);
	});

	it('derives the express delivery extra from the promo module', () => {
		const express = getExpressDelivery();
		const expressPrice = `+${formatMxn(express.price)} MXN`;
		const [esencial, signature, atelier] = landingData.pricing.tiers;
		const expressValue = (tier: typeof esencial) =>
			tier.details.find((detail) => detail.label === express.name)?.value;

		expect(expressValue(esencial)).toBe(expressPrice);
		expect(expressValue(signature)).toBe(expressPrice);
		// Atelier already ships in 48 hours, so its card does not repeat the extra.
		expect(expressValue(atelier)).toBeUndefined();
		expect(landingData.pricing.extras).toBeUndefined();
	});

	it('keeps the compact high-intent FAQ and process steps', () => {
		expect(landingData.faq.faqs.map((faq) => faq.question)).toEqual([
			'¿Cómo y cuándo pago?',
			'¿Cuánto tarda?',
			'¿Puedo pedir cambios?',
			'¿La invitación lleva publicidad?',
			'¿Cuánto tiempo estará disponible?',
			'¿Qué necesito enviar?',
		]);
		expect(landingData.howItWorks.steps).toHaveLength(4);
	});
});

describe('landing primary CTA and trust copy', () => {
	it('uses a single primary WhatsApp CTA label', () => {
		const labels = [landingData.hero.primaryCtaLabel, landingData.contact.cta?.label];
		expect(new Set(labels)).toEqual(new Set(['Quiero mi invitación']));
		// The sticky bar covers the middle of the page; those sections carry no button of their own.
		expect('cta' in landingData.productProof).toBe(false);
		expect(landingData.howItWorks.cta).toBeUndefined();
	});

	it('publishes real, anonymous testimonials with a privacy notice', () => {
		const { testimonials, notice } = landingData.testimonials;
		expect(testimonials).toBe(CLIENT_TESTIMONIALS);
		expect(testimonials.length).toBeGreaterThan(0);
		for (const testimonial of testimonials) {
			expect(Object.keys(testimonial).sort()).toEqual(
				testimonial.eventLabel ? ['eventLabel', 'role', 'text'] : ['role', 'text'],
			);
			expect(testimonial.text).not.toMatch(/\p{Extended_Pictographic}/u);
		}
		expect(notice).toBe('Testimonios reales de clientes. Omitimos sus nombres por privacidad.');
	});

	it('introduces the responsible party in the about block', () => {
		expect(landingData.contact.about?.text).toContain('Francisco Mendoza');
		expect(landingData.contact.about?.text).toContain('Los Mochis, Sinaloa');
	});
});
