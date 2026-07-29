import { describe, expect, it } from '@jest/globals';
import {
	applySectionValue,
	buildSectionSaveValue,
	getDirtySectionKey,
	getSectionValue,
	mergeSectionSaveValue,
} from '@/lib/intake/services/section-content-mapper';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { InvitationEditorSectionSchemas } from '@/lib/intake/schemas/invitation-editor.schema';

describe('getDirtySectionKey / getSectionValue', () => {
	it.each([
		['title', 'main'],
		['description', 'main'],
		['hero', 'main'],
		['quote', 'messages'],
		['thankYou', 'messages'],
		['sectionOrder', 'publication'],
		['eventTiming', 'location'],
		['envelope', 'envelope'],
		['gallery', 'gallery'],
	] as const)('maps dirty key %s → %s', (key, section) => {
		expect(getDirtySectionKey(key)).toBe(section);
	});

	it('builds compound location and messages section values', () => {
		const content: DraftContent = {
			title: 'Sample event',
			description: 'Sample description',
			hero: { name: 'Honoree' },
			quote: { text: 'Sample quote' },
			thankYou: { message: 'Sample thanks' },
			location: { introHeading: 'Venues' },
			eventTiming: {
				localDateTime: '2026-09-11T20:00',
				timeZone: 'America/Mazatlan',
			},
			sectionOrder: ['quote', 'rsvp'],
		};

		expect(getSectionValue(content, 'main')).toEqual({
			title: 'Sample event',
			description: 'Sample description',
			hero: { name: 'Honoree' },
		});
		expect(getSectionValue(content, 'messages')).toEqual({
			quote: { text: 'Sample quote' },
			thankYou: { message: 'Sample thanks' },
		});
		expect(getSectionValue(content, 'location')).toEqual({
			introHeading: 'Venues',
			eventTiming: {
				localDateTime: '2026-09-11T20:00',
				timeZone: 'America/Mazatlan',
			},
		});
		expect(getSectionValue(content, 'publication')).toEqual({
			sectionOrder: ['quote', 'rsvp'],
		});
	});
});

