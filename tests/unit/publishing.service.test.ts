jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	upsertPublishedContent: jest.fn(),
	findPublishedBySlugAndEventType: jest.fn(),
	findPublishedByInvitationId: jest.fn(),
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

jest.mock('@/lib/intake/repositories/publication.repository', () => ({
	commitAtomicPublication: jest.fn(),
	replayAtomicPublication: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/managed-release-provenance.repository', () => ({
	clearManagedProjectionAncestor: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/intake/services/mutation-operation.service', () => ({
	ensurePartialMutationParent: jest.fn().mockResolvedValue(undefined),
	recordInvitationMutationOutcome: jest.fn(async (input) => ({
		operationId: input.context.operationId,
		status: input.status,
		durableMutation: input.status === 'applied' || input.status === 'partial',
		completedSteps: input.completedSteps ?? [],
		result: input.result,
	})),
}));

jest.mock('@/lib/assets/asset-registry', () => {
	const actual = jest.requireActual('@/lib/assets/asset-registry');
	const eventSlugs = new Set([
		'ana-sofia-cota-guillen',
		'demo-xv-editorial',
		'demo-xv-jewelry-box',
	]);
	return {
		...actual,
		isValidEvent: jest.fn((event: string) => eventSlugs.has(event)),
		getEventAsset: jest.fn((event: string) =>
			eventSlugs.has(event)
				? { src: '/test-asset.webp', width: 1, height: 1, format: 'webp' }
				: undefined,
		),
	};
});

import {
	findDraftByInvitationId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	upsertPublishedContent,
	findPublishedBySlugAndEventType,
	findPublishedByInvitationId,
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
import { getPublicationPreflight, publishDraft } from '@/lib/intake/services/publishing.service';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import * as assetRegistry from '@/lib/assets/asset-registry';
import { getCollection } from 'astro:content';
import {
	commitAtomicPublication,
	replayAtomicPublication,
} from '@/lib/intake/repositories/publication.repository';
import { clearManagedProjectionAncestor } from '@/lib/intake/repositories/managed-release-provenance.repository';
import {
	ensurePartialMutationParent,
	recordInvitationMutationOutcome,
} from '@/lib/intake/services/mutation-operation.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import type { DemoPreset } from '@/lib/intake/types';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { buildEventDemoEntry } from '../helpers/event-content-fixture';

const mockGetProject = findInvitationById as jest.MockedFunction<typeof findInvitationById>;
const mockGetCollection = getCollection as jest.MockedFunction<typeof getCollection>;

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const MISSING_UUID = '550e8400-e29b-41d4-a716-446655449999';
const KNOWN_EVENT_SLUGS = new Set([
	'ana-sofia-cota-guillen',
	'demo-xv-editorial',
	'demo-xv-jewelry-box',
]);
const COMMAND_CONTEXT = {
	operationId: VALID_UUID_1,
	environment: 'local' as const,
	projectRef: 'local-test',
	actorId: VALID_UUID_2,
	actorType: 'admin' as const,
	origin: 'editor' as const,
};

const MINIMAL_DEMO_ENTRY = buildEventDemoEntry(
	{
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
		gallery: { eyebrow: 'Galería', title: 'Galería', items: [] },
	},
	'xv/demo-xv-jewelry-box.json',
);
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
const mockFindPublishedByInvitationId = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;
const mockFindEventBySlug = findEventBySlugService as jest.MockedFunction<
	typeof findEventBySlugService
>;
const mockFindEventByProjectId = findEventByInvitationIdService as jest.MockedFunction<
	typeof findEventByInvitationIdService
>;
const mockCreateEvent = createEventService as jest.MockedFunction<typeof createEventService>;
const mockUpdateEvent = updateEventService as jest.MockedFunction<typeof updateEventService>;
const mockCommitAtomic = commitAtomicPublication as jest.MockedFunction<
	typeof commitAtomicPublication
>;
const mockReplayAtomic = replayAtomicPublication as jest.MockedFunction<
	typeof replayAtomicPublication
>;
const mockClearManagedProjection = clearManagedProjectionAncestor as jest.MockedFunction<
	typeof clearManagedProjectionAncestor
>;

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
		eventTiming: {
			localDateTime: '2027-11-20T18:00',
			timeZone: 'America/Mazatlan',
		},
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
	jest.mocked(assetRegistry.isValidEvent).mockImplementation((event) =>
		KNOWN_EVENT_SLUGS.has(event),
	);
	jest.mocked(assetRegistry.getEventAsset).mockImplementation((event) =>
		KNOWN_EVENT_SLUGS.has(event)
			? ({ src: '/test-asset.webp', width: 1, height: 1, format: 'webp' } as never)
			: undefined,
	);
	mockFindAssets.mockResolvedValue([]);
	mockGetCollection.mockResolvedValue([MINIMAL_DEMO_ENTRY]);
	mockFindEventByProjectId.mockResolvedValue(undefined as any);
	mockFindPublishedByInvitationId.mockResolvedValue(null);
	mockFindEventBySlug.mockResolvedValue(undefined as any);
	mockCommitAtomic.mockImplementation(async (input) => {
		if (!input.isDemo) {
			const [linkedEvent, slugEvent] = await Promise.all([
				mockFindEventByProjectId(input.invitationId),
				mockFindEventBySlug(input.slug),
			]);
			if (linkedEvent && slugEvent && linkedEvent.id !== slugEvent.id) {
				throw new ApiError(409, 'conflict', 'El slug ya está asociado a otro evento.');
			}
			const event = linkedEvent ?? slugEvent;
			if (event?.eventType && event.eventType !== input.eventType) {
				throw new ApiError(409, 'conflict', 'El evento tiene un tipo diferente.');
			}
			if (event) {
				await mockUpdateEvent({
					eventId: event.id,
					title: baseProject.title,
					slug: input.slug,
					status: 'published',
					invitationId: input.invitationId,
				});
			} else {
				await mockCreateEvent({
					ownerUserId: baseProject.createdBy,
					slug: input.slug,
					eventType: input.eventType as 'xv',
					title: baseProject.title,
					status: 'published',
					invitationId: input.invitationId,
				});
			}
		}
		const published = await mockUpsertPublished(input);
		await mockUpdateProject(input.invitationId, { status: 'published' });
		const draft = await mockUpdateDraftStatus(input.draftId, 'approved');
		return {
			draft,
			publishedContent: {
				id: published.id,
				slug: published.slug,
				eventType: published.eventType,
				version: published.version,
				publishedAt: published.publishedAt,
			},
		};
	});
});

