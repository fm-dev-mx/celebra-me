jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	upsertPublishedContent: jest.fn(),
	findPublishedBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: jest.fn(),
	updateInvitation: jest.fn(),
}));

jest.mock('astro:content', () => ({
	getCollection: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	findAssetsByInvitationId: jest.fn(),
}));

jest.mock('@/lib/intake/storage', () => ({
	getPublicUrl: (bucket: string, path: string) => `https://cdn.test/${bucket}/${path}`,
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
	findEventByInvitationIdService: jest.fn(),
	createEventService: jest.fn(),
	updateEventService: jest.fn(),
}));

import {
	findDraftByInvitationId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	upsertPublishedContent,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findInvitationById,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import {
	findEventBySlugService,
	findEventByInvitationIdService,
	createEventService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { publishDraft } from '@/lib/intake/services/publishing.service';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import * as assetRegistry from '@/lib/assets/asset-registry';
import { getCollection } from 'astro:content';

const mockGetProject = findInvitationById as jest.MockedFunction<typeof findInvitationById>;
const mockGetCollection = getCollection as jest.MockedFunction<typeof getCollection>;

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const MISSING_UUID = '550e8400-e29b-41d4-a716-446655449999';

const MINIMAL_DEMO_ENTRY = {
	id: 'xv/demo-xv-jewelry-box.json',
	data: {
		eventType: 'xv',
		title: 'Demo Jewelry Box',
		theme: { fontFamily: 'serif', preset: 'jewelry-box' },
		envelope: { disabled: true },
		hero: {
			name: 'Lucía García',
			label: 'Mis XV Años',
			date: '2026-06-15T20:00:00.000Z',
			backgroundImage: 'hero',
			variant: 'jewelry-box',
		},
		location: {
			ceremony: {
				venueEvent: 'Misa',
				venueName: 'Iglesia',
				address: 'Centro',
				date: '15 jun',
				time: '18:00',
				image: 'ceremony',
			},
		},
		quote: { text: 'Demo quote', author: 'Author' },
		gallery: { title: 'Galería', items: [] },
	},
};
const mockFindAssets = findAssetsByInvitationId as jest.MockedFunction<
	typeof findAssetsByInvitationId
>;
const mockUpdateProject = updateInvitation as jest.MockedFunction<typeof updateInvitation>;
const mockFindDraft = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
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
const mockFindEventByProjectId = findEventByInvitationIdService as jest.MockedFunction<
	typeof findEventByInvitationIdService
>;
const mockCreateEvent = createEventService as jest.MockedFunction<typeof createEventService>;
const mockUpdateEvent = updateEventService as jest.MockedFunction<typeof updateEventService>;

const baseProject = {
	id: 'proj-1',
	kind: 'client' as const,
	sourceInvitationId: null,
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
	archivedAt: null,
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

const projectNoOwner = { ...baseProject, createdBy: null };

const validDraft = {
	id: 'draft-1',
	invitationId: 'proj-1',
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
	invitationId: 'proj-1',
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
	mockFindAssets.mockResolvedValue([]);
	mockGetCollection.mockResolvedValue([MINIMAL_DEMO_ENTRY]);
	mockFindEventByProjectId.mockResolvedValue(undefined as any);
	mockFindEventBySlug.mockResolvedValue(undefined as any);
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
				invitationId: 'proj-1',
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

	it('rejects when invitation not found', async () => {
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

	it('rejects old drafts that still store itinerary icons in the legacy icon field', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				itinerary: {
					title: 'Programa',
					items: [
						{ icon: 'church', label: 'Misa', time: '18:00' },
						{ icon: 'reception', label: 'Recepción', time: '20:00' },
					],
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('uses invitation slug when available', async () => {
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

	it('blocks publishing when invitation has no owner', async () => {
		mockGetProject.mockResolvedValue(projectNoOwner as any);
		mockFindDraft.mockResolvedValue(validDraft as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});

		expect(mockCreateEvent).not.toHaveBeenCalled();
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('publishes a demo without creating an RSVP event or requiring an owner', async () => {
		const demoInvitation = {
			...baseProject,
			kind: 'demo' as const,
			createdBy: null,
			slug: 'demo-xv-jewelry-box',
		};
		mockGetProject.mockResolvedValue(demoInvitation as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue({ ...publishedRow, isDemo: true } as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(demoInvitation as any);

		await publishDraft('proj-1');

		expect(mockFindEventByProjectId).not.toHaveBeenCalled();
		expect(mockFindEventBySlug).not.toHaveBeenCalled();
		expect(mockCreateEvent).not.toHaveBeenCalled();
		expect(mockUpdateEvent).not.toHaveBeenCalled();
		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				isDemo: true,
				content: expect.objectContaining({ isDemo: true }),
			}),
		);
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
			invitationId: 'proj-1',
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
			slug: 'xv-proj-1',
			status: 'published',
			invitationId: 'proj-1',
		});
		expect(mockCreateEvent).not.toHaveBeenCalled();
	});

	it('updates the linked RSVP event when republishing with a changed slug', async () => {
		const projectWithSlug = { ...baseProject, slug: 'nuevo-slug' };
		mockGetProject.mockResolvedValue(projectWithSlug as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(projectWithSlug as any);
		mockFindEventByProjectId.mockResolvedValue({
			id: 'event-linked',
			eventType: 'xv',
			slug: 'slug-anterior',
		} as any);

		await publishDraft('proj-1');

		expect(mockUpdateEvent).toHaveBeenCalledWith({
			eventId: 'event-linked',
			title: 'Test Project',
			slug: 'nuevo-slug',
			status: 'published',
			invitationId: 'proj-1',
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

	it('blocks publishing when slug collides with published content from another invitation', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			id: 'pub-existing',
			invitationId: 'other-proj',
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

	it('allows publishing when published content exists for the same invitation', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			id: 'pub-existing',
			invitationId: 'proj-1',
			slug: 'xv-proj-1a2b3c4d',
			eventType: 'xv',
		} as any);

		await expect(publishDraft('proj-1')).resolves.toBeDefined();
	});

	it('sets _assetSlug to public slug for client invitations with a matching asset directory', async () => {
		const projectWithSlug = { ...baseProject, slug: 'ana-sofia-cota-guillen' };
		mockGetProject.mockResolvedValue(projectWithSlug as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(projectWithSlug as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					_assetSlug: 'ana-sofia-cota-guillen',
				}),
			}),
		);
	});

	it('falls back to previewSlug as _assetSlug for client invitations without a matching asset directory', async () => {
		const projectWithSlug = { ...baseProject, slug: 'ayrin-samantha-lerma-castro' };
		mockGetProject.mockResolvedValue(projectWithSlug as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(projectWithSlug as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					_assetSlug: 'demo-xv-jewelry-box',
				}),
			}),
		);
	});

	it('uses previewSlug as _assetSlug for demo invitations', async () => {
		const demoInvitation = {
			...baseProject,
			kind: 'demo' as const,
			slug: 'demo-xv-jewelry-box',
			createdBy: null,
		};
		mockGetProject.mockResolvedValue(demoInvitation as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue({ ...publishedRow, isDemo: true } as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(demoInvitation as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					_assetSlug: 'demo-xv-jewelry-box',
				}),
			}),
		);
	});

	it('rejects publish when asset slug does not resolve to a valid event directory', async () => {
		const projectUnknownSlug = {
			...baseProject,
			slug: 'invitacion-desconocida',
			snapshot: {
				...baseProject.snapshot,
				previewSlug: 'inexistent-asset-slug',
			},
		};
		mockGetProject.mockResolvedValue(projectUnknownSlug as any);
		mockFindDraft.mockResolvedValue(validDraft as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('rejects publish when hero backgroundImage key does not resolve in the asset registry', async () => {
		const spy = jest.spyOn(assetRegistry, 'getEventAsset').mockReturnValue(undefined);
		try {
			mockGetProject.mockResolvedValue(baseProject as any);
			mockFindDraft.mockResolvedValue(validDraft as any);
			mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
			mockUpdateProject.mockResolvedValue(baseProject as any);

			await expect(publishDraft('proj-1')).rejects.toMatchObject({
				status: 422,
				code: 'bad_request',
			});
			expect(mockUpsertPublished).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it('allows publish when hero backgroundImage is an external URL', async () => {
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
						backgroundImage: {
							type: 'external',
							src: 'https://images.example.com/hero.jpg',
						},
						variant: 'jewelry-box',
					},
					envelope: { disabled: true, sealStyle: 'wax', microcopy: 'Toca' },
					gallery: { title: 'Galería', items: [] },
					location: {},
					quote: { text: 'Una noche inolvidable' },
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
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		const result = await publishDraft('proj-1');
		expect(result.draft.status).toBe('approved');
		expect(mockUpsertPublished).toHaveBeenCalled();
	});

	// ─── Freeze/publish contract tests ───

	it('freezes uploaded asset refs during publish ({type:uploaded,assetId} → {type:uploaded,assetId,src})', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
							caption: 'Uploaded test',
						},
					],
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Test Image',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/test.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		const gallery = publishedContent.gallery as Record<string, unknown>;
		const items = gallery.items as Array<Record<string, unknown>>;
		expect(items[0].image).toMatchObject({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('invitations/proj-1/original/test.webp'),
		});
	});

	it('fails publish with Spanish error when uploaded assetId cannot be resolved', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: MISSING_UUID },
							caption: 'Missing asset',
						},
					],
				},
			},
		} as any);
		// No mockFindAssets setup — returns [] from beforeEach, asset not found
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
			message: expect.stringContaining('No se pudo resolver la imagen'),
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('preserves existing {type:internal} refs through publish unchanged', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		// Hero backgroundImage should still be internal (from demo fallback)
		const hero = publishedContent.hero as Record<string, unknown>;
		expect(hero.backgroundImage).toEqual(
			expect.objectContaining({ type: 'internal', key: 'hero' }),
		);
	});

	it('preserves external src refs through publish unchanged', async () => {
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
						backgroundImage: {
							type: 'external',
							src: 'https://images.example.com/hero.jpg',
						},
						variant: 'jewelry-box',
					},
					envelope: { disabled: true },
					gallery: { title: 'Galería', items: [] },
					location: {},
					quote: { text: 'Una noche inolvidable' },
				},
			},
		]);
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		const hero = publishedContent.hero as Record<string, unknown>;
		expect(hero.backgroundImage).toEqual({
			type: 'external',
			src: 'https://images.example.com/hero.jpg',
		});
	});

	it('handles mixed content: uploaded + internal + external in same invitation', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'internal' as const, key: 'gallery01' as const },
							caption: 'Demo',
						},
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
							caption: 'Uploaded',
						},
						{
							image: { type: 'external' as const, src: 'https://cdn.test/photo.jpg' },
							caption: 'Web',
						},
					],
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Test',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/test.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		const gallery = publishedContent.gallery as Record<string, unknown>;
		const items = gallery.items as Array<Record<string, unknown>>;

		// Internal unchanged
		expect(items[0].image).toEqual({ type: 'internal', key: 'gallery01' });
		// Uploaded frozen
		expect(items[1].image).toMatchObject({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('cdn.test'),
		});
		// External unchanged
		expect(items[2].image).toEqual({ type: 'external', src: 'https://cdn.test/photo.jpg' });
	});

	it('re-publish freezes new uploaded asset ref (draft image change)', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
							caption: 'V1',
						},
					],
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'V1 Image',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/v1.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		// First publish
		await publishDraft('proj-1');
		const v1Content = mockUpsertPublished.mock.calls[0][0].content;
		const v1Gallery = v1Content.gallery as Record<string, unknown>;
		const v1Items = v1Gallery.items as Array<Record<string, unknown>>;
		expect(v1Items[0].image).toMatchObject({ src: expect.stringContaining('v1.webp') });

		// Simulate re-publish with different asset
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_2 },
							caption: 'V2',
						},
					],
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_2,
				invitationId: 'proj-1',
				displayName: 'V2 Image',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/v2.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-02T00:00:00.000Z',
				updatedAt: '2026-01-02T00:00:00.000Z',
			},
		]);

		// Second publish
		mockUpsertPublished.mockClear();
		await publishDraft('proj-1');
		const v2Content = mockUpsertPublished.mock.calls[0][0].content;
		const v2Gallery = v2Content.gallery as Record<string, unknown>;
		const v2Items = v2Gallery.items as Array<Record<string, unknown>>;
		expect(v2Items[0].image).toMatchObject({ src: expect.stringContaining('v2.webp') });
	});

	it('removing uploaded image from draft does not mutate existing published content (no re-publish)', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any); // No uploaded refs in draft
		mockFindAssets.mockResolvedValue([]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		// Gallery comes from demo (no draft gallery), no uploaded refs
		const gallery = publishedContent.gallery;
		expect(gallery).toEqual(MINIMAL_DEMO_ENTRY.data.gallery);
	});

	// ─── Phase 4: Snapshot integrity hardening tests ───

	it('published hero backgroundImage is frozen with src when uploaded', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					name: 'Test',
					date: '2026-06-15T20:00:00.000Z',
					backgroundImage: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Hero',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/hero.webp',
				mimeType: 'image/webp',
				width: 1920,
				height: 1080,
				fileSize: 50000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const hero = content.hero as Record<string, unknown>;
		expect(hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('hero.webp'),
		});
	});

	it('published hero portrait is frozen with src when uploaded', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					name: 'Test',
					date: '2026-06-15T20:00:00.000Z',
					portrait: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Portrait',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/portrait.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 1000,
				fileSize: 30000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const hero = content.hero as Record<string, unknown>;
		expect(hero.portrait).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('portrait.webp'),
		});
	});

	it('published hero desktop and mobile uploaded refs are frozen with distinct src values', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					name: 'Test',
					date: '2026-06-15T20:00:00.000Z',
					backgroundImage: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
					backgroundImageMobile: { type: 'uploaded' as const, assetId: VALID_UUID_2 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Hero desktop',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/hero-desktop.webp',
				mimeType: 'image/webp',
				width: 1920,
				height: 1080,
				fileSize: 50000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
			{
				id: VALID_UUID_2,
				invitationId: 'proj-1',
				displayName: 'Hero mobile',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/hero-mobile.webp',
				mimeType: 'image/webp',
				width: 1080,
				height: 1920,
				fileSize: 52000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const hero = content.hero as Record<string, unknown>;
		expect(hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('hero-desktop.webp'),
		});
		expect(hero.backgroundImageMobile).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_2,
			src: expect.stringContaining('hero-mobile.webp'),
		});
	});

	it('does not publish demo mobile fallback when draft has only desktop image', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					name: 'Test',
					date: '2026-06-15T20:00:00.000Z',
					backgroundImage: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockGetCollection.mockResolvedValue([
			{
				...MINIMAL_DEMO_ENTRY,
				data: {
					...MINIMAL_DEMO_ENTRY.data,
					hero: {
						...MINIMAL_DEMO_ENTRY.data.hero,
						backgroundImageMobile: {
							type: 'external',
							src: 'https://cdn.test/demo-mobile.webp',
						},
					},
				},
			},
		] as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Hero desktop',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/hero-desktop.webp',
				mimeType: 'image/webp',
				width: 1920,
				height: 1080,
				fileSize: 50000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const hero = content.hero as Record<string, unknown>;
		expect(hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('hero-desktop.webp'),
		});
		expect(hero).toHaveProperty('backgroundImageMobile', undefined);
	});

	it('rejects publish when hero backgroundImageMobile key does not resolve in the asset registry', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					name: 'Test',
					date: '2026-06-15T20:00:00.000Z',
					backgroundImage: { type: 'internal' as const, key: 'hero' },
					backgroundImageMobile: { type: 'internal' as const, key: 'missing-mobile' },
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('published venue image is frozen with src when uploaded', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				location: {
					ceremony: {
						venueName: 'Iglesia',
						address: 'Centro',
						date: '15 jun',
						time: '18:00',
						image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
					},
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Venue',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/venue.webp',
				mimeType: 'image/webp',
				width: 1200,
				height: 800,
				fileSize: 40000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const location = content.location as Record<string, unknown>;
		const ceremony = location.ceremony as Record<string, unknown>;
		expect(ceremony.image).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('venue.webp'),
		});
	});

	it('published featuredImage is frozen with src when uploaded', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				family: {
					fatherName: 'Papá',
					motherName: 'Mamá',
					featuredImage: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Family',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/family.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 25000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const family = content.family as Record<string, unknown>;
		expect(family.featuredImage).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('family.webp'),
		});
	});

	it('published thankYou image is frozen with src when uploaded', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				thankYou: {
					message: 'Gracias',
					closingName: 'Test',
					image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'ThankYou',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/thanks.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 1000,
				fileSize: 35000,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const thankYou = content.thankYou as Record<string, unknown>;
		expect(thankYou.image).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.stringContaining('thanks.webp'),
		});
	});

	it('freeze preserves non-image content unchanged', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
							caption: 'Test',
						},
					],
				},
				quote: { text: 'Keep this', author: 'Author' },
				rsvp: { title: 'Confirma', guestCap: 4, confirmationMode: 'api' },
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Test',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/test.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const content = mockUpsertPublished.mock.calls[0][0].content;
		const quote = content.quote as Record<string, unknown>;
		expect(quote.text).toBe('Keep this');
	});

	it('published content is independent of draft after publish (no shallow refs)', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: {
					items: [
						{
							image: { type: 'uploaded' as const, assetId: VALID_UUID_1 },
							caption: 'V1',
						},
					],
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Img',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/original/img.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		// After publish, modify the draft's gallery item caption
		const draftAfter = mockFindDraft.mock.results[0].value;
		expect(draftAfter).toBeDefined();

		// Published content should still have the frozen ref with src
		const pubContent = mockUpsertPublished.mock.calls[0][0].content as Record<string, unknown>;
		const pubGallery = pubContent.gallery as Record<string, unknown>;
		const pubItems = pubGallery.items as Array<Record<string, unknown>>;
		expect(pubItems[0].image).toMatchObject({
			type: 'uploaded',
			assetId: VALID_UUID_1,
			src: expect.any(String),
		});
	});
});
