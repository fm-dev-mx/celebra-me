import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import { resolveBrandingVisibility } from '@/lib/adapters/branding';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('adaptEvent', () => {
	it('defaults Celebra-me branding visibility on when no branding config is present', () => {
		expect(resolveBrandingVisibility({ isDemo: false })).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('keeps demo Celebra-me branding visible even when hiding is configured', () => {
		expect(
			resolveBrandingVisibility({
				isDemo: true,
				branding: { hideCelebraMeBranding: true },
			}),
		).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('hides all Celebra-me branding surfaces for live events with the product flag enabled', () => {
		expect(
			resolveBrandingVisibility({
				isDemo: false,
				branding: { hideCelebraMeBranding: true },
			}),
		).toEqual({
			showFooterBranding: false,
			showContactCta: false,
			showThankYouBranding: false,
		});
	});

	it('resolves current branding visibility exceptions from event content', () => {
		const cases = [
			{
				slug: 'cesar-ramses',
				expected: {
					showFooterBranding: false,
					showContactCta: false,
					showThankYouBranding: false,
				},
			},
			{
				slug: 'ana-sofia-cota-guillen',
				expected: {
					showFooterBranding: true,
					showContactCta: true,
					showThankYouBranding: true,
				},
			},
			{
				slug: 'gerardo-sesenta',
				expected: {
					showFooterBranding: true,
					showContactCta: true,
					showThankYouBranding: true,
				},
			},
			{
				slug: 'ximena-meza-trasvina',
				expected: {
					showFooterBranding: true,
					showContactCta: true,
					showThankYouBranding: true,
				},
			},
		];

		for (const { slug, expected } of cases) {
			const event = {
				id: `events/${slug}`,
				data: loadFixture(`src/content/events/${slug}.json`),
			} as Parameters<typeof adaptEvent>[0];

			expect(adaptEvent(event).brandingVisibility).toEqual(expected);
		}
	});

	it('keeps demo event branding visible even if demo content accidentally configures hiding', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				branding: {
					hideCelebraMeBranding: true,
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		expect(adaptEvent(event).brandingVisibility).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('preserves family godparents in the invitation view model', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toEqual([
			{ name: 'Sr. Juan Carlos', role: 'Padrino de Honor' },
			{ name: 'Sra. Ana María', role: 'Madrina de Honor' },
		]);
	});

	it('keeps godparents undefined when the event omits them', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				family: {
					...fixture.family,
					godparents: undefined,
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toBeUndefined();
	});

	it('resolves Ximena content blocks and reception-only venue data', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('premiere-floral');
		expect(viewModel.sections.location?.ceremony).toBeUndefined();
		expect(viewModel.sections.location?.reception?.venueName).toBe("D'Galaz Alberca y Eventos");
		expect(viewModel.sections.location?.variant).toBe('premiere-floral');
		expect(viewModel.interludes?.find((i) => i.afterSection === 'location')).toMatchObject({
			height: 'screen',
		});
		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
	});

	it('supports normalized object asset references from the schema layer', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				hero: {
					...fixture.hero,
					backgroundImage: {
						type: 'internal',
						key: 'hero',
					},
					portrait: {
						type: 'external',
						src: '/images/custom-portrait.webp',
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
		expect(viewModel.hero.portrait?.src).toBe('/images/custom-portrait.webp');
	});

	it('preserves thank-you overlay composition metadata', () => {
		const fixture = loadFixture(
			'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
		);
		const event = {
			id: 'event-demos/bautismo/demo-bautismo-angelic-presence',
			data: {
				...fixture,
				thankYou: {
					...fixture.thankYou,
					overlayAnchor: 'left',
					overlaySafeArea: {
						x: 0.5,
						y: 0.08,
						width: 0.34,
						height: 0.42,
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.thankYou).toMatchObject({
			overlayAnchor: 'left',
			overlaySafeArea: {
				x: 0.5,
				y: 0.08,
				width: 0.34,
				height: 0.42,
			},
		});
	});

	it('preserves explicit interlude variants for editorial content blocks', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-editorial',
			data: loadFixture('src/content/event-demos/xv/demo-xv-editorial.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('editorial');
		expect(viewModel.interludes?.find((i) => i.variant === 'editorial')).toMatchObject({
			variant: 'editorial',
		});
	});

	it('throws for invalid theme presets instead of silently falling back', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				theme: {
					...fixture.theme,
					preset: 'broken-preset',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		expect(() => adaptEvent(event)).toThrow(
			'[ThemePreset] Invalid preset "broken-preset". Expected one of:',
		);
	});
});
