import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('reveal gate automation contract', () => {
	const componentSource = readSource('src/components/invitation/EnvelopeReveal.astro');
	const managerSource = readSource('src/lib/invitation/reveal-manager.ts');
	const routeSource = readSource('src/pages/[eventType]/[slug].astro');

	it('completes the reveal through a bounded fallback when animationend never fires', () => {
		expect(componentSource).toContain('resolveCardRiseFallbackMs');
		expect(componentSource).toContain('CARD_RISE_FALLBACK_FLOOR_MS');
		expect(componentSource).toContain('CARD_RISE_FALLBACK_MARGIN_MS');

		const clickHandler =
			componentSource.match(
				/openButton\?\.addEventListener\('click'[\s\S]*?\n\t{3}\}\);/u,
			)?.[0] ?? '';

		// The animationend listener must be paired with a timer so a non-firing or interrupted
		// envCardRise animation cannot strand the invitation at data-reveal-state="sealed".
		expect(clickHandler).toContain("addEventListener('animationend', onAnimationEnd)");
		expect(clickHandler).toContain('resolveCardRiseFallbackMs(revealCard)');
		expect(clickHandler).toContain('window.clearTimeout(fallbackTimer)');
	});

	it('guards against repeated open clicks stacking listeners and timers', () => {
		expect(componentSource).toContain('let isOpening = false;');
		expect(componentSource).toContain('if (isOpening) return;');
	});

	it('keeps the documented reveal-state vocabulary', () => {
		expect(componentSource).toContain("revealState = 'revealed'");
		expect(componentSource).toContain("revealState = 'letter-held'");
		expect(componentSource).toContain("revealState = 'preview-opened'");
	});

	it('keeps the documented server-side skipEnvelope bypass', () => {
		expect(routeSource).toContain("Astro.url.searchParams.get('skipEnvelope') === 'true'");
		expect(routeSource).toContain("{ 'data-reveal-state': 'revealed' }");
	});

	it('only honours the reveal parameter under screenshot mode', () => {
		expect(routeSource).toContain("screenshotMode && revealState === 'open'");
		expect(routeSource).toContain("screenshotMode && revealState === 'letter'");
	});

	it('keeps the documented bypass parameters and storage key', () => {
		expect(managerSource).toContain("params.get('skipEnvelope') === 'true'");
		expect(managerSource).toContain("params.get('forceEnvelope') !== 'true'");
		expect(managerSource).toContain('`envelope-opened-${this.eventSlug}`');
	});

	it('never applies the stored open flag to demo invitations', () => {
		expect(managerSource).toContain('if (this.isDemoInvitation) return;');
		expect(managerSource).toContain('!this.isDemoInvitation &&');
	});
});
