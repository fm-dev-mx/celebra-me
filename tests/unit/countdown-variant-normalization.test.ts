import { normalizeInvitationVariantInput } from '@/lib/invitation/variant-normalization';

describe('countdown variant normalization', () => {
	it('defaults theme-named countdown styles to standard (no theme→skin map)', () => {
		const themeNamed = [
			'editorial',
			'editorial-rose',
			'premiere-floral',
			'editorial-magazine',
			'jewelry-box',
			'jewelry-box-wedding',
			'enchanted-rose',
			'luxury-hacienda',
			'celestial-blue',
			'angelic-presence',
			'sacred-keepsake',
		];

		for (const legacy of themeNamed) {
			const normalized = normalizeInvitationVariantInput({
				theme: { preset: 'editorial' },
				hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
				countdown: { title: 'Cuenta' },
				sectionStyles: { countdown: { variant: legacy } },
			}) as { countdown: { variant: string } };

			expect(normalized.countdown.variant).toBe('standard');
		}
	});

	it('defaults omitted countdown variant to standard, never theme.preset', () => {
		const normalized = normalizeInvitationVariantInput({
			theme: { preset: 'premiere-floral' },
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			countdown: { title: 'Cuenta' },
		}) as { countdown: { variant: string } };

		expect(normalized.countdown.variant).toBe('standard');
	});

	it('preserves canonical semantic countdown skins', () => {
		const normalized = normalizeInvitationVariantInput({
			theme: { preset: 'celestial-blue' },
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			countdown: { title: 'Cuenta', variant: 'hacienda-ornament' },
		}) as { countdown: { variant: string } };

		expect(normalized.countdown.variant).toBe('hacienda-ornament');
	});
});

describe('gallery variant normalization', () => {
	it('defaults omitted gallery variant to uniform-grid', () => {
		const normalized = normalizeInvitationVariantInput({
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			gallery: { photos: [] },
		}) as { gallery: { variant: string } };

		expect(normalized.gallery.variant).toBe('uniform-grid');
	});

	it('maps single to single-keepsake', () => {
		const normalized = normalizeInvitationVariantInput({
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			gallery: { photos: [], variant: 'single' },
		}) as { gallery: { variant: string } };

		expect(normalized.gallery.variant).toBe('single-keepsake');
	});

	it('does not invent magazine-spread from editorial-magazine preset', () => {
		const normalized = normalizeInvitationVariantInput({
			theme: { preset: 'editorial-magazine' },
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			gallery: { photos: [] },
		}) as { gallery: { variant: string; presentationOptions?: { mobileBrowse?: string } } };

		expect(normalized.gallery.variant).toBe('uniform-grid');
		expect(normalized.gallery.presentationOptions?.mobileBrowse).toBeUndefined();
	});

	it('defaults alba-rosa-quinonez profile to feature-stack', () => {
		const normalized = normalizeInvitationVariantInput({
			visualProfileId: 'alba-rosa-quinonez',
			hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
			gallery: { photos: [] },
		}) as { gallery: { variant: string } };

		expect(normalized.gallery.variant).toBe('feature-stack');
	});

	it('throws conflict error on conflicting canonical and legacy variants', () => {
		expect(() =>
			normalizeInvitationVariantInput({
				hero: { name: 'Test', date: '2026-01-01T00:00:00.000Z', backgroundImage: 'hero' },
				gallery: { photos: [], variant: 'masonry-editorial' },
				sectionStyles: { gallery: { variant: 'uniform-grid' } },
			}),
		).toThrow();
	});
});
