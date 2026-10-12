import {
	DESIGN_SCHEMA_VERSION,
	extractDesignAttributes,
} from '@/lib/rsvp/engagement/design-attributes';

describe('snapshot design attributes', () => {
	it('captures theme, rendered sections, variants, music, and RSVP mode', () => {
		const design = extractDesignAttributes({
			title: 'XV de Ana',
			theme: { preset: 'jewelry-box', fontFamily: 'serif' },
			templateId: 'xv-jewelry-box',
			sectionOrder: ['quote', 'countdown', 'gallery', 'gifts', 'rsvp', 'personalizedAccess'],
			quote: { text: 'Hola' },
			countdown: { variant: 'flip' },
			gallery: { variant: 'masonry', items: [] },
			rsvp: {
				variant: 'card',
				accessMode: 'personalized-only',
				confirmationMode: 'api',
				personalizedAccess: { variant: 'envelope' },
			},
			music: { url: 'https://cdn.example.com/song.mp3', autoPlay: true },
			hero: { name: 'Ana', date: '2026-12-05T00:00:00Z' },
		});
		expect(DESIGN_SCHEMA_VERSION).toBe(1);
		expect(design).toEqual({
			themePreset: 'jewelry-box',
			fontFamily: 'serif',
			templateId: 'xv-jewelry-box',
			visualProfileId: null,
			sections: ['quote', 'countdown', 'gallery', 'rsvp', 'personalizedAccess'],
			sectionVariants: {
				countdown: 'flip',
				gallery: 'masonry',
				rsvp: 'card',
				personalizedAccess: 'envelope',
			},
			personalizedAccessVariant: 'envelope',
			music: { enabled: true, autoPlay: true },
			rsvp: { accessMode: 'personalized-only', confirmationMode: 'api' },
		});
	});

	it('never carries guest or free-text content', () => {
		const design = extractDesignAttributes({
			sectionOrder: ['family'],
			family: { parents: ['Nombre Privado'] },
			hero: { name: 'Nombre Privado' },
		});
		expect(JSON.stringify(design)).not.toContain('Nombre Privado');
	});

	it('returns null for non-object content', () => {
		expect(extractDesignAttributes(null)).toBeNull();
		expect(extractDesignAttributes('content')).toBeNull();
	});
});
