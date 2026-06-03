jest.mock('astro:content', () => ({
	getCollection: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	upsertDraft: jest.fn(),
	updateDraftContentConditionally: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventByInvitationIdService: jest.fn(),
	findEventBySlugService: jest.fn(),
	updateEventService: jest.fn(),
}));

import { getCollection } from 'astro:content';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findEventByInvitationIdService,
	findEventBySlugService,
} from '@/lib/rsvp/repositories/event.repository';
import {
	getInvitationEditorContext,
	restoreInvitationEditorFromPublished,
	saveInvitationEditorSection,
} from '@/lib/intake/services/invitation-editor.service';

const invitation = {
	id: 'proj-1',
	kind: 'client',
	sourceInvitationId: null,
	slug: 'ana',
	title: 'XV Ana',
	eventType: 'xv',
	status: 'published',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		displayName: 'Demo',
		themeId: 'jewelry-box',
		defaultSections: ['quote', 'itinerary', 'gallery'],
		supportedBlocks: [],
		recommendedBlocks: [],
		requiredAssets: [],
		previewSlug: 'demo-xv-jewelry-box',
	},
	clientName: '',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: false,
	createdBy: 'owner-1',
	archivedAt: null,
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
} as any;

const draft = {
	id: 'draft-1',
	invitationId: 'proj-1',
	submissionId: 'sub-1',
	content: {
		title: 'XV Ana',
		hero: { name: 'Ana', label: 'Mis XV', date: '2027-01-01' },
	},
	status: 'approved',
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T01:00:00Z',
} as any;

const published = {
	id: 'published-1',
	invitationId: 'proj-1',
	slug: 'ana',
	eventType: 'xv',
	isDemo: false,
	version: 2,
	publishedAt: '2026-05-30T02:00:00Z',
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T02:00:00Z',
	content: {
		title: 'XV Ana Publicada',
		description: 'Descripción publicada',
		hero: { name: 'Ana P', label: 'Mis XV P', date: '2027-01-01' },
		family: { parents: { father: 'Papá P', mother: 'Mamá P' }, spouse: 'Esposo P' },
		location: { ceremony: { venueName: 'Iglesia P' }, dressCode: 'Formal P' },
		gallery: {
			title: 'Galería',
			items: [{ image: 'gallery01', caption: 'Publicado' }],
		},
		itinerary: {
			title: 'Programa',
			items: [{ icon: 'party', label: 'Fiesta', time: '21:00' }],
		},
		rsvp: {
			title: 'Confirma P',
			guestCap: 4,
			confirmationMode: 'api',
			whatsappConfig: { phone: '5215550000' },
		},
		music: { url: 'https://example.com/song.mp3', title: 'Canción P' },
		gifts: { title: 'Regalos P', items: [{ type: 'cash', title: 'Sobres' }] },
		quote: { text: 'Frase P', author: 'Autor P' },
		thankYou: { message: 'Gracias P', closingName: 'Familia P' },
		sectionOrder: ['quote', 'itinerary', 'gallery'],
	},
} as any;

const demoContent = {
	gallery: { title: 'Plantilla', items: [{ image: 'gallery02' }] },
	itinerary: { title: 'Plantilla', items: [] },
	sectionOrder: ['quote', 'gallery'],
	location: { ceremony: { venueName: 'Demo Venue' }, dressCode: 'Demo Dress' },
	rsvp: {
		title: 'Confirma Demo',
		guestCap: 2,
		confirmationMode: 'whatsapp',
		whatsappConfig: { phone: '5215551111' },
	},
};

beforeEach(() => {
	jest.clearAllMocks();
	(findInvitationById as jest.Mock).mockResolvedValue(invitation);
	(findDraftByInvitationId as jest.Mock).mockResolvedValue(draft);
	(findPublishedByInvitationId as jest.Mock).mockResolvedValue(published);
	(findEventByInvitationIdService as jest.Mock).mockResolvedValue(null);
	(findEventBySlugService as jest.Mock).mockResolvedValue(null);
	(upsertDraft as jest.Mock).mockResolvedValue(null);
	(getCollection as jest.Mock).mockResolvedValue([
		{
			id: 'xv/demo-xv-jewelry-box.json',
			data: demoContent,
		},
	]);
});

