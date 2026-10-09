/**
 * Portability and incompatibility contract for typed presentation options:
 * - location.presentationOptions.indicationsStyle ('list' | 'numbered-board')
 * - gallery.variantOptions.arrangement ('stacked' | 'overlap', paired-portraits only)
 * - the 'pattern-band' section intersection family
 * - hero.presentation.designCredit (editorial-cover credit line, on by default)
 * - location.ornament and thankYou.ornament (decorative cutouts, absent by default)
 * - envelope.coverEditionLabel (collector rail label, "NÚM." by default)
 * - envelope.coverOrnament / spreadOrnaments and the editorial-cover hero.ornament and
 *   hero.accentOrnament (absent by default)
 * - gifts.ornament (decorative cutout above the gifts heading, absent by default)
 * - rsvp.personalizedAccess.presentationOptions.passStyle ('classic' | 'race-credential',
 *   formal-pass only)
 * - music.fadeInSeconds (volume ramp on start and loop, 1.2 s by default)
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
	envelope?: Record<string, unknown>;
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

describe('editorial-cover edition label', () => {
	it('keeps the "NÚM." rail label unless content sets one', () => {
		const view = adapt(
			synthetic('hero', 'editorial-cover', (data) => {
				data.envelope = {
					...(data.envelope ?? {}),
					revealVariant: 'editorial-cover',
					coverEdition: 'XV',
				};
			}),
		);
		expect(view.envelope.data?.coverEdition).toBe('XV');
		expect(view.envelope.data?.coverEditionLabel).toBeUndefined();
	});

	it('ports an empty label (edition printed alone) and a custom label without a profile', () => {
		for (const label of ['', 'EDICIÓN']) {
			const view = adapt(
				synthetic('hero', 'editorial-cover', (data) => {
					data.envelope = {
						...(data.envelope ?? {}),
						revealVariant: 'editorial-cover',
						coverExperience: 'collector',
						coverEdition: '3 años',
						coverEditionLabel: label,
					};
				}),
			);
			expect(view.envelope.data?.coverEditionLabel).toBe(label);
		}
	});

	it('rejects labels longer than the rail allows', () => {
		const candidate = synthetic('hero', 'editorial-cover', (data) => {
			data.envelope = {
				...(data.envelope ?? {}),
				revealVariant: 'editorial-cover',
				coverEdition: '3 años',
				coverEditionLabel: 'x'.repeat(17),
			};
		});
		expect(eventContentSchema.safeParse(candidate.data).success).toBe(false);
	});

	it('keeps the mark and footer sizing tokens free of profile selectors', () => {
		for (const file of [
			'src/styles/themes/sections/hero/_editorial-cover.scss',
			'src/styles/invitation/_editorial-cover-collector.scss',
			'src/styles/themes/sections/footer/_editorial.scss',
		]) {
			expect(readSource(file)).not.toMatch(/event--|aithan/);
		}
	});
});

describe('decorative section ornaments', () => {
	it('adds nothing to existing location and thank-you content', () => {
		const location = adapt(synthetic('location', 'standard', () => {}));
		expect(location.sections.location?.ornament).toBeUndefined();
		const thankYou = adapt(synthetic('thankYou', 'editorial-back-cover', () => {}));
		expect(thankYou.sections.thankYou?.ornament).toBeUndefined();
	});

	it('adds nothing to the collector cover or the editorial-cover hero by default', () => {
		const view = adapt(
			synthetic('hero', 'editorial-cover', (data) => {
				data.envelope = {
					...(data.envelope ?? {}),
					revealVariant: 'editorial-cover',
					coverExperience: 'collector',
				};
			}),
		);
		expect(view.envelope.data?.coverOrnament).toBeUndefined();
		expect(view.envelope.data?.spreadOrnaments).toBeUndefined();
		expect(view.hero.ornament).toBeUndefined();
		expect(view.hero.accentOrnament).toBeUndefined();
	});

	it('resolves cover, spread and hero ornaments without a profile and caps the spread at two', () => {
		const view = adapt(
			synthetic('hero', 'editorial-cover', (data) => {
				data.hero.ornament = { type: 'external', src: '/emblem.webp' };
				data.hero.accentOrnament = { type: 'external', src: '/accent.webp' };
				data.envelope = {
					...(data.envelope ?? {}),
					revealVariant: 'editorial-cover',
					coverExperience: 'collector',
					coverOrnament: { type: 'external', src: '/cover-a.webp' },
					spreadOrnaments: [
						{ type: 'external', src: '/spread-1.webp' },
						{ type: 'external', src: '/spread-2.webp' },
					],
				};
			}),
		);
		expect(String(view.hero.ornament?.src)).toContain('emblem.webp');
		expect(String(view.hero.accentOrnament?.src)).toContain('accent.webp');
		expect(String(view.envelope.data?.coverOrnament?.src)).toContain('cover-a.webp');
		expect(view.envelope.data?.spreadOrnaments?.map((asset) => String(asset.src))).toEqual([
			'/spread-1.webp',
			'/spread-2.webp',
		]);

		const tooMany = synthetic('hero', 'editorial-cover', (data) => {
			data.envelope = {
				...(data.envelope ?? {}),
				spreadOrnaments: [
					{ type: 'external', src: '/1.webp' },
					{ type: 'external', src: '/2.webp' },
					{ type: 'external', src: '/3.webp' },
				],
			};
		});
		expect(eventContentSchema.safeParse(tooMany.data).success).toBe(false);
	});

	it('resolves a location and thank-you ornament without a profile', () => {
		const location = adapt(
			synthetic('location', 'standard', (data) => {
				data.location.ornament = { type: 'external', src: '/ornament-a.webp' };
			}),
		);
		expect(String(location.sections.location?.ornament?.src)).toContain('ornament-a.webp');

		const thankYou = adapt(
			synthetic('thankYou', 'editorial-back-cover', (data) => {
				(data.thankYou as Record<string, unknown>).ornament = {
					type: 'external',
					src: '/ornament-b.webp',
				};
			}),
		);
		expect(String(thankYou.sections.thankYou?.ornament?.src)).toContain('ornament-b.webp');
	});

	it('keeps the cutout styles free of profile selectors', () => {
		for (const file of [
			'src/styles/invitation/_event-location.scss',
			'src/styles/invitation/_thank-you.scss',
			'src/styles/themes/sections/countdown/_magazine-folio.scss',
			'src/styles/invitation/_editorial-cover-collector.scss',
			'src/styles/themes/sections/hero/_editorial-cover.scss',
		]) {
			expect(readSource(file)).not.toMatch(/event--|aithan/);
		}
	});
});

describe('gifts ornament', () => {
	it('adds nothing to existing gifts content', () => {
		const view = adapt(synthetic('gifts', 'standard', () => {}));
		expect(view.sections.gifts?.ornament).toBeUndefined();
	});

	it('resolves an ornament on a legend-only gifts section without a profile', () => {
		const view = adapt(
			synthetic('gifts', 'standard', (data) => {
				const gifts = data.gifts as Record<string, unknown>;
				gifts.presentation = 'legend-only';
				delete gifts.items;
				gifts.ornament = { type: 'external', src: '/gift-ornament.webp' };
			}),
		);
		expect(view.sections.gifts?.presentation).toBe('legend-only');
		expect(String(view.sections.gifts?.ornament?.src)).toContain('gift-ornament.webp');
	});

	it('keeps the cutout styles free of profile selectors', () => {
		const markup = readSource('src/components/invitation/Gifts.astro');
		expect(markup).toContain('gifts-section__ornament');
		expect(readSource('src/styles/invitation/_gifts.scss')).not.toMatch(/event--|aithan/);
	});
});

describe('personalized access passStyle', () => {
	type RsvpPatch = { personalizedAccess: Record<string, unknown> };

	it('defaults to the classic pass for existing content', () => {
		const view = adapt(synthetic('personalizedAccess', 'formal-pass', () => {}));
		expect(view.sections.rsvp?.personalizedAccess.passStyle).toBe('classic');
	});

	it('ports race-credential to the formal pass without a profile', () => {
		const view = adapt(
			synthetic('personalizedAccess', 'formal-pass', (data) => {
				(data.rsvp as RsvpPatch).personalizedAccess.presentationOptions = {
					passStyle: 'race-credential',
				};
			}),
		);
		expect(view.sections.rsvp?.personalizedAccess.passStyle).toBe('race-credential');
	});

	it('rejects race-credential on a variant that does not implement it', () => {
		const candidate = synthetic('personalizedAccess', 'standard', (data) => {
			(data.rsvp as RsvpPatch).personalizedAccess.presentationOptions = {
				passStyle: 'race-credential',
			};
		});
		const result = eventContentSchema.safeParse(candidate.data);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(
				expect.arrayContaining(['personalizedAccess', 'presentationOptions', 'passStyle']),
			);
		}
	});

	it('keeps the credential styles isolated behind the typed attribute', () => {
		const markup = readSource('src/components/invitation/PersonalizedAccess.astro');
		expect(markup).toContain(
			"data-pass-style={isRaceCredential ? 'race-credential' : undefined}",
		);
		const styles = readSource(
			'src/styles/themes/sections/personalized-access/_formal-pass.scss',
		);
		expect(styles).toContain("[data-pass-style='race-credential']");
		expect(styles).not.toMatch(/event--|aithan/);
	});
});

describe('music fadeInSeconds', () => {
	it('is absent by default and passes through when set', () => {
		const base = adapt(synthetic('location', 'standard', () => {}));
		expect(base.music?.fadeInSeconds).toBeUndefined();

		const view = adapt(
			synthetic('location', 'standard', (data) => {
				data.music = {
					url: 'https://example.com/track.mp3',
					startAt: 49,
					fadeInSeconds: 3,
				};
			}),
		);
		expect(view.music).toMatchObject({ startAt: 49, fadeInSeconds: 3 });
	});

	it('rejects ramps longer than ten seconds', () => {
		const candidate = synthetic('location', 'standard', (data) => {
			data.music = { url: 'https://example.com/track.mp3', fadeInSeconds: 30 };
		});
		expect(eventContentSchema.safeParse(candidate.data).success).toBe(false);
	});
});
