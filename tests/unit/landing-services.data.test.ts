import { landingData } from '@/data/landing-page.data';
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

		expect(hero.title).toBe('Con pases y confirmación, personalizada para cada invitado');
		expect(hero.primaryCtaLabel).toBe('Cotizar mi invitación');
		expect(hero.secondaryCtaLabel).toBe('Ver demos de invitaciones');
		expect(hero.secondaryCtaUrl).toBe('#tipo-evento');

		expect(services.title).toBe('Todo claro para sus invitados, todo bajo control para usted');
		expect(services.items).toHaveLength(4);
		expect(services.cta.label).toBe('Quiero cotizar por WhatsApp');
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
		expect(expressValue(atelier)).toBe('No aplica');
		expect(landingData.pricing.extras.items.join(' ')).toContain(expressPrice);
	});

	it('keeps the compact high-intent FAQ and process steps', () => {
		expect(landingData.faq.faqs).toHaveLength(6);
		expect(landingData.howItWorks.steps).toHaveLength(4);
	});
});