describe('getInvitationEditorContext', () => {
	it('hydrates all keys with draft priority over published over demo', async () => {
		const result = await getInvitationEditorContext('proj-1');

		expect(result.content).toMatchObject({
			title: 'XV Ana',
			hero: { name: 'Ana' },
			gallery: published.content.gallery,
			itinerary: published.content.itinerary,
			sectionOrder: published.content.sectionOrder,
		});
		expect(result.publication).toMatchObject({
			hasPublishedContent: true,
			version: 2,
			hasUnpublishedChanges: false,
		});
	});

	it('uses draft value when draft has the key', async () => {
		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.title).toBe('XV Ana');
		expect(result.content.hero?.name).toBe('Ana');
	});

	it('uses published value when draft lacks the key but published has it', async () => {
		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.gallery).toEqual(published.content.gallery);
		expect(result.content.itinerary).toEqual(published.content.itinerary);
	});

	it('uses demo value when neither draft nor published have the key', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue({
			...draft,
			content: { title: 'XV Ana', hero: { name: 'Ana' } },
		});
		(findPublishedByInvitationId as jest.Mock).mockResolvedValue(null);

		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.gallery).toEqual(demoContent.gallery);
		expect(result.content.sectionOrder).toEqual(demoContent.sectionOrder);
	});

	it('returns contentSource=mixed when some keys are from draft and some from published', async () => {
		const result = await getInvitationEditorContext('proj-1');
		expect(result.contentSource).toBe('mixed');
	});

	it('returns contentSource=published when all keys come from published content', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue(null);
		const result = await getInvitationEditorContext('proj-1');
		expect(result.contentSource).toBe('published');
	});

	it('returns contentSource=demo when only demo content is available', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue(null);
		(findPublishedByInvitationId as jest.Mock).mockResolvedValue(null);
		const result = await getInvitationEditorContext('proj-1');
		expect(result.contentSource).toBe('demo');
	});

	it('returns contentSource=empty when no content is available at all', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue(null);
		(findPublishedByInvitationId as jest.Mock).mockResolvedValue(null);
		(getCollection as jest.Mock).mockResolvedValue([]);
		const result = await getInvitationEditorContext('proj-1');
		expect(result.contentSource).toBe('empty');
	});

	it('reports section states indicating source for each key', async () => {
		const result = await getInvitationEditorContext('proj-1');
		expect(result.sectionStates.title).toBe('draft');
		expect(result.sectionStates.hero).toBe('draft');
		expect(result.sectionStates.gallery).toBe('published');
		expect(result.sectionStates.itinerary).toBe('published');
		expect(result.sectionStates.photoNotes).toBe('empty');
	});
});

describe('hydration edge cases', () => {
	it('preserves intentionally cleared draft fields (empty string) and does not refill from published', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue({
			...draft,
			content: {
				title: '',
				hero: { name: 'Ana', date: '' },
			},
		});

		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.title).toBe('');
		expect(result.content.hero?.name).toBe('Ana');
		expect(result.content.hero?.date).toBe('');
		expect(result.sectionStates.title).toBe('draft');
	});

	it('preserves intentionally cleared draft fields (null) and marks them as draft source', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue({
			...draft,
			content: {
				title: null,
				hero: { name: null, label: 'Mis XV' },
			},
		});

		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.title).toBeNull();
		expect(result.content.hero?.name).toBeNull();
		expect(result.sectionStates.title).toBe('draft');
		expect(result.sectionStates.hero).toBe('draft');
	});

	it('inherits description from published when draft has no description key', async () => {
		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.description).toBe('Descripción publicada');
		expect(result.sectionStates.description).toBe('published');
	});

	it('prefers demo content when neither draft nor published have a key', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue({
			...draft,
			content: { title: 'XV Ana' },
		});
		(findPublishedByInvitationId as jest.Mock).mockResolvedValue(null);

		const result = await getInvitationEditorContext('proj-1');
		expect(result.content.gallery).toEqual(demoContent.gallery);
		expect(result.content.sectionOrder).toEqual(demoContent.sectionOrder);
		expect(result.content.location?.ceremony?.venueName).toBe('Demo Venue');
		expect(result.sectionStates.gallery).toBe('demo');
		expect(result.sectionStates.location).toBe('demo');
	});

	it('saves only the targeted section without wiping other hydrated sections', async () => {
		(updateDraftContentConditionally as jest.Mock).mockResolvedValue({
			...draft,
			status: 'draft',
			updatedAt: '2026-05-30T03:00:00Z',
			content: {
				...draft.content,
				itinerary: {
					title: 'Programa Editado',
					items: [{ icon: 'party', label: 'Fiesta', time: '22:00' }],
				},
			},
		});

		const value = {
			title: 'Programa Editado',
			items: [{ icon: 'party', label: 'Fiesta', time: '22:00' }],
		};
		await saveInvitationEditorSection('proj-1', 'itinerary', {
			expectedUpdatedAt: draft.updatedAt,
			value,
		});

		const savedContent = (updateDraftContentConditionally as jest.Mock).mock.calls[0][2]
			.content;
		expect(savedContent.itinerary).toEqual(value);
		expect(savedContent.title).toBe('XV Ana');
		expect(savedContent.gallery).toEqual(published.content.gallery);
		expect(savedContent.rsvp).toBeDefined();
	});

	it('creates a new draft via upsert when no draft exists, preserving all hydrated sections', async () => {
		(findDraftByInvitationId as jest.Mock).mockResolvedValue(null);
		(upsertDraft as jest.Mock).mockResolvedValue({
			id: 'draft-new',
			invitationId: 'proj-1',
			submissionId: null,
			content: {
				title: 'XV Ana',
				gallery: { title: 'Galería', items: [{ image: 'gallery01', caption: 'Nueva' }] },
			},
			status: 'draft',
			createdAt: '2026-05-30T04:00:00Z',
			updatedAt: '2026-05-30T04:00:00Z',
		});

		const value = { title: 'Galería', items: [{ image: 'gallery01', caption: 'Nueva' }] };
		await saveInvitationEditorSection('proj-1', 'gallery', {
			expectedUpdatedAt: invitation.updatedAt,
			value,
		});

		const upsertCallArg = (upsertDraft as jest.Mock).mock.calls[0][0];
		expect(upsertCallArg.content.gallery).toEqual({
			title: 'Galería',
			items: [{ image: { type: 'internal', key: 'gallery01' }, caption: 'Nueva' }],
		});
		expect(upsertCallArg.content.title).toBe(published.content.title);
		expect(upsertCallArg.content.description).toBe(published.content.description);
		expect(upsertCallArg.content.sectionOrder).toEqual(published.content.sectionOrder);
	});
});

