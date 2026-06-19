import { SECTION_COMPOUND_KEYS } from '@/lib/intake/constants';
import { PUBLIC_SECTION_DEFINITIONS } from '@/lib/intake/invitation-section-registry';
import {
	applySectionValue,
	getDirtySectionKey,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';

describe('getDirtySectionKey', () => {
	it('maps title to main', () => {
		expect(getDirtySectionKey('title')).toBe('main');
	});

	it('maps description to main', () => {
		expect(getDirtySectionKey('description')).toBe('main');
	});

	it('maps hero to main', () => {
		expect(getDirtySectionKey('hero')).toBe('main');
	});

	it('maps quote to messages', () => {
		expect(getDirtySectionKey('quote')).toBe('messages');
	});

	it('maps thankYou to messages', () => {
		expect(getDirtySectionKey('thankYou')).toBe('messages');
	});

	it('maps sectionOrder to publication', () => {
		expect(getDirtySectionKey('sectionOrder')).toBe('publication');
	});

	it('maps eventTiming to location', () => {
		expect(getDirtySectionKey('eventTiming')).toBe('location');
	});

	it('passes through single-section keys unchanged', () => {
		expect(getDirtySectionKey('family')).toBe('family');
		expect(getDirtySectionKey('envelope')).toBe('envelope');
		expect(getDirtySectionKey('rsvp')).toBe('rsvp');
		expect(getDirtySectionKey('gallery')).toBe('gallery');
	});
});

describe('SECTION_COMPOUND_KEYS', () => {
	it('includes eventTiming in location compound key', () => {
		expect(SECTION_COMPOUND_KEYS.location).toContain('eventTiming');
	});

	it('includes all expected compound keys', () => {
		expect(SECTION_COMPOUND_KEYS.main).toEqual(['title', 'description', 'hero']);
		expect(SECTION_COMPOUND_KEYS.messages).toEqual(['quote', 'thankYou']);
		expect(SECTION_COMPOUND_KEYS.location).toEqual(['location', 'eventTiming']);
		expect(SECTION_COMPOUND_KEYS.publication).toEqual(['sectionOrder']);
	});
});

describe('invitation-section-registry draftContentKeys', () => {
	it('includes eventTiming in location section draft content keys', () => {
		expect(PUBLIC_SECTION_DEFINITIONS.location.draftContentKeys).toContain('eventTiming');
	});

	it('hero draft content keys match the main compound key', () => {
		expect(PUBLIC_SECTION_DEFINITIONS.hero.draftContentKeys).toEqual([
			...SECTION_COMPOUND_KEYS.main,
		]);
	});
});

describe('applySectionValue location round-trip', () => {
	it('getSectionValue + applySectionValue preserves eventTiming', () => {
		const base = {
			title: 'Test',
			location: { venueName: 'Salón Principal' },
			eventTiming: { localDateTime: '2026-08-01T14:00:00' },
		} as any;

		const sectionValue = getSectionValue(base, 'location');
		const result = applySectionValue(base, 'location', sectionValue);

		expect((result.location as any)?.venueName).toBe('Salón Principal');
		expect((result.eventTiming as any)?.localDateTime).toBe('2026-08-01T14:00:00');
	});
});
