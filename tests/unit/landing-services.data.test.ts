import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import { landingData } from '@/data/landing-page.data';
import { CLIENT_TESTIMONIALS } from '@/data/testimonials.data';
import {
	formatMxn,
	getExpressDelivery,
	getPromoPackage,
	PROMO_CAMPAIGN,
} from '@/data/promo-campaign.data';

describe('landing services product value data', () => {
	it('frames Services as product value instead of event demo discovery', () => {
		const services = landingData.services;
		const hero = landingData.hero;

		expect(hero.title).toBe(
			'Invitaciones digitales con pase y confirmación para cada invitado',
		);
		expect(hero.subtitle).toBe('Usted la envía por WhatsApp y ve quién confirmó.');
		expect(hero.eyebrow).toBeUndefined();
		expect(hero.paymentNote).toBe('Sin anticipo: paga al recibir su invitación terminada.');
		expect(hero.secondaryCtaLabel).toBe('Ver una invitación');
		expect(DEMO_SHOWROOM_ITEMS.some((item) => item.href === hero.secondaryCtaUrl)).toBe(true);

		expect(services.title).toBe('Todo claro para sus invitados, todo bajo control para usted');
		expect(services.items.map((item) => item.title)).toEqual([
			'Agregar al calendario',
			'Google Maps, Waze y Apple Maps',
			'Ubicación al confirmar',
			'Mesa de regalos',
		]);
	});
});

describe('landing package catalog', () => {
	it('lists Esencial, Signature (recommended) and Atelier in screen order', () => {
		const { tiers } = landingData.pricing;

		expect(tiers.map((tier) => tier.packageId)).toEqual(
			PROMO_CAMPAIGN.packages.map((pkg) => pkg.id),
		);
		expect(tiers.map((tier) => getPromoPackage(tier.packageId).name)).toEqual([
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
		expect(signature.includes).toContain('QR de recuerdos');
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
		const labels = [
			landingData.hero.primaryCtaLabel,
			landingData.productProof.cta.label,
			landingData.services.cta.label,
			landingData.guestExperience.cta.label,
			landingData.howItWorks.cta?.label,
			landingData.contact.cta?.label,
		];
		expect(new Set(labels)).toEqual(new Set(['Cotizar por WhatsApp']));
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
