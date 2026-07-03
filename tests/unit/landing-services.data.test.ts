import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load the real landingData from the source file.
 * We read + sanitize the source instead of using a direct import because
 * Jest's parser cannot handle import.meta.env expressions in the source.
 * Only import.meta.env.* is replaced; the actual data object is the real
 * source content, not a mock.
 */
function loadLandingData() {
	const source = readFileSync(join(process.cwd(), 'src/data/landing-page.data.ts'), 'utf8');

	// Strip import.meta.env expressions — only whatsappPhone uses it,
	// with fallback '521000000000'. This avoids Jest parse errors while
	// keeping the rest of the source data intact.
	const sanitized = source.replace(/import\.meta\.env\.\w+/g, "'521000000000'");

	// Extract the exported landingData object literal.
	// Format: export const landingData: LandingPageData = { ... };
	// Brace-balanced capture: matches { ... } where the body contains no
	// bare `{` or `}` outside of single/double-quoted strings. This avoids
	// the non-greedy `*?` trap where a future string containing `};` would
	// prematurely terminate the match.
	const match = sanitized.match(
		/export\s+const\s+landingData\s*:?\s*[\w.]+\s*=\s*(\{(?:[^{}]|'[^']*'|"[^"]*")+\})\s*;/,
	);
	if (!match) {
		throw new Error('Could not extract landingData from source');
	}

	// Evaluate the extracted object literal via new Function. This is NOT a
	// security sandbox — it runs in the global scope of the Node process
	// and relies on the source file being a trusted data file under our
	// control. If the source ever comes from untrusted input, replace this
	// with a proper TS loader.
	return new Function('return ' + match[1])();
}

describe('landing services product value data', () => {
	it('frames Services as product value instead of event demo discovery', () => {
		const landingData = loadLandingData();
		const services = landingData.services;
		const hero = landingData.hero;

		// Hero fields (changed in this changeset)
		expect(hero.title).toBe(
			'Invitaciones digitales premium con RSVP y control de invitados',
		);
		expect(hero.subtitle).toBe(
			'Experiencia personalizada para tu evento: confirmaciones en tiempo real, pases digitales y envío por WhatsApp.',
		);
		expect(hero.primaryCtaLabel).toBe('Cotizar por WhatsApp');
		expect(hero.whatsappMessage).toContain('Cupón: LANZAMIENTO-899');
		expect(hero.socialProofText).toBe('Acompañamiento personalizado para eventos especiales');
		expect(hero.secondaryCtaLabel).toBe('Ver demos reales');
		expect(hero.secondaryCtaUrl).toBe('#tipo-evento');

		// Services block assertions
		expect(services.title).toBe('Incluido en tu invitación');
		expect(services.items).toHaveLength(4);
		expect(services.cta.label).toBe('Resolver dudas por WhatsApp');
		expect(services.cta.href).toBe('#contacto');
	});

	it('publishes the launch promo price and compact high-intent FAQ', () => {
		const landingData = loadLandingData();

		expect(landingData.pricing.title).toBe('Paquetes claros');
		expect(landingData.pricing.note).toContain('Promo base: $899 MXN');
		expect(landingData.pricing.tiers[0].price.amount).toBe('899');
		expect(landingData.pricing.tiers[1].price.amount).toBe('1,499');
		expect(landingData.pricing.tiers[2].price.amount).toBe('2,299');
		expect(landingData.pricing.tiers[0].regularPrice).toBe('Precio regular: $1,299 MXN');
		expect(landingData.pricing.tiers[0].ctaMessage).toContain('Cupón: LANZAMIENTO-899');
		expect(landingData.faq.faqs).toHaveLength(6);
		expect(landingData.howItWorks.steps).toHaveLength(3);
	});
});
