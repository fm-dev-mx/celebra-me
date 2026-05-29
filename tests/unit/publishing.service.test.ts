jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByProjectId: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	upsertPublishedContent: jest.fn(),
}));

jest.mock('@/lib/intake/services/invitation-project.service', () => ({
	getInvitationProjectById: jest.fn(),
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
import { upsertPublishedContent } from '@/lib/intake/repositories/published-invitation-content.repository';
import { getInvitationProjectById } from '@/lib/intake/services/invitation-project.service';
import { publishDraft } from '@/lib/intake/services/publishing.service';

const mockGetProject = getInvitationProjectById as jest.MockedFunction<
	typeof getInvitationProjectById
>;
const mockFindDraft = findDraftByProjectId as jest.MockedFunction<typeof findDraftByProjectId>;
const mockUpdateDraftStatus = updateDraftStatus as jest.MockedFunction<typeof updateDraftStatus>;
const mockUpsertPublished = upsertPublishedContent as jest.MockedFunction<
	typeof upsertPublishedContent
>;

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
	createdBy: null,
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

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

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({ slug: 'my-invitation' }),
		);
	});
});
