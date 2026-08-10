import {
	XARENI_SEAL_COLORS,
	XARENI_SEAL_COLOR_LABELS,
	resolveLocationMediaMode,
	shouldRenderFamilyMedia,
	supportsEnvelopeSealColorOptions,
} from '@/lib/invitation/presentation-options';
import { ENVELOPE_SEAL_COLORS, isEnvelopeSealColor } from '@/lib/invitation/reveal-card';
import { ENVELOPE_SEAL_COLOR_LABELS } from '@/lib/intake/labels';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import fs from 'node:fs';
import path from 'node:path';

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
		'xv-xareni-iyarit',
		false,
	);
}

describe('Xareni presentation options', () => {
	it('keeps legacy exports as aliases of the canonical Envelope/editor owners', () => {
		expect(XARENI_SEAL_COLORS).toBe(ENVELOPE_SEAL_COLORS);
		expect(XARENI_SEAL_COLOR_LABELS).toBe(ENVELOPE_SEAL_COLOR_LABELS);
		expect(isEnvelopeSealColor('roseGold')).toBe(true);
		expect(isEnvelopeSealColor('var(--anything-from-editor)')).toBe(false);
	});

	describe('seal accent ownership', () => {
		it('keeps generic theme scoped styles free of Xareni token names', () => {
			const result = buildEnvelopeStyles();

			expect(result.scopedStyles).not.toContain('--xareni-');
			expect(result.scopedStyles).not.toContain('--env-seal-accent');
			expect(result.scopedStyles).not.toContain('--env-seal-icon-override');
		});

		it('maps seal skins to Xareni tokens inside the invitation profile boundary', () => {
			const profile = fs.readFileSync(
				path.join(process.cwd(), 'src/styles/invitation-profiles/xareni-iyarit.scss'),
				'utf8',
			);

			expect(profile).toContain("data-seal-skin='roseGold'");
			expect(profile).toContain('--env-seal-accent: var(--xareni-rose-gold)');
			expect(profile).toContain('--env-seal-accent: var(--xareni-champagne)');
			expect(profile).toContain('--env-seal-accent: var(--xareni-blush)');
			expect(profile).toContain('--env-seal-accent: var(--xareni-mauve)');
			expect(profile).toContain('--env-seal-accent: var(--xareni-deep-mauve)');
			expect(profile).toContain('--env-seal-icon-override:');
		});
	});

	describe('end-to-end page context', () => {
		it('preserves sealColor for profile CSS without injecting Xareni tokens into scoped styles', () => {
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

			expect(viewModel.envelope.data?.sealColor).toBe('mauve');
			expect(viewModel.envelope.data?.colors?.sealAccent).toBeUndefined();

			const pageContext = buildPageContextFromViewModel({
				viewModel,
				slug: 'xareni-client-slug',
				eventType: 'xv',
				isPreview: true,
			});

			expect(pageContext.wrapper.scopedStyles).not.toContain('--xareni-');
			expect(pageContext.envelope?.sealColor).toBe('mauve');
		});
	});

	describe('supportsEnvelopeSealColorOptions', () => {
		it('treats seal colors as a generic envelope capability', () => {
			expect(supportsEnvelopeSealColorOptions()).toBe(true);
			expect(supportsEnvelopeSealColorOptions({ assetLookupSlug: 'xv-xareni-iyarit' })).toBe(
				true,
			);
			expect(
				supportsEnvelopeSealColorOptions({ assetLookupSlug: 'demo-xv-celestial-blue' }),
			).toBe(true);
			expect(supportsEnvelopeSealColorOptions({ assetLookupSlug: 'any-slug' })).toBe(true);
		});
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
