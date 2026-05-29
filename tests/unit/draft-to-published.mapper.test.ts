import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import type { DemoPreset } from '@/lib/intake/types';

const snapshot: DemoPreset = {
	id: 'demo-xv-jewelry-box',
	eventType: 'xv',
	displayName: 'XV Años — Jewelry Box',
	themeId: 'jewelry-box',
	defaultSections: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'gifts',
		'thankYou',
	],
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	],
	recommendedBlocks: [],
	requiredAssets: ['hero', 'portrait'],
	previewSlug: 'demo-xv-jewelry-box',
};

const baseInput = {
	project: {
		title: 'Test Project',
		eventType: 'xv',
		snapshot,
	},
	draftContent: {
		title: 'Test Title',
		description: 'Test Description',
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
	},
};

describe('mapDraftToPublished', () => {
	it('maps hero section correctly', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.hero).toMatchObject({
			name: 'Ana Sofia',
			label: 'Mis XV Anos',
			date: '2027-11-20',
			backgroundImage: { type: 'internal', key: 'hero' },
			variant: 'jewelry-box',
		});
	});

	it('sets theme from project snapshot', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.theme).toEqual({ preset: 'jewelry-box' });
	});

	it('sets eventType and isDemo from input', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.eventType).toBe('xv');
		expect(result.isDemo).toBe(false);
	});

	it('maps family godparents string to structured array', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
					godparents: 'Pedro — Padrino\nLuisa — Madrina',
				},
			},
		});

		expect(result.family).toMatchObject({
			parents: { father: 'Juan', mother: 'Maria' },
			godparents: [
				{ name: 'Pedro', role: 'Padrino' },
				{ name: 'Luisa', role: 'Madrina' },
			],
		});
	});

	it('maps children string to structured array', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					children: 'Ana\nLuis',
				},
			},
		});

		expect(result.family).toMatchObject({
			children: [{ name: 'Ana' }, { name: 'Luis' }],
		});
	});

	it('maps RSVP fields', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				rsvp: {
					title: 'Confirma',
					guestCap: 4,
					confirmationMode: 'api',
					confirmationMessage: 'Gracias',
				},
			},
		});

		expect(result.rsvp).toMatchObject({
			title: 'Confirma',
			guestCap: 4,
			confirmationMode: 'api',
			confirmationMessage: 'Gracias',
		});
	});

	it('maps music section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				music: { url: 'https://example.com/song.mp3', title: 'My Song' },
			},
		});

		expect(result.music).toMatchObject({
			url: 'https://example.com/song.mp3',
			title: 'My Song',
		});
	});

	it('maps gifts section preserving items', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gifts: {
					title: 'Mesa de regalos',
					subtitle: 'Gracias',
					items: [{ type: 'cash', title: 'Sobres' }],
				},
			},
		});

		expect(result.gifts).toMatchObject({
			title: 'Mesa de regalos',
			subtitle: 'Gracias',
			items: [{ type: 'cash', title: 'Sobres' }],
		});
	});

	it('maps quote section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				quote: { text: 'Una frase', author: 'Autor' },
			},
		});

		expect(result.quote).toMatchObject({ text: 'Una frase', author: 'Autor' });
	});

	it('maps thankYou section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: { message: 'Gracias a todos', closingName: 'Ana Sofia' },
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'Ana Sofia',
		});
	});

	it('maps location with ceremony and reception venues', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
					reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
					dressCode: 'Formal',
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
			reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
			dressCode: 'Formal',
		});
	});

	it('omits sections with empty content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.family).toBeUndefined();
		expect(result.rsvp).toBeUndefined();
		expect(result.music).toBeUndefined();
		expect(result.gifts).toBeUndefined();
		expect(result.quote).toBeUndefined();
		expect(result.thankYou).toBeUndefined();
		expect(result.location).toBeUndefined();
	});
});