describe('saveInvitationEditorSection', () => {
	it('reopens an approved draft and saves the complete gallery atomically', async () => {
		(updateDraftContentConditionally as jest.Mock).mockResolvedValue({
			...draft,
			status: 'draft',
			updatedAt: '2026-05-30T03:00:00Z',
			content: {
				...draft.content,
				gallery: { title: 'Galería', items: [{ image: 'gallery02', caption: 'Nuevo' }] },
			},
		});

		const value = { title: 'Galería', items: [{ image: 'gallery02', caption: 'Nuevo' }] };
		const result = await saveInvitationEditorSection('proj-1', 'gallery', {
			expectedUpdatedAt: draft.updatedAt,
			value,
		});

		expect(updateDraftContentConditionally).toHaveBeenCalledWith('draft-1', draft.updatedAt, {
			content: expect.objectContaining({
				gallery: {
					title: 'Galería',
					items: [{ image: { type: 'internal', key: 'gallery02' }, caption: 'Nuevo' }],
				},
			}),
			status: 'draft',
		});
		expect(result.value).toEqual(value);
		expect(result.publication.hasUnpublishedChanges).toBe(true);
	});

	it('returns a conflict when another admin saved the draft first', async () => {
		(updateDraftContentConditionally as jest.Mock).mockResolvedValue(null);

		await expect(
			saveInvitationEditorSection('proj-1', 'gallery', {
				expectedUpdatedAt: draft.updatedAt,
				value: { title: 'Galería', items: [] },
			}),
		).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});
	});
});

describe('restoreInvitationEditorFromPublished', () => {
	it('replaces the editable draft from published content with optimistic concurrency', async () => {
		(updateDraftContentConditionally as jest.Mock).mockResolvedValue({
			...draft,
			status: 'draft',
			updatedAt: '2026-05-30T03:00:00Z',
		});

		await restoreInvitationEditorFromPublished('proj-1', {
			expectedUpdatedAt: draft.updatedAt,
		});

		expect(updateDraftContentConditionally).toHaveBeenCalledWith(
			'draft-1',
			draft.updatedAt,
			expect.objectContaining({
				status: 'draft',
				content: expect.objectContaining({
					title: published.content.title,
					description: published.content.description,
					gallery: published.content.gallery,
				}),
			}),
		);
	});

	it('rejects restore when no published content exists', async () => {
		(findPublishedByInvitationId as jest.Mock).mockResolvedValue(null);

		await expect(
			restoreInvitationEditorFromPublished('proj-1', {
				expectedUpdatedAt: draft.updatedAt,
			}),
		).rejects.toMatchObject({ status: 404 });
	});
});
