import { summarizeContentUsage } from '../../scripts/provision/content-usage-audit.ts';

describe('summarizeContentUsage', () => {
	it('reports selectors, asset namespaces and superseded shapes without mutating the document', () => {
		const content = {
			templateId: 'xv-celestial-blue',
			_assetSlug: 'demo-xv-celestial-blue',
			visualProfileId: 'demo-xv-celestial-blue',
			isDemo: true,
			theme: { preset: 'celestial-blue', fontFamily: 'serif' },
			sectionOrder: ['quote', 'location', 'rsvp'],
			hero: {
				variant: 'standard',
				date: '2027-09-12T19:00:00.000Z',
				backgroundImage: { type: 'internal', key: 'hero' },
				portrait: 'portrait',
				presentation: { venueIndex: 1 },
			},
			quote: { text: '' },
			location: {
				variant: 'split-map',
				visibility: 'public',
				venues: [{ id: 'venue_legacy_1', eventType: 'xv' }],
			},
			gallery: {
				variant: 'feature-stack',
				items: [
					{ image: { type: 'internal', key: 'gallery01' } },
					{
						image: {
							type: 'uploaded',
							assetId: '11111111-1111-4111-8111-111111111111',
						},
					},
				],
			},
			gifts: { variant: 'standard', items: [{ type: 'store', url: 'https://example.com' }] },
			rsvp: { variant: 'standard', personalizedAccess: { variant: 'ornamented' } },
			envelope: {
				revealVariant: 'celestial-blue',
				sealStyle: 'wax',
				closedPalette: { background: 'surfacePrimary' },
			},
		};
		const before = JSON.stringify(content);

		const usage = summarizeContentUsage(content);

		expect(JSON.stringify(content)).toBe(before);
		expect(usage).toMatchObject({
			themePreset: 'celestial-blue',
			assetSlug: 'demo-xv-celestial-blue',
			visualProfileId: 'demo-xv-celestial-blue',
			isDemo: true,
			sectionOrder: ['quote', 'location', 'rsvp'],
		});
		expect(usage.variants).toEqual({
			hero: 'standard',
			location: 'split-map',
			gallery: 'feature-stack',
			gifts: 'standard',
			rsvp: 'standard',
			personalizedAccess: 'ornamented',
			'envelope.revealVariant': 'celestial-blue',
			'envelope.sealStyle': 'wax',
		});
		expect(usage.assets).toEqual({
			internal: 2,
			external: 0,
			uploaded: 1,
			shorthand: 1,
			internalKeys: ['gallery01', 'hero'],
			shorthandPaths: ['hero.portrait'],
		});
		expect(usage.supersededShapes).toEqual({
			templateId: ['templateId'],
			'theme.fontFamily': ['theme.fontFamily'],
			'quote.text=""': ['quote.text'],
			'gifts.items[].url': ['gifts.items[0].url'],
			'location.visibility': ['location.visibility'],
			'location.venues[].eventType': ['location.venues[0].eventType'],
			'location.venues[].id=venue_legacy_*': ['location.venues[0].id'],
		});
		expect(usage.facts).toMatchObject({
			'hero.portrait': true,
			'hero.presentation.venueIndex': 1,
			eventTiming: false,
			'location.accessPolicy': false,
		});
	});

	it('reports the canonical schema verdict with issue paths', () => {
		const usage = summarizeContentUsage({ sectionStyles: { location: {} } });

		expect(usage.strictParse.ok).toBe(false);
		expect(usage.strictParse.issues.length).toBeGreaterThan(0);
		expect(usage.supersededShapes).toEqual({ sectionStyles: ['sectionStyles'] });
	});
});
