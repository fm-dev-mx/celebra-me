import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import {
	resolveCountdownVisibleUnits,
	resolveGalleryMobileBrowse,
	resolveGiftsPresentation,
	resolveLocationMediaMode,
	resolveLocationShowNavigationButtons,
} from '@/lib/invitation/presentation-options';
import { countdownSchema } from '@/lib/schemas/content/shared.schema';
import { giftsSchema } from '@/lib/schemas/content/gifts.schema';
import { gallerySchema } from '@/lib/schemas/content/gallery.schema';
import { buildEventContentData } from '../helpers/event-content-fixture';

jest.mock('@/lib/assets/asset-registry', () => {
	const actual = jest.requireActual('@/lib/assets/asset-registry');
	return {
		...actual,
		getEventAsset: jest.fn(() => ({
			src: '/test-asset.webp',
			width: 1,
			height: 1,
			format: 'webp',
		})),
	};
});

function readSource(relativePath: string) {
	return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Goal C — presentation options', () => {
	describe('countdown visibleUnits', () => {
		it('defaults to all units when absent', () => {
			expect(resolveCountdownVisibleUnits(undefined)).toEqual([
				'days',
				'hours',
				'minutes',
				'seconds',
			]);
			expect(resolveCountdownVisibleUnits({})).toEqual([
				'days',
				'hours',
				'minutes',
				'seconds',
			]);
		});

		it('accepts a non-empty subset and rejects empty arrays at schema boundary', () => {
			expect(resolveCountdownVisibleUnits({ visibleUnits: ['days'] })).toEqual(['days']);
				expect(
					countdownSchema.safeParse({
						variant: 'standard',
						title: 'FALTAN',
					presentationOptions: { visibleUnits: ['days'] },
				}).success,
			).toBe(true);
				expect(
					countdownSchema.safeParse({
						variant: 'standard',
						title: 'FALTAN',
					presentationOptions: { visibleUnits: [] },
				}).success,
			).toBe(false);
		});

		it('adapts Alba days-only without profile ownership of unit hiding', () => {
			const data = buildEventContentData({
				eventType: 'xv',
				title: 'Alba portability',
				theme: { preset: 'luxury-hacienda' },
				hero: {
					name: 'Alba',
					date: '2026-11-20T18:00:00.000Z',
					backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				},
				countdown: {
					variant: 'standard',
					title: 'FALTAN',
					presentationOptions: { visibleUnits: ['days'] },
				},
				eventTiming: {
					localDateTime: '2026-11-20T18:00',
					timeZone: 'America/Mexico_City',
				},
			});
			const viewModel = adaptEvent({
				id: 'event-demos/xv/portability-countdown',
				data,
			} as Parameters<typeof adaptEvent>[0]);

			expect(viewModel.sections.countdown?.visibleUnits).toEqual(['days']);
			expect(viewModel.theme.preset).toBe('luxury-hacienda');

			const albaProfile = readSource(
				'src/styles/invitation-profiles/alba-rosa-quinonez.scss',
			);
			expect(albaProfile).not.toContain(".countdown__segment:not([data-unit='days'])");
		});
	});

	describe('gifts legend-only', () => {
		it('defaults to catalog and keeps section omission distinct', () => {
			expect(resolveGiftsPresentation(undefined)).toBe('catalog');
			expect(resolveGiftsPresentation('legend-only')).toBe('legend-only');

			const omitted = buildEventContentData({
				eventType: 'xv',
				title: 'No gifts',
				theme: { preset: 'jewelry-box' },
				hero: {
					name: 'Lucía',
					date: '2026-11-21T18:00:00.000Z',
					backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				},
			});
			expect(
				adaptEvent({
					id: 'event-demos/xv/no-gifts',
					data: omitted,
				} as Parameters<typeof adaptEvent>[0]).sections.gifts,
			).toBeUndefined();
		});

		it('allows legend-only without catalog items and rejects items with legend-only', () => {
			expect(
				giftsSchema.safeParse({
					variant: 'standard',
					title: 'Regalos',
					subtitle: 'Su presencia es el mejor regalo.',
					presentation: 'legend-only',
				}).success,
			).toBe(true);
			expect(
				giftsSchema.safeParse({
					variant: 'standard',
					presentation: 'legend-only',
					items: [{ type: 'cash', title: 'Stub' }],
				}).success,
			).toBe(false);
		});

		it('adapts legend-only under a non-origin theme without gift grid items', () => {
			const data = buildEventContentData({
				eventType: 'xv',
				title: 'Legend portability',
				theme: { preset: 'celestial-blue' },
				hero: {
					name: 'Lucía',
					date: '2026-11-21T18:00:00.000Z',
					backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				},
				gifts: {
					title: 'Regalos',
					subtitle: 'Su presencia es el mejor regalo.',
					presentation: 'legend-only',
				},
			});
			const gifts = adaptEvent({
				id: 'event-demos/xv/portability-gifts',
				data,
			} as Parameters<typeof adaptEvent>[0]).sections.gifts;

			expect(gifts?.presentation).toBe('legend-only');
			expect(gifts?.items).toEqual([]);
			expect(gifts?.subtitle).toContain('presencia');

			const albaProfile = readSource(
				'src/styles/invitation-profiles/alba-rosa-quinonez.scss',
			);
			expect(albaProfile).not.toMatch(/\.gifts-grid\s*\{\s*display:\s*none/);
		});
	});

	describe('location map-preview reclassification', () => {
		it('is already expressed by presentation=simple + showNavigationButtons=false', () => {
			expect(
				resolveLocationMediaMode('simple', { hasCoordinates: false, hasImage: false }),
			).toBe('none');
			expect(resolveLocationShowNavigationButtons({ showNavigationButtons: false })).toBe(
				false,
			);

			const daniela = readSource('scripts/provision/invitations/daniela-y-martin.ts');
			expect(daniela).toContain("presentation: 'simple'");
			expect(daniela).toContain('showNavigationButtons: false');
			expect(daniela).not.toMatch(
				/mapPreview|map-preview-type|presentation:\s*'map-preview'/,
			);
		});
	});

	describe('gallery mobileBrowse rail', () => {
		it('defaults to stack and accepts rail', () => {
			expect(resolveGalleryMobileBrowse(undefined)).toBe('stack');
			expect(resolveGalleryMobileBrowse({ mobileBrowse: 'rail' })).toBe('rail');
			expect(
				gallerySchema.safeParse({
					title: 'Galería',
					variant: 'magazine-spread',
					presentationOptions: { mobileBrowse: 'rail' },
					items: [{ image: { type: 'external', src: 'https://example.com/a.webp' } }],
				}).success,
			).toBe(true);
			expect(
				gallerySchema.safeParse({
					title: 'Galería',
					presentationOptions: { mobileBrowse: 'carousel' },
					items: [{ image: { type: 'external', src: 'https://example.com/a.webp' } }],
				}).success,
			).toBe(false);
		});

		it('adapts rail under non-origin magazine content and keeps structure in canonical CSS', () => {
			const data = buildEventContentData({
				eventType: 'xv',
				title: 'Rail portability',
				theme: { preset: 'jewelry-box' },
				hero: {
					name: 'Lucía',
					date: '2026-11-21T18:00:00.000Z',
					backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				},
				gallery: {
					title: 'Galería',
					variant: 'magazine-spread',
					presentationOptions: { mobileBrowse: 'rail' },
					items: [
						{ image: { type: 'external', src: 'https://example.com/a.webp' } },
						{ image: { type: 'external', src: 'https://example.com/b.webp' } },
					],
				},
			});
			const gallery = adaptEvent({
				id: 'event-demos/xv/portability-gallery-rail',
				data,
			} as Parameters<typeof adaptEvent>[0]).sections.gallery;

			expect(gallery?.variant).toBe('magazine-spread');
			expect(gallery?.mobileBrowse).toBe('rail');
			expect(gallery?.variant).not.toBe('valentina-hernandez');

			const canonical = readSource(
				'src/styles/themes/sections/gallery/_magazine-spread.scss',
			);
			const valentina = readSource('src/styles/invitation-profiles/valentina-hernandez.scss');
			expect(canonical).toContain("data-mobile-browse='rail'");
			expect(canonical).toContain('scroll-snap-type: x mandatory');
			expect(canonical).toContain('min-width: 0');
			expect(canonical).toContain('align-items: flex-start');
			expect(canonical).toContain('overflow: visible');
			expect(canonical).toContain('aspect-ratio: 3 / 4');
			expect(canonical).toContain('height: auto');
			expect(valentina).not.toContain('scroll-snap-type: x mandatory');
		});
	});
});
