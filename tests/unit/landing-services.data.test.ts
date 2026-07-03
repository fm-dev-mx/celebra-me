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
	const match = sanitized.match(
		/export\s+const\s+landingData\s*:?\s*[\w.]+\s*=\s*(\{[\s\S]*?\})\s*;/,
	);
	if (!match) {
		throw new Error('Could not extract landingData from source');
	}

	// Evaluate the extracted object literal in a safe sandbox.
	// new Function avoids the issues with eval() while still being safe
	// for a known test-time data file.
	return new Function('return ' + match[1])();
}

describe('landing services product value data', () => {
	it('frames Services as product value instead of event demo discovery', () => {
		const landingData = loadLandingData();
		const services = landingData.services;
		const hero = landingData.hero;

		// Hero fields (changed in this changeset)
		expect(hero.title).toBe('El primer recuerdo de su gran día');
		expect(hero.subtitle).toBe(
			'Invitaciones digitales diseñadas para compartir su historia con cada invitado.',
		);
		expect(hero.primaryCtaLabel).toBe('Agendar asesoría');
		expect(hero.whatsappMessage).toBe(
			'¡Hola! Quisiera información sobre sus invitaciones digitales para celebrar mi evento. ¿Podrían asesorarme?',
		);
		expect(hero.socialProofText).toBe('Más de 500 familias confían en nosotros');
		expect(hero.secondaryCtaLabel).toBe('Ver demos');
		expect(hero.secondaryCtaUrl).toBe('#tipo-evento');

		// Services block assertions
		expect(services.title).toBe('Qué incluye tu invitación digital');
		expect(services.items).toHaveLength(4);
		expect(services.cta.label).toBe('Solicitar asesoría');
		expect(services.cta.href).toBe('#contacto');
	});
});
