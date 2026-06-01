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
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findEventByInvitationIdService,
	findEventBySlugService,
} from '@/lib/rsvp/repositories/event.repository';
import {
	getInvitationEditorContext,
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
		gallery: {
			title: 'Galería',
			items: [{ image: 'gallery01', caption: 'Publicado' }],
		},
		itinerary: {
			title: 'Programa',
			items: [{ icon: 'party', label: 'Fiesta', time: '21:00' }],
		},
		sectionOrder: ['quote', 'itinerary', 'gallery'],
	},
} as any;

beforeEach(() => {
	jest.clearAllMocks();
	(findInvitationById as jest.Mock).mockResolvedValue(invitation);
	(findDraftByInvitationId as jest.Mock).mockResolvedValue(draft);
	(findPublishedByInvitationId as jest.Mock).mockResolvedValue(published);
	(findEventByInvitationIdService as jest.Mock).mockResolvedValue(null);
	(findEventBySlugService as jest.Mock).mockResolvedValue(null);
	(getCollection as jest.Mock).mockResolvedValue([
		{
			id: 'xv/demo-xv-jewelry-box.json',
			data: {
				gallery: { title: 'Plantilla', items: [{ image: 'gallery02' }] },
				itinerary: { title: 'Plantilla', items: [] },
				sectionOrder: ['quote', 'gallery'],
			},
		},
	]);
});

describe('getInvitationEditorContext', () => {
	it('hydrates gallery, itinerary, and section order missing from an older draft', async () => {
		const result = await getInvitationEditorContext('proj-1');

		expect(result.content).toMatchObject({
			title: 'XV Ana',
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
			content: expect.objectContaining({ gallery: value }),
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
