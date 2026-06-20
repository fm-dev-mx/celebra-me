import {
	resolveLocationMediaMode,
	resolveXareniSealColor,
	shouldRenderFamilyMedia,
	supportsXareniPresentationOptions,
} from '@/lib/invitation/presentation-options';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';

describe('Xareni presentation options', () => {
	it('maps allowed seal colors to trusted Xareni theme tokens', () => {
		expect(resolveXareniSealColor('roseGold')).toBe('var(--xareni-rose-gold)');
		expect(resolveXareniSealColor('champagne')).toBe('var(--xareni-champagne)');
	});

	it('does not resolve raw CSS seal color input', () => {
		expect(resolveXareniSealColor('#c9a36a')).toBeUndefined();
		expect(resolveXareniSealColor('var(--anything-from-editor)')).toBeUndefined();
		expect(resolveXareniSealColor('linear-gradient(red, blue)')).toBeUndefined();
	});

	it('emits seal accent styles only from the trusted adapter value', () => {
		const result = generateThemeScopedStyles(
			{ preset: 'celestial-blue', themeClass: 'theme-preset--celestial-blue' },
			{
				enabled: true,
				data: {
					sealStyle: 'wax',
					microcopy: 'Toca para abrir',
					name: 'Xareni',
					teaserDetails: '25 abr 2026',
					card: {
						label: 'XV Años',
						primaryName: 'Xareni',
						date: '25 · ABR · 2026',
						guestLabel: 'Entrega especial para:',
					},
					colors: { sealAccent: resolveXareniSealColor('roseGold') },
				},
			},
			'xv-xareni-iyarit',
			false,
		);

		expect(result.scopedStyles).toContain('--env-seal-accent: var(--xareni-rose-gold);');
		expect(result.scopedStyles).not.toContain('#c9a36a');
	});

	it('emits the seal accent variable through the preview and published page context path', () => {
		const viewModel = adaptDbEvent({
			slug: 'xareni-client-slug',
			eventType: 'xv',
			isDemo: false,
			assetSlug: 'xv-xareni-iyarit',
			content: {
				eventType: 'xv',
				title: 'XV años de Xareni Iyarit',
				theme: { preset: 'celestial-blue' },
				_assetSlug: 'xv-xareni-iyarit',
				hero: {
					name: 'Xareni Iyarit',
					label: 'Mis XV años',
					date: '2026-09-13T01:00:00.000Z',
					backgroundImage: 'hero',
				},
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					sealIcon: 'flower',
					sealInitials: 'X·I',
					sealVariant: 'premium-rose',
					sealColor: 'mauve',
					microcopy: 'Toca para abrir mi invitación',
				},
			},
		});

		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: 'xareni-client-slug',
			eventType: 'xv',
			isPreview: true,
		});

		expect(pageContext.wrapper.scopedStyles).toContain(
			'--env-seal-accent: var(--xareni-mauve);',
		);
		expect(pageContext.wrapper.scopedStyles).toContain(
			'[data-event-slug="xareni-client-slug"]',
		);
	});

	it('limits editor-only Xareni options to the Xareni asset context', () => {
		expect(supportsXareniPresentationOptions({ assetLookupSlug: 'xv-xareni-iyarit' })).toBe(
			true,
		);
		expect(
			supportsXareniPresentationOptions({ assetLookupSlug: 'demo-xv-celestial-blue' }),
		).toBe(false);
	});
});

describe('section presentation media helpers', () => {
	it('suppresses family media only for text-only presentation', () => {
		expect(shouldRenderFamilyMedia('text-only', true)).toBe(false);
		expect(shouldRenderFamilyMedia('with-photo', true)).toBe(true);
		expect(shouldRenderFamilyMedia(undefined, true)).toBe(true);
		expect(shouldRenderFamilyMedia(undefined, false)).toBe(false);
	});

	it('suppresses location media for simple presentation', () => {
		expect(resolveLocationMediaMode('simple', { hasCoordinates: true, hasImage: true })).toBe(
			'none',
		);
	});

	it('prefers requested location media and falls back gracefully', () => {
		expect(resolveLocationMediaMode('with-map', { hasCoordinates: true, hasImage: true })).toBe(
			'map',
		);
		expect(
			resolveLocationMediaMode('with-photo', { hasCoordinates: true, hasImage: true }),
		).toBe('image');
		expect(
			resolveLocationMediaMode('with-map', { hasCoordinates: false, hasImage: true }),
		).toBe('image');
		expect(
			resolveLocationMediaMode('with-photo', { hasCoordinates: true, hasImage: false }),
		).toBe('map');
		expect(
			resolveLocationMediaMode(undefined, { hasCoordinates: false, hasImage: false }),
		).toBe('none');
	});
});
