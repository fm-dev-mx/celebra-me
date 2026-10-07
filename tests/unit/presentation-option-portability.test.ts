/**
 * Portability and incompatibility contract for three typed presentation options:
 * - location.presentationOptions.indicationsStyle ('list' | 'numbered-board')
 * - gallery.variantOptions.arrangement ('stacked' | 'overlap', paired-portraits only)
 * - the 'pattern-band' section intersection family
 * - hero.presentation.designCredit (editorial-cover credit line, on by default)
 *
 * Each option is exercised on synthetic jewelry-box content with no visual profile, so none of
 * them depends on a client profile or slug. Defaults must leave existing content unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { SECTION_INTERSECTION_FAMILIES } from '@/lib/theme/theme-contract';
import {
	buildSyntheticVariantEvent,
	type SyntheticVariantOverrides,
} from '../fixtures/structural-variants/synthetic-variant-fixtures';

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

type EventInput = Parameters<typeof adaptEvent>[0];

// Type-safe JSON shape for in-memory patches; the schema parse below is the real contract.
type PatchableContent = {
	visualProfileId?: string;
	sectionOrder?: string[];
	composition?: {
		intersections?: Record<string, { family: string; source: string }>;
		[key: string]: unknown;
	};
	location: {
		presentationOptions?: Record<string, unknown>;
		venues: Array<{ coordinates?: { lat: number; lng: number }; [key: string]: unknown }>;
		[key: string]: unknown;
	};
	gallery: {
		variantOptions?: Record<string, unknown>;
		[key: string]: unknown;
	};
	hero: {
		presentation?: Record<string, unknown>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

function synthetic(
	section: SyntheticVariantOverrides['section'],
	variant: string,
	patch: (data: PatchableContent) => void,
) {
	const candidate = buildSyntheticVariantEvent({ section, variant, themePreset: 'jewelry-box' });
	const data = structuredClone(candidate.data) as PatchableContent;
	delete data.visualProfileId;
	patch(data);
	return { ...candidate, data };
}

function adapt(candidate: { id: string; data: Record<string, unknown> }) {
	const parsed = eventContentSchema.parse(candidate.data);
	return adaptEvent({ ...candidate, data: parsed } as EventInput);
}

function readSource(relativePath: string) {
	return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('location indicationsStyle', () => {
	it('defaults to the list layout for existing content', () => {
		const view = adapt(synthetic('location', 'standard', () => {}));
		expect(view.sections.location?.indicationsStyle).toBe('list');
	});

	it('ports numbered-board to any location variant without a profile', () => {
		for (const variant of ['standard', 'split-map']) {
			const view = adapt(
				synthetic('location', variant, (data) => {
					data.location.presentationOptions = { indicationsStyle: 'numbered-board' };
					if (variant === 'split-map') {
						data.location.venues[0].coordinates = { lat: 25.67, lng: -100.31 };
					}
				}),
			);
			expect(view.sections.location?.indicationsStyle).toBe('numbered-board');
		}
	});

	it('rejects unknown indications styles', () => {
		const candidate = synthetic('location', 'standard', (data) => {
			data.location.presentationOptions = { indicationsStyle: 'pit-board' };
		});
		const result = eventContentSchema.safeParse(candidate.data);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(
				expect.arrayContaining(['location', 'presentationOptions', 'indicationsStyle']),
			);
		}
	});

	it('keeps the board styles isolated behind the typed attribute', () => {
		const markup = readSource('src/components/invitation/EventLocation.astro');
		expect(markup).toContain('data-indications-style={indicationsStyle}');
		const styles = readSource('src/styles/invitation/_location-indications.scss');
		expect(styles).toContain("[data-indications-style='numbered-board']");
		// The ordinal spacing rule must not outrank profiles that lay the spans out themselves.
		expect(styles).toContain(':where(.event-location__indication-title)');
		expect(styles).not.toMatch(/event--|aithan/);
	});
});

describe('paired-portraits arrangement', () => {
	it('accepts overlap on paired-portraits and keeps stacked as the default', () => {
		const stacked = adapt(synthetic('gallery', 'paired-portraits', () => {}));
		expect(stacked.sections.gallery?.variantOptions?.arrangement).toBeUndefined();

		const overlap = adapt(
			synthetic('gallery', 'paired-portraits', (data) => {
				data.gallery.variantOptions = { arrangement: 'overlap' };
			}),
		);
		expect(overlap.sections.gallery?.variant).toBe('paired-portraits');
		expect(overlap.sections.gallery?.variantOptions).toEqual({ arrangement: 'overlap' });
	});

	it('rejects an arrangement on any other gallery variant', () => {
		const candidate = synthetic('gallery', 'uniform-grid', (data) => {
			data.gallery.variantOptions = { arrangement: 'overlap' };
		});
		const result = eventContentSchema.safeParse(candidate.data);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(issue) =>
						issue.path.join('.') === 'gallery.variantOptions.arrangement' &&
						issue.message.includes('only valid for paired-portraits'),
				),
			).toBe(true);
		}
	});

	it('never upscales a print past its native width', () => {
		const styles = readSource('src/styles/themes/sections/gallery/_paired-portraits.scss');
		expect(styles).toContain("[data-arrangement='overlap']");
		expect(styles).toContain('var(--gallery-item-native-width, 100%)');
		expect(readSource('src/components/invitation/PhotoGallery.astro')).toContain(
			'--gallery-item-native-width',
		);
	});
});

describe('pattern-band intersection family', () => {
	it('is part of the closed intersection family set', () => {
		expect(SECTION_INTERSECTION_FAMILIES).toContain('pattern-band');
	});

	it('is selected only through typed composition and copied into the render plan', () => {
		const view = adapt(
			synthetic('location', 'standard', (data) => {
				data.sectionOrder = ['countdown', 'location'];
				data.composition = {
					intersections: { location: { family: 'pattern-band', source: 'countdown' } },
				};
			}),
		);
		const plan = buildInvitationRenderPlan(view);
		expect(plan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'section',
					section: 'location',
					intersection: { family: 'pattern-band', source: 'countdown' },
				}),
			]),
		);
	});

	it('rejects unknown families', () => {
		const candidate = synthetic('location', 'standard', (data) => {
			data.composition = {
				intersections: { location: { family: 'checker-flag', source: 'countdown' } },
			};
		});
		expect(eventContentSchema.safeParse(candidate.data).success).toBe(false);
	});

	it('reserves its height statically and stays generic', () => {
		const styles = readSource('src/styles/invitation/_section-intersections.scss');
		expect(styles).toContain("[data-intersection='pattern-band']");
		expect(styles).toContain('padding-top: var(--intersection-band-height)');
		expect(styles).not.toMatch(/event--|aithan/);
	});
});

describe('editorial-cover design credit', () => {
	it('keeps the credit unless content disables it', () => {
		const shown = adapt(synthetic('hero', 'editorial-cover', () => {}));
		expect(shown.hero.designCredit).toBeUndefined();

		const hidden = adapt(
			synthetic('hero', 'editorial-cover', (data) => {
				data.hero.presentation = { ...(data.hero.presentation ?? {}), designCredit: false };
			}),
		);
		expect(hidden.hero.designCredit).toBe(false);
		expect(readSource('src/components/invitation/EditorialCoverHero.astro')).toContain(
			'designCredit = true',
		);
	});
});