describe('buildSectionSaveValue', () => {
	const ENVELOPE_NAME = 'Honoree';
	const BASE_TOOLTIP = 'Open invitation';
	const UPDATED_TOOLTIP = 'Open invitation now';
	const MICROCOPY = 'Sample microcopy';
	const SEAL_INITIALS = 'H·F';

	const baseline: DraftContent = {
		envelope: {
			envelopeName: ENVELOPE_NAME,
			tooltipText: BASE_TOOLTIP,
			microcopy: MICROCOPY,
			sealInitials: SEAL_INITIALS,
		},
		itinerary: { title: 'Sample itinerary', items: [] },
	};

	it('preserves untouched envelope fields when only tooltipText changes', () => {
		const current: DraftContent = {
			...baseline,
			envelope: {
				...baseline.envelope,
				tooltipText: UPDATED_TOOLTIP,
			},
		};

		const saved = buildSectionSaveValue(baseline, current, 'envelope') as Record<
			string,
			unknown
		>;

		expect(saved).toEqual({
			envelopeName: ENVELOPE_NAME,
			tooltipText: UPDATED_TOOLTIP,
			microcopy: MICROCOPY,
			sealInitials: SEAL_INITIALS,
		});
	});

	it('returns the baseline section value when nothing changed', () => {
		expect(mergeSectionSaveValue(baseline.envelope, baseline.envelope)).toEqual(
			baseline.envelope,
		);
	});

	it('overlays a nested hero leaf while preserving sibling hero fields', () => {
		const HERO_LABEL = 'Sample occasion';
		const FOCAL = '68% 42%';
		const FOCAL_MOBILE = '50% 26%';
		const base: DraftContent = {
			title: 'Sample event',
			description: 'Sample description',
			hero: {
				name: 'Honoree',
				label: HERO_LABEL,
				focalPoint: FOCAL,
				focalPointMobile: FOCAL_MOBILE,
			},
		};
		const UPDATED_NAME = 'Honoree Updated';
		const current: DraftContent = {
			...base,
			hero: {
				...base.hero,
				name: UPDATED_NAME,
			},
		};

		const saved = buildSectionSaveValue(base, current, 'main') as {
			hero: Record<string, unknown>;
		};

		expect(saved.hero.name).toBe(UPDATED_NAME);
		expect(saved.hero.label).toBe(base.hero?.label);
		expect(saved.hero.focalPoint).toBe(base.hero?.focalPoint);
		expect(saved.hero.focalPointMobile).toBe(base.hero?.focalPointMobile);
	});

	it('preserves composite messages siblings when only thankYou changes', () => {
		const CLOSING_PHRASE = 'Sample closing';
		const UPDATED_MESSAGE = 'Updated thank-you';
		const base: DraftContent = {
			quote: { text: 'Sample quote', author: 'Sample author' },
			thankYou: {
				message: 'Sample thank-you',
				closingName: 'Honoree',
				closingPhrase: CLOSING_PHRASE,
			},
		};
		const current: DraftContent = {
			...base,
			thankYou: { ...base.thankYou, message: UPDATED_MESSAGE },
		};

		const saved = buildSectionSaveValue(base, current, 'messages') as {
			quote: unknown;
			thankYou: Record<string, unknown>;
		};

		expect(saved.quote).toEqual(base.quote);
		expect(saved.thankYou.message).toBe(UPDATED_MESSAGE);
		expect(saved.thankYou.closingName).toBe(base.thankYou?.closingName);
		expect(saved.thankYou.closingPhrase).toBe(CLOSING_PHRASE);
	});

	it('preserves location siblings when only eventTiming changes', () => {
		const INTRO = 'Sample intro';
		const VENUE = 'Sample venue';
		const UPDATED_LOCAL = '2026-09-11T21:00';
		const base: DraftContent = {
			location: {
				introEyebrow: INTRO,
				reception: { venueName: VENUE },
			},
			eventTiming: {
				localDateTime: '2026-09-11T20:00',
				timeZone: 'America/Mexico_City',
			},
		};
		const current: DraftContent = {
			...base,
			eventTiming: {
				localDateTime: UPDATED_LOCAL,
				timeZone: 'America/Mexico_City',
			},
		};

		const saved = buildSectionSaveValue(base, current, 'location') as Record<string, unknown>;

		expect(saved.introEyebrow).toBe(base.location?.introEyebrow);
		expect(saved.reception).toEqual(base.location?.reception);
		expect(saved.eventTiming).toEqual(current.eventTiming);
	});

	it('replaces gallery.items wholesale when the array changes', () => {
		const base: DraftContent = {
			gallery: {
				title: 'Sample gallery',
				items: [{ image: { type: 'internal', key: 'gallery01' }, alt: 'Item A' }],
			},
		};
		const current: DraftContent = {
			gallery: {
				title: 'Sample gallery',
				items: [
					{ image: { type: 'internal', key: 'gallery02' }, alt: 'Item B' },
					{ image: { type: 'internal', key: 'gallery03' }, alt: 'Item C' },
				],
			},
		};

		expect(buildSectionSaveValue(base, current, 'gallery')).toEqual(current.gallery);
	});

	it('replaces itinerary.items wholesale when the array changes', () => {
		const base: DraftContent = {
			itinerary: {
				title: 'Sample program',
				items: [{ iconName: 'Calendar', label: 'Item one', time: '20:00' }],
			},
		};
		const current: DraftContent = {
			itinerary: {
				title: 'Sample program',
				items: [
					{ iconName: 'Calendar', label: 'Item one', time: '20:00' },
					{ iconName: 'Cake', label: 'Item two', time: '22:00' },
				],
			},
		};

		expect(buildSectionSaveValue(base, current, 'itinerary')).toEqual(current.itinerary);
	});

	it('deletes keys removed in the editor and adds new keys', () => {
		const PREMIUM_TEASER = 'Sample teaser';
		const base: DraftContent = {
			envelope: {
				envelopeName: ENVELOPE_NAME,
				tooltipText: BASE_TOOLTIP,
				microcopy: MICROCOPY,
			},
		};
		const current: DraftContent = {
			envelope: {
				envelopeName: ENVELOPE_NAME,
				teaserDetails: PREMIUM_TEASER,
			},
		};

		const saved = buildSectionSaveValue(base, current, 'envelope') as Record<string, unknown>;
		expect(saved).toEqual({
			envelopeName: ENVELOPE_NAME,
			teaserDetails: PREMIUM_TEASER,
		});
		expect(saved).not.toHaveProperty('tooltipText');
		expect(saved).not.toHaveProperty('microcopy');
	});

	it('treats empty string, whitespace, and omitted optional text as canonically equal', () => {
		expect(mergeSectionSaveValue({ tooltipText: '' }, { tooltipText: '   ' })).toEqual({
			tooltipText: '',
		});
		expect(mergeSectionSaveValue({ tooltipText: '' }, {})).toEqual({ tooltipText: '' });
		expect(mergeSectionSaveValue({}, { tooltipText: '' })).toEqual({});
	});

	it('round-trips applySectionValue without touching unrelated sections', () => {
		const base: DraftContent = {
			envelope: { envelopeName: ENVELOPE_NAME, tooltipText: BASE_TOOLTIP },
			itinerary: { title: 'Sample itinerary', items: [] },
			gallery: { title: 'Sample gallery', items: [] },
		};
		const current: DraftContent = {
			...base,
			envelope: { ...base.envelope, tooltipText: UPDATED_TOOLTIP },
		};
		const saved = buildSectionSaveValue(base, current, 'envelope');
		const next = applySectionValue(base, 'envelope', saved);

		expect(next.envelope).toEqual({
			envelopeName: ENVELOPE_NAME,
			tooltipText: UPDATED_TOOLTIP,
		});
		expect(next.itinerary).toEqual(base.itinerary);
		expect(next.gallery).toEqual(base.gallery);
	});

	it('preserves premium teaserDetails through a tooltip-only edit and Zod envelope strict parse', () => {
		const PREMIUM_TEASER = 'Sample teaser';
		const REVEAL = 'editorial-cover' as const;
		const base: DraftContent = {
			envelope: {
				envelopeName: ENVELOPE_NAME,
				tooltipText: BASE_TOOLTIP,
				teaserDetails: PREMIUM_TEASER,
				sealInitials: SEAL_INITIALS,
				revealVariant: REVEAL,
			},
		};
		const current: DraftContent = {
			envelope: {
				...base.envelope,
				tooltipText: UPDATED_TOOLTIP,
			},
		};

		const saved = buildSectionSaveValue(base, current, 'envelope');
		const parsed = InvitationEditorSectionSchemas.envelope.safeParse(saved);

		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.teaserDetails).toBe(base.envelope?.teaserDetails);
			expect(parsed.data.revealVariant).toBe(REVEAL);
			expect(parsed.data.tooltipText).toBe(UPDATED_TOOLTIP);
			expect(parsed.data.sealInitials).toBe(base.envelope?.sealInitials);
		}
	});
});
