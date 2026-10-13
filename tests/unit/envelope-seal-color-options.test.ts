import { supportsEnvelopeSealColorOptions } from '@/lib/invitation/presentation-options';
import { ENVELOPE_SEAL_COLORS, isEnvelopeSealColor } from '@/lib/invitation/reveal-card';
import { ENVELOPE_SEAL_COLOR_LABELS } from '@/lib/intake/labels';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';

function buildEnvelopeStyles(sealAccent?: string) {
	return generateThemeScopedStyles(
		{ preset: 'celestial-blue', themeClass: 'theme-preset--celestial-blue' },
		{
			enabled: true,
			data: {
				sealStyle: 'wax',
				microcopy: 'Toca para abrir',
				name: 'Test',
				teaserDetails: '25 abr 2026',
				card: {
					label: 'XV Años',
					primaryName: 'Test',
					date: '25 · ABR · 2026',
					guestLabel: 'Entrega especial para:',
				},
				colors: sealAccent ? { sealAccent } : {},
			},
		},
		'xv-client-slug',
		false,
	);
}

describe('Envelope seal color options', () => {
	it('uses the canonical Envelope/editor contracts', () => {
		expect(ENVELOPE_SEAL_COLORS).toContain('roseGold');
		expect(ENVELOPE_SEAL_COLOR_LABELS.roseGold).toBe('Oro rosado');
		expect(isEnvelopeSealColor('roseGold')).toBe(true);
		expect(isEnvelopeSealColor('var(--anything-from-editor)')).toBe(false);
	});

	describe('seal accent ownership', () => {
		it('keeps generic theme scoped styles free of profile token names', () => {
			const result = buildEnvelopeStyles();

			expect(result.scopedStyles).not.toContain('--client-');
			expect(result.scopedStyles).not.toContain('--env-seal-accent');
			expect(result.scopedStyles).not.toContain('--env-seal-icon-override');
		});
	});

	describe('end-to-end page context', () => {
		it('preserves sealColor for profile CSS without injecting profile tokens into scoped styles', () => {
			const viewModel = adaptDbEvent({
				slug: 'client-slug',
				eventType: 'xv',
				isDemo: false,
				assetSlug: 'demo-xv-celestial-blue',
				content: {
					eventType: 'xv',
					title: 'XV años de Sofía',
					theme: { preset: 'celestial-blue' },
					sectionOrder: ['quote'],
					composition: { intersections: {} },
					_assetSlug: 'demo-xv-celestial-blue',
					hero: {
						name: 'Sofía',
						label: 'Mis XV años',
						date: '2026-09-13T01:00:00.000Z',
						backgroundImage: 'hero',
						variant: 'standard',
					},
					envelope: {
						disabled: false,
						sealStyle: 'wax',
						sealIcon: 'flower',
						sealInitials: 'S',
						sealVariant: 'premium-rose',
						sealColor: 'mauve',
						microcopy: 'Toca para abrir mi invitación',
					},
				},
			});

			expect(viewModel.envelope.data?.sealColor).toBe('mauve');
			expect(viewModel.envelope.data?.colors?.sealAccent).toBeUndefined();

			const pageContext = buildPageContextFromViewModel({
				viewModel,
				slug: 'client-slug',
				eventType: 'xv',
			});

			expect(pageContext.wrapper.scopedStyles).not.toContain('--client-');
			expect(pageContext.envelope?.sealColor).toBe('mauve');
		});
	});

	describe('supportsEnvelopeSealColorOptions', () => {
		it('treats seal colors as a generic envelope capability', () => {
			expect(supportsEnvelopeSealColorOptions()).toBe(true);
			expect(supportsEnvelopeSealColorOptions({ assetLookupSlug: 'xv-client-slug' })).toBe(
				true,
			);
			expect(
				supportsEnvelopeSealColorOptions({ assetLookupSlug: 'demo-xv-celestial-blue' }),
			).toBe(true);
			expect(supportsEnvelopeSealColorOptions({ assetLookupSlug: 'any-slug' })).toBe(true);
		});
	});
});
