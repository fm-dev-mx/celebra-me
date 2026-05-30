jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByProjectId: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	upsertPublishedContent: jest.fn(),
	findPublishedBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/intake/services/invitation-project.service', () => ({
	getInvitationProjectById: jest.fn(),
	updateProject: jest.fn(),
}));

jest.mock('astro:content', () => ({
	getCollection: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
	createEventService: jest.fn(),
	updateEventService: jest.fn(),
}));

import {
	findDraftByProjectId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	upsertPublishedContent,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	getInvitationProjectById,
	updateProject,
} from '@/lib/intake/services/invitation-project.service';
import {
	findEventBySlugService,
	createEventService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { publishDraft } from '@/lib/intake/services/publishing.service';

const mockGetProject = getInvitationProjectById as jest.MockedFunction<
	typeof getInvitationProjectById
>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;
const mockFindDraft = findDraftByProjectId as jest.MockedFunction<typeof findDraftByProjectId>;
const mockUpdateDraftStatus = updateDraftStatus as jest.MockedFunction<typeof updateDraftStatus>;
const mockUpsertPublished = upsertPublishedContent as jest.MockedFunction<
	typeof upsertPublishedContent
>;
const mockFindPublishedBySlugAndEventType = findPublishedBySlugAndEventType as jest.MockedFunction<
	typeof findPublishedBySlugAndEventType
>;
const mockFindEventBySlug = findEventBySlugService as jest.MockedFunction<
	typeof findEventBySlugService
>;
const mockCreateEvent = createEventService as jest.MockedFunction<typeof createEventService>;
const mockUpdateEvent = updateEventService as jest.MockedFunction<typeof updateEventService>;

const baseProject = {
	id: 'proj-1',
	slug: null,
	title: 'Test Project',
	eventType: 'xv' as const,
	status: 'in_production' as const,
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv' as const,
		displayName: 'XV Años — Jewelry Box',
		themeId: 'jewelry-box' as const,
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
		recommendedBlocks: [
			'event-details',
			'main-people',
			'date-locations',
			'photos',
			'rsvp-config',
			'gifts',
			'special-messages',
		],
		requiredAssets: ['hero', 'portrait', 'gallery01', 'gallery02', 'gallery03'],
		previewSlug: 'demo-xv-jewelry-box',
	},
	clientName: 'Test Client',
	clientEmail: '',
	clientWhatsapp: '5214421234567',
	photosReceived: false,
	createdBy: 'user-1',
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

const projectNoOwner = { ...baseProject, createdBy: null };

const validDraft = {
	id: 'draft-1',
	invitationProjectId: 'proj-1',
	submissionId: 'sub-1',
	content: {
		title: 'Test Event',
		description: 'A test event',
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
		rsvp: { title: 'Confirma', guestCap: 4, confirmationMode: 'api' },
	},
	status: 'draft' as const,
	createdAt: '2026-05-28T14:00:00Z',
	updatedAt: '2026-05-28T14:00:00Z',
};

const reviewedDraft = { ...validDraft, status: 'reviewed' as const };

const publishedRow = {
	id: 'pub-1',
	invitationProjectId: 'proj-1',
	slug: 'xv-proj-1a2b3c4d',
	eventType: 'xv',
	isDemo: false,
	content: { title: 'Test Event' },
	version: 1,
	publishedAt: '2026-05-28T15:00:00Z',
	createdAt: '2026-05-28T15:00:00Z',
	updatedAt: '2026-05-28T15:00:00Z',
};

const approvedDraft = { ...validDraft, status: 'approved' as const };

beforeEach(() => {
	jest.clearAllMocks();
	mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
	mockFindEventBySlug.mockResolvedValue(null);
	mockCreateEvent.mockResolvedValue({ id: 'event-1' } as any);
	const astroContent = jest.requireMock('astro:content');
	astroContent.getCollection.mockResolvedValue([
		{
			id: 'xv/demo-xv-jewelry-box.json',
			data: {
				eventType: 'xv',
				title: 'Demo Jewelry Box',
				theme: { fontFamily: 'serif', preset: 'jewelry-box' },
				hero: {
					name: 'Lucía García',
					label: 'Mis XV Años',
					date: '2026-06-15',
					backgroundImage: { type: 'internal', key: 'hero' },
					variant: 'jewelry-box',
				},
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					sealIcon: 'heart',
					sealInitials: 'L·G',
					microcopy: 'Toca para abrir',
				},
				gallery: { title: 'Galería', items: [] },
				sectionOrder: [
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
				interludes: [],
				sectionStyles: {},
				navigation: [],
			},
		},
	]);
});

describe('publishDraft', () => {
	it('publishes successfully from a valid draft', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		const result = await publishDraft('proj-1');

		expect(result.draft.status).toBe('approved');
		expect(result.publishedContent.slug).toBe('xv-proj-1a2b3c4d');
		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				invitationProjectId: 'proj-1',
				eventType: 'xv',
			}),
		);
		expect(mockUpdateDraftStatus).toHaveBeenCalledWith('draft-1', 'approved');
		expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', { status: 'published' });
	});

	it('rejects when no draft exists', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(null);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('rejects when project not found', async () => {
		mockGetProject.mockResolvedValue(null);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});

	it('rejects when draft status is not draft', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(reviewedDraft as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'invalid_draft_status',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('rejects when draft content is empty', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({ ...validDraft, content: {} } as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('upserts published content idempotently', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledTimes(2);
		expect(mockUpdateDraftStatus).toHaveBeenCalledTimes(2);
	});

	it('maps draft content to published format', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					title: 'Test Project',
					theme: expect.objectContaining({ preset: 'jewelry-box' }),
					eventType: 'xv',
					hero: expect.objectContaining({
						name: 'Ana Sofia',
						backgroundImage: { type: 'internal', key: 'hero' },
					}),
				}),
			}),
		);
	});

	it('uses project slug when available', async () => {
		const projectWithSlug = { ...baseProject, slug: 'my-invitation' };
		mockGetProject.mockResolvedValue(projectWithSlug as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(projectWithSlug as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({ slug: 'my-invitation' }),
		);
	});

	it('blocks publishing when project has no owner', async () => {
		mockGetProject.mockResolvedValue(projectNoOwner as any);
		mockFindDraft.mockResolvedValue(validDraft as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});

		expect(mockCreateEvent).not.toHaveBeenCalled();
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('creates event when no existing event exists', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		expect(mockCreateEvent).toHaveBeenCalledWith({
			ownerUserId: 'user-1',
			slug: 'xv-proj-1',
			eventType: 'xv',
			title: 'Test Project',
			status: 'published',
			invitationProjectId: 'proj-1',
		});
		expect(mockUpdateEvent).not.toHaveBeenCalled();
	});

	it('updates event when event exists with matching slug and type', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);
		mockFindEventBySlug.mockResolvedValue({
			id: 'event-1',
			eventType: 'xv',
		} as any);

		await publishDraft('proj-1');

		expect(mockUpdateEvent).toHaveBeenCalledWith({
			eventId: 'event-1',
			title: 'Test Project',
			status: 'published',
			invitationProjectId: 'proj-1',
		});
		expect(mockCreateEvent).not.toHaveBeenCalled();
	});

	it('blocks publishing when event exists with different event type', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockFindEventBySlug.mockResolvedValue({
			id: 'event-1',
			eventType: 'boda',
		} as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});

		expect(mockUpdateEvent).not.toHaveBeenCalled();
		expect(mockCreateEvent).not.toHaveBeenCalled();
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('blocks publishing when slug collides with published content from another project', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			id: 'pub-existing',
			invitationProjectId: 'other-proj',
			slug: 'xv-proj-1a2b3c4d',
			eventType: 'xv',
		} as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});

		expect(mockCreateEvent).not.toHaveBeenCalled();
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('allows publishing when published content exists for the same project', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			id: 'pub-existing',
			invitationProjectId: 'proj-1',
			slug: 'xv-proj-1a2b3c4d',
			eventType: 'xv',
		} as any);

		await expect(publishDraft('proj-1')).resolves.toBeDefined();
	});
});