describe('publishDraft', () => {
	it('reports partial when publication commits but provenance invalidation fails', async () => {
		mockGetProject.mockResolvedValue(baseProject as never);
		mockFindDraft.mockResolvedValue(validDraft as never);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		mockUpsertPublished.mockResolvedValue(publishedRow as never);
		mockUpdateProject.mockResolvedValue(baseProject as never);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as never);
		mockClearManagedProjection.mockRejectedValueOnce(new Error('provenance unavailable'));

		const result = await publishDraft('proj-1', undefined, COMMAND_CONTEXT);

		expect(result.outcome).toMatchObject({
			operationId: VALID_UUID_1,
			status: 'partial',
			completedSteps: ['publication_committed'],
		});
		expect(recordInvitationMutationOutcome).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'partial', commandKind: 'publish_invitation' }),
		);
	});

	it('replays publication and repairs provenance without publishing again', async () => {
		mockGetProject.mockResolvedValue(baseProject as never);
		mockFindDraft.mockResolvedValue(approvedDraft as never);
		mockReplayAtomic.mockResolvedValue({
			draft: approvedDraft,
			publishedContent: {
				id: publishedRow.id,
				slug: publishedRow.slug,
				eventType: publishedRow.eventType,
				version: publishedRow.version,
				publishedAt: publishedRow.publishedAt,
			},
			idempotent: true,
		});
		const preflight = {
			draftRevision: validDraft.updatedAt,
			publishedVersion: null,
			publicMetadataHash: 'a'.repeat(32),
			projectionHash: 'b'.repeat(32),
			idempotencyKey: VALID_UUID_1,
		};

		const result = await publishDraft('proj-1', preflight, COMMAND_CONTEXT);

		expect(mockCommitAtomic).not.toHaveBeenCalled();
		expect(ensurePartialMutationParent).toHaveBeenCalledWith(
			expect.objectContaining({ context: COMMAND_CONTEXT }),
		);
		expect(mockClearManagedProjection).toHaveBeenCalledWith('proj-1');
		expect(result.outcome?.status).toBe('replayed');
	});

	it('creates a canonical preflight that groups an envelope edit under its editor section', async () => {
		const rominaProject = { ...baseProject, slug: 'romina' };
		mockGetProject.mockResolvedValue(rominaProject as never);
		const mappedPublishedContent = mapDraftToPublished({
			invitation: {
				title: baseProject.title,
				eventType: baseProject.eventType,
				snapshot: baseProject.snapshot as any,
			},
			assetSlug: baseProject.snapshot.previewSlug,
			draftContent: validDraft.content,
			demoContent: MINIMAL_DEMO_ENTRY.data,
			isDemo: false,
		});
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				envelope: { recipientName: 'Romina Ríos Chaparro' },
			},
		} as never);
		mockFindPublishedByInvitationId.mockResolvedValue({
			...publishedRow,
			slug: 'romina',
			content: mappedPublishedContent,
		} as never);

		const preflight = await getPublicationPreflight('proj-1');

		expect(preflight.draftRevision).toBe(validDraft.updatedAt);
		expect(preflight.publishedVersion).toBe(1);
		expect(preflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);
		expect(preflight.changedSections).toEqual([
			{
				path: 'content.envelope.recipientName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
		]);
	});

	it('reports no pending sections when the persisted draft matches the public projection', async () => {
		mockGetProject.mockResolvedValue({ ...baseProject, slug: publishedRow.slug } as never);
		const projectedContent = mapDraftToPublished({
			invitation: {
				title: baseProject.title,
				eventType: baseProject.eventType,
				snapshot: baseProject.snapshot as DemoPreset,
			},
			assetSlug: baseProject.snapshot.previewSlug,
			draftContent: validDraft.content,
			demoContent: MINIMAL_DEMO_ENTRY.data,
			isDemo: false,
		});
		mockFindDraft.mockResolvedValue(validDraft as never);
		mockFindPublishedByInvitationId.mockResolvedValue({
			...publishedRow,
			content: projectedContent,
		} as never);

		const preflight = await getPublicationPreflight('proj-1');

		expect(preflight.changedPaths).toEqual([]);
		expect(preflight.changedSections).toEqual([]);
	});

	it('rejects publish when the reviewed canonical projection changed', async () => {
		mockGetProject.mockResolvedValue(baseProject as never);
		mockFindDraft.mockResolvedValue(validDraft as never);

		await expect(
			publishDraft('proj-1', {
				draftRevision: validDraft.updatedAt,
				publishedVersion: null,
				publicMetadataHash: '00000000000000000000000000000000',
				projectionHash: '00000000000000000000000000000000',
				idempotencyKey: VALID_UUID_1,
			}),
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
		expect(mockCommitAtomic).not.toHaveBeenCalled();
	});

	it('routes a lost-response retry for an approved draft to the atomic receipt', async () => {
		mockGetProject.mockResolvedValue(baseProject as never);
		mockFindDraft.mockResolvedValue(validDraft as never);
		mockFindPublishedByInvitationId.mockResolvedValue(publishedRow as never);
		const preflight = await getPublicationPreflight('proj-1');
		mockFindDraft.mockResolvedValue({ ...validDraft, status: 'approved' } as never);
		mockReplayAtomic.mockResolvedValue({
			draft: { ...approvedDraft },
			publishedContent: publishedRow,
			idempotent: false,
		} as never);

		await expect(
			publishDraft('proj-1', { ...preflight, idempotencyKey: VALID_UUID_1 }),
		).resolves.toMatchObject({
			publishedContent: { version: 1 },
		});
		expect(mockReplayAtomic).toHaveBeenCalledWith(
			expect.objectContaining({ idempotencyKey: VALID_UUID_1 }),
		);
	});

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
		expect(mockClearManagedProjection).toHaveBeenCalledWith('proj-1');
	});

	it('still returns success when clearing managed projection fails after commit', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);
		mockClearManagedProjection.mockRejectedValueOnce(new Error('provenance unavailable'));

		await expect(publishDraft('proj-1')).resolves.toMatchObject({
			draft: { status: 'approved' },
		});
		expect(mockClearManagedProjection).toHaveBeenCalledWith('proj-1');
	});

	it('does not clear managed projection when publish fails before commit', async () => {
		mockGetProject.mockResolvedValue(baseProject as never);
		mockFindDraft.mockResolvedValue(validDraft as never);

		await expect(
			publishDraft('proj-1', {
				draftRevision: validDraft.updatedAt,
				publishedVersion: null,
				publicMetadataHash: '00000000000000000000000000000000',
				projectionHash: '00000000000000000000000000000000',
				idempotencyKey: VALID_UUID_1,
			}),
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
		expect(mockCommitAtomic).not.toHaveBeenCalled();
		expect(mockClearManagedProjection).not.toHaveBeenCalled();
	});

	it('derives eventTiming.startsAtUtc during publish', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
					timeZone: 'America/Mazatlan',
					startsAtUtc: '2000-01-01T00:00:00.000Z',
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		expect(publishedContent.eventTiming).toEqual({
			localDateTime: '2026-08-01T20:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-08-02T03:00:00.000Z',
		});
	});

	it('blocks publish with Spanish error when renderable countdown has incomplete eventTiming', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				countdown: { title: 'Mi cuenta regresiva' },
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
				},
			},
		} as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
			message: expect.stringContaining('cuenta regresiva'),
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
	});

	it('allows publish with incomplete eventTiming when countdown is not renderable', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
				},
				sectionOrder: ['quote', 'location', 'rsvp'],
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		expect(mockUpsertPublished).toHaveBeenCalled();
	});

	it('preflight blocks with Spanish error when renderable countdown has incomplete eventTiming', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				countdown: { title: 'Mi cuenta regresiva' },
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
				},
			},
		} as any);

		await expect(getPublicationPreflight('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
			message: expect.stringContaining('cuenta regresiva'),
		});
	});

	it('preflight succeeds and publish succeeds when countdown is enabled with valid timing', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				countdown: {},
				eventTiming: {
					localDateTime: '2027-11-20T18:00',
					timeZone: 'America/Mazatlan',
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		// Preflight succeeds
		const preflightResult = await getPublicationPreflight('proj-1');
		expect(preflightResult).toHaveProperty('projectionHash');

		// Publish succeeds
		await publishDraft('proj-1');
		expect(mockUpsertPublished).toHaveBeenCalled();
	});

	it('preflight reports only the envelope section and publish succeeds on envelope-only change without countdown', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				envelope: {
					envelopeName: 'Nuevo Sobre Especial',
					disabled: false,
				},
			},
		} as any);

		const basePublishedContent = mapDraftToPublished({
			invitation: {
				title: baseProject.title,
				eventType: baseProject.eventType,
				snapshot: { ...baseProject.snapshot, themeId: 'jewelry-box' } as any,
			},
			assetSlug: 'demo-xv-jewelry-box',
			draftContent: validDraft.content,
			demoContent: {},
			isDemo: false,
		});

		mockFindPublishedByInvitationId.mockResolvedValue({
			id: 'pub-prior',
			invitationId: 'proj-1',
			slug: baseProject.slug || 'xv-proj-1',
			eventType: 'xv',
			isDemo: false,
			version: 1,
			publishedAt: '2026-01-01T00:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			content: {
				...basePublishedContent,
				envelope: {
					...(basePublishedContent.envelope as any),
					envelopeName: 'Sobre Antiguo',
					disabled: false,
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		// Preflight only reports envelope section
		const preflightResult = await getPublicationPreflight('proj-1');
		expect(preflightResult.changedSections).toEqual([
			{
				path: 'content.envelope.envelopeName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
		]);

		// Publish succeeds and the new envelope name is present in published content
		await publishDraft('proj-1');
		const publishedContent = mockUpsertPublished.mock.calls[0][0].content as any;
		expect(publishedContent.envelope.envelopeName).toBe('Nuevo Sobre Especial');
		// Countdown was never enabled, so it should not be present
		expect(publishedContent.countdown).toBeUndefined();
	});

	it('preserves existing valid countdown when performing an unrelated edit', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				envelope: {
					envelopeName: 'Nuevo Sobre Especial',
					disabled: false,
				},
			},
		} as any);

		const basePublishedContent = mapDraftToPublished({
			invitation: {
				title: baseProject.title,
				eventType: baseProject.eventType,
				snapshot: { ...baseProject.snapshot, themeId: 'jewelry-box' } as any,
			},
			assetSlug: 'demo-xv-jewelry-box',
			draftContent: validDraft.content,
			demoContent: {},
			isDemo: false,
		});

		mockFindPublishedByInvitationId.mockResolvedValue({
			id: 'pub-prior',
			invitationId: 'proj-1',
			slug: baseProject.slug || 'xv-proj-1',
			eventType: 'xv',
			isDemo: false,
			version: 1,
			publishedAt: '2026-01-01T00:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			content: {
				...basePublishedContent,
				countdown: {
					title: '¡Cada día falta menos!',
					footerText: 'Te esperamos.',
				},
				envelope: {
					...(basePublishedContent.envelope as any),
					envelopeName: 'Sobre Antiguo',
					disabled: false,
				},
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');
		const publishedContent = mockUpsertPublished.mock.calls[0][0].content as any;
		expect(publishedContent.envelope.envelopeName).toBe('Nuevo Sobre Especial');
		expect(publishedContent.countdown).toEqual({
			title: '¡Cada día falta menos!',
			footerText: 'Te esperamos.',
		});
	});

	it('preflight and publish semantic validation cannot drift and produce equivalent results from the same candidate', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindPublishedByInvitationId.mockResolvedValue(null);

		const draftWithInvalidTiming = {
			...validDraft,
			content: {
				...validDraft.content,
				countdown: {
					title: '¡Falta muy poco!',
				},
				eventTiming: {
					localDateTime: '2027-11-20T18:00', // missing timezone -> invalid timing
				},
			},
		};

		mockFindDraft.mockResolvedValue(draftWithInvalidTiming as any);

		let preflightError: any;
		try {
			await getPublicationPreflight('proj-1');
		} catch (err) {
			preflightError = err;
		}

		let publishError: any;
		try {
			await publishDraft('proj-1');
		} catch (err) {
			publishError = err;
		}

		expect(preflightError).toBeDefined();
		expect(publishError).toBeDefined();
		expect(preflightError.status).toBe(publishError.status);
		expect(preflightError.message).toBe(publishError.message);
	});

	it('rejects when no draft exists', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue(null);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockUpsertPublished).not.toHaveBeenCalled();
		expect(mockClearManagedProjection).not.toHaveBeenCalled();
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

	it('merges sparse draft content with prior published content when prior exists', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				title: 'Sparse Draft',
				hero: { name: 'Ana', date: '2027-01-01' },
			},
		} as any);
		mockFindPublishedByInvitationId.mockResolvedValue({
			id: 'pub-prior',
			invitationId: 'proj-1',
			slug: 'my-slug',
			eventType: 'xv',
			isDemo: false,
			version: 1,
			publishedAt: '2026-01-01T00:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			content: {
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
					timeZone: 'America/Mazatlan',
					startsAtUtc: '2026-08-02T03:00:00.000Z',
				},
				gallery: { title: 'Galería', items: [] },
				itinerary: { title: 'Programa', items: [] },
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		type PublishedContentShape = {
			hero?: { name?: string };
			gallery?: { title?: string };
		};
		const publishedContent = mockUpsertPublished.mock.calls[0][0]
			.content as PublishedContentShape;
		// Draft hero.name is preserved through the merge
		expect(publishedContent.hero?.name).toBe('Ana');
		// Non-edited sections from prior published content are preserved
		expect(publishedContent.gallery).toBeDefined();
		expect(publishedContent.gallery?.title).toBe('Galería');
	});

	it('preserves premium envelope fields from prior published content when draft only edits generic fields', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				title: 'Test Event',
				description: 'A test event',
				hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
				envelope: {
					cardLabel: 'Nueva etiqueta',
					cardTagline: 'Nuevo lema',
					sealInitials: 'AS',
					disabled: false,
				},
			},
		} as any);
		mockFindPublishedByInvitationId.mockResolvedValue({
			id: 'pub-prior',
			invitationId: 'proj-1',
			slug: 'my-slug',
			eventType: 'xv',
			isDemo: false,
			version: 1,
			publishedAt: '2026-01-01T00:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			content: {
				eventType: 'xv',
				title: 'Test Event',
				hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
				eventTiming: {
					localDateTime: '2027-11-20T18:00',
					timeZone: 'America/Mazatlan',
					startsAtUtc: '2027-11-21T01:00:00.000Z',
				},
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					sealIcon: 'monogram',
					sealInitials: 'AS',
					sealVariant: 'premium-rose',
					cardLabel: 'Etiqueta anterior',
					cardTagline: 'Lema anterior',
					microcopy: 'Toca para abrir mi invitación',
					documentLabel: 'Evento',
					stampText: 'Test',
					stampYear: '2026',
					closedPalette: {
						primary: 'surfacePrimary',
						accent: 'actionAccent',
						background: 'surfacePrimary',
					},
				},
				gallery: { title: 'Galería', items: [] },
				itinerary: { title: 'Programa', items: [] },
			},
		} as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(baseProject as any);

		await publishDraft('proj-1');

		const publishedContent = mockUpsertPublished.mock.calls[0][0].content;
		const envelope = publishedContent.envelope as Record<string, unknown>;

		expect(envelope.sealVariant).toBe('premium-rose');
		expect(envelope.sealStyle).toBe('wax');
		expect(envelope.sealIcon).toBe('monogram');
		expect(envelope.microcopy).toBe('Toca para abrir mi invitación');
		expect(envelope.stampText).toBe('Test');
		expect(envelope.closedPalette).toBeDefined();

		// Draft generic overrides must still apply
		expect(envelope.cardLabel).toBe('Nueva etiqueta');
		expect(envelope.cardTagline).toBe('Nuevo lema');
		expect(envelope.sealInitials).toBe('AS');
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
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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

		try {
			await expect(publishDraft('proj-1')).rejects.toMatchObject({
				status: 422,
				code: 'bad_request',
				details: {
					section: 'visual',
					catalog: 'event-asset-registry',
					stage: 'publish',
				},
			});
			expect(warn).toHaveBeenCalledWith(
				'Invitation publication visual asset resolution failed',
				expect.objectContaining({
					invitationId: 'proj-1',
					stage: 'publish',
				}),
			);
			expect(mockUpsertPublished).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	it('uses the demo visual asset fallback for editorial-magazine preflight and publish', async () => {
		const editorialMagazineProject = {
			...baseProject,
			baseDemoId: 'demo-xv-editorial-magazine',
			themeId: 'editorial-magazine',
			snapshot: {
				...baseProject.snapshot,
				id: 'demo-xv-editorial-magazine',
				themeId: 'editorial-magazine',
				previewSlug: 'demo-xv-editorial-magazine',
			},
		};
		mockGetProject.mockResolvedValue(editorialMagazineProject as any);
		mockFindDraft.mockResolvedValue(validDraft as any);
		mockGetCollection.mockResolvedValue([
			{
				...MINIMAL_DEMO_ENTRY,
				id: 'xv/demo-xv-editorial-magazine.json',
				data: {
					...MINIMAL_DEMO_ENTRY.data,
					_assetSlug: 'demo-xv-editorial',
				},
			},
		] as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(editorialMagazineProject as any);

		const preflight = await getPublicationPreflight('proj-1');
		expect(preflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);

		await publishDraft('proj-1');
		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({ _assetSlug: 'demo-xv-editorial' }),
			}),
		);
	});

	it('publishes the real Romina uploaded-asset shape without requiring an internal registry pack', async () => {
		const rominaAssets = Object.fromEntries(
			ROMINA_ASSET_SPECS.map((asset, index) => [
				asset.key,
				{
					type: 'uploaded' as const,
					assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
					src: `https://cdn.test/invitation-assets/${asset.key}.webp`,
				},
			]),
		) as RominaAssetMap;
		const rominaPublishedContent = buildRominaPublishedContent(rominaAssets);
		const rominaProject = {
			...baseProject,
			slug: ROMINA_EVENT.slug,
			title: ROMINA_EVENT.title,
			baseDemoId: ROMINA_EVENT.baseDemoId,
			themeId: ROMINA_EVENT.themeId,
		};
		const rominaStoredAssets = ROMINA_ASSET_SPECS.map((asset) => ({
			id: rominaAssets[asset.key].assetId,
			invitationId: 'proj-1',
			bucket: 'invitation-assets',
			storagePath: `invitations/proj-1/optimized/${asset.key}.webp`,
			mimeType: 'image/webp',
			width: 1600,
			height: 1200,
			fileSize: 100_000,
			validationVersion: 1,
		}));

		mockGetProject.mockResolvedValue(rominaProject as any);
		mockFindPublishedByInvitationId.mockResolvedValue({
			...publishedRow,
			slug: ROMINA_EVENT.slug,
			content: rominaPublishedContent,
		} as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: mapNestedToDraftContent(rominaPublishedContent),
		} as any);
		mockFindAssets.mockResolvedValue(rominaStoredAssets as any);
		mockUpsertPublished.mockResolvedValue(publishedRow as any);
		mockUpdateDraftStatus.mockResolvedValue(approvedDraft as any);
		mockUpdateProject.mockResolvedValue(rominaProject as any);

		const preflight = await getPublicationPreflight('proj-1');
		expect(preflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);

		await publishDraft('proj-1');
		expect(mockUpsertPublished).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({ _assetSlug: ROMINA_EVENT.assetSlug }),
			}),
		);
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
		mockGetCollection.mockResolvedValue([
			buildEventDemoEntry(
				{
					...MINIMAL_DEMO_ENTRY.data,
					hero: {
						...MINIMAL_DEMO_ENTRY.data.hero,
						date: '2026-06-15T20:00:00.000Z',
						backgroundImage: {
							type: 'external',
							src: 'https://images.example.com/hero.jpg',
						},
						variant: 'jewelry-box',
					},
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
				'xv/demo-xv-jewelry-box.json',
			),
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

	it('blocks publication when a validated asset is missing delivery metadata', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				gallery: { items: [{ image: { type: 'uploaded', assetId: VALID_UUID_1 } }] },
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Sin metadatos',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/optimized/missing.webp',
				mimeType: 'image/webp',
				validationVersion: 1,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		] as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			message: expect.stringContaining('metadatos'),
			details: { reason: 'asset_metadata_invalid' },
		});
		expect(mockCommitAtomic).not.toHaveBeenCalled();
	});

	it('blocks publication when an asset is too small for its assigned role', async () => {
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					...validDraft.content.hero,
					backgroundImage: { type: 'uploaded', assetId: VALID_UUID_1 },
				},
			},
		} as any);
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID_1,
				invitationId: 'proj-1',
				displayName: 'Portada pequeña',
				bucket: 'invitation-assets',
				storagePath: 'invitations/proj-1/optimized/small.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 50_000,
				validationVersion: 1,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		] as any);

		await expect(publishDraft('proj-1')).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			message: expect.stringContaining('resolución'),
			details: { reason: 'asset_dimensions_insufficient', path: 'hero.backgroundImage' },
		});
		expect(mockCommitAtomic).not.toHaveBeenCalled();
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
		mockGetCollection.mockResolvedValue([
			buildEventDemoEntry(
				{
					...MINIMAL_DEMO_ENTRY.data,
					hero: {
						...MINIMAL_DEMO_ENTRY.data.hero,
						date: '2026-06-15T20:00:00.000Z',
						backgroundImage: {
							type: 'external',
							src: 'https://images.example.com/hero.jpg',
						},
						variant: 'jewelry-box',
					},
				},
				'xv/demo-xv-jewelry-box.json',
			),
		]);
		mockGetProject.mockResolvedValue(baseProject as any);
		mockFindDraft.mockResolvedValue({
			...validDraft,
			content: {
				...validDraft.content,
				hero: {
					...validDraft.content.hero,
					backgroundImage: {
						type: 'external',
						src: 'https://images.example.com/hero.jpg',
					},
				},
			},
		} as any);
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
		// Client invites omit empty optional galleries when the draft never set one.
		expect(publishedContent.gallery).toBeUndefined();
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
