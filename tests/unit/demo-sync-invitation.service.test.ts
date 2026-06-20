import { getCollection } from 'astro:content';
import type { DemoPreset, Invitation, InvitationContentDraft } from '@/lib/intake/types';
import type { PublishedInvitationContent } from '@/lib/intake/repositories/published-invitation-content.repository';

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationBySlug: jest.fn(),
	createInvitation: jest.fn(),
	updateInvitation: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
	upsertPublishedContent: jest.fn(),
}));

import {
	findInvitationBySlug,
	createInvitation,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	findPublishedByInvitationId,
	upsertPublishedContent,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { synchronizeDemoInvitations } from '@/lib/intake/services/invitation.service';

const findInvitationBySlugMock = findInvitationBySlug as jest.MockedFunction<
	typeof findInvitationBySlug
>;
const createInvitationMock = createInvitation as jest.MockedFunction<typeof createInvitation>;
const updateInvitationMock = updateInvitation as jest.MockedFunction<typeof updateInvitation>;
const findDraftByInvitationIdMock = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const findPublishedByInvitationIdMock = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;
const upsertPublishedContentMock = upsertPublishedContent as jest.MockedFunction<
	typeof upsertPublishedContent
>;
const getCollectionMock = getCollection as jest.MockedFunction<typeof getCollection>;

const BABY_SHOWER_SLUG = 'demo-baby-shower-celestial';
const BABY_SHOWER_ENTRY_ID = 'baby-shower/demo-baby-shower-celestial.json';

const BASE_STATIC_CONTENT = {
	eventType: 'baby-shower' as const,
	isDemo: true,
	title: 'Baby Shower de Luna Celeste',
	theme: { fontFamily: 'serif', preset: 'celestial-blue' },
	hero: { name: 'Luna Celeste', label: 'Mi Baby Shower' },
};

const demoPresetSnapshot = {
	id: 'demo-baby-shower-celestial',
	eventType: 'baby-shower' as const,
	displayName: 'Baby Shower — Celestial Demo',
	themeId: 'celestial-blue' as const,
	defaultSections: [
		'quote',
		'family',
		'gallery',
		'location',
		'gifts',
		'rsvp',
		'thankYou',
	] as const,
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	] as const,
	recommendedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'gifts',
		'special-messages',
	] as const,
	requiredAssets: ['hero', 'family', 'gallery01'] as const,
	previewSlug: BABY_SHOWER_SLUG,
} satisfies DemoPreset;

function mockInvitation(overrides: Partial<Invitation> = {}): Invitation {
	return {
		id: '',
		kind: 'demo',
		sourceInvitationId: null,
		slug: null,
		title: '',
		eventType: 'baby-shower',
		status: 'draft',
		baseDemoId: '',
		themeId: '',
		snapshot: demoPresetSnapshot,
		clientName: '',
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: false,
		createdBy: null,
		archivedAt: null,
		createdAt: '',
		updatedAt: '',
		...overrides,
	};
}

function mockPublishedContent(
	overrides: Partial<PublishedInvitationContent> = {},
): PublishedInvitationContent {
	return {
		id: '',
		invitationId: '',
		slug: '',
		eventType: 'baby-shower',
		isDemo: true,
		content: {},
		version: 1,
		publishedAt: '',
		createdAt: '',
		updatedAt: '',
		...overrides,
	};
}

function mockDraft(overrides: Partial<InvitationContentDraft> = {}): InvitationContentDraft {
	return {
		id: '',
		invitationId: '',
		submissionId: null,
		content: {},
		status: 'draft',
		createdAt: '',
		updatedAt: '',
		...overrides,
	};
}

const baseDemoEntry = {
	id: BABY_SHOWER_ENTRY_ID,
	data: { ...BASE_STATIC_CONTENT },
};

beforeEach(() => {
	jest.clearAllMocks();
	getCollectionMock.mockResolvedValue([baseDemoEntry]);
});

describe('synchronizeDemoInvitations', () => {
	it('creates a new demo invitation when no existing record is found', async () => {
		findInvitationBySlugMock.mockResolvedValue(null);
		createInvitationMock.mockResolvedValue(
			mockInvitation({
				id: 'new-demo-id',
				slug: BABY_SHOWER_SLUG,
				title: 'Baby Shower — Celestial Demo',
			}),
		);
		upsertPublishedContentMock.mockResolvedValue(mockPublishedContent());

		await synchronizeDemoInvitations('admin-1');

		expect(createInvitationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: BABY_SHOWER_SLUG,
				kind: 'demo',
				eventType: 'baby-shower',
				createdBy: 'admin-1',
			}),
		);
		expect(upsertPublishedContentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: BABY_SHOWER_SLUG,
				isDemo: true,
				content: expect.objectContaining({
					title: 'Baby Shower de Luna Celeste',
					isDemo: true,
				}),
			}),
		);
		expect(updateInvitationMock).toHaveBeenCalledWith('new-demo-id', { status: 'published' });
	});

	it('refreshes stale published content when static JSON changed', async () => {
		const stalePublishedContent = {
			...BASE_STATIC_CONTENT,
			title: 'Old Baby Shower Title',
		};

		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({ id: 'existing-demo-id', slug: BABY_SHOWER_SLUG }),
		);
		findDraftByInvitationIdMock.mockResolvedValue(null);
		findPublishedByInvitationIdMock.mockResolvedValue(
			mockPublishedContent({ content: stalePublishedContent }),
		);

		await synchronizeDemoInvitations('admin-1');

		expect(upsertPublishedContentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				invitationId: 'existing-demo-id',
				slug: BABY_SHOWER_SLUG,
				content: expect.objectContaining({
					title: 'Baby Shower de Luna Celeste',
					hero: expect.objectContaining({ name: 'Luna Celeste' }),
					isDemo: true,
				}),
			}),
		);
		expect(updateInvitationMock).toHaveBeenCalledWith('existing-demo-id', {
			status: 'published',
		});
	});

	it('skips refresh when published content already matches static JSON', async () => {
		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({ id: 'existing-demo-id', slug: BABY_SHOWER_SLUG }),
		);
		findDraftByInvitationIdMock.mockResolvedValue(null);
		findPublishedByInvitationIdMock.mockResolvedValue(
			mockPublishedContent({ content: { ...BASE_STATIC_CONTENT } }),
		);

		await synchronizeDemoInvitations('admin-1');

		expect(upsertPublishedContentMock).not.toHaveBeenCalled();
		expect(updateInvitationMock).not.toHaveBeenCalled();
	});

	it('repairs missing published content for existing demo', async () => {
		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({ id: 'existing-demo-id', slug: BABY_SHOWER_SLUG }),
		);
		findDraftByInvitationIdMock.mockResolvedValue(null);
		findPublishedByInvitationIdMock.mockResolvedValue(null);

		await synchronizeDemoInvitations('admin-1');

		expect(upsertPublishedContentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				invitationId: 'existing-demo-id',
				slug: BABY_SHOWER_SLUG,
				isDemo: true,
			}),
		);
		expect(updateInvitationMock).toHaveBeenCalled();
	});

	it('skips existing demo that has a draft (dashboard edits detected)', async () => {
		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({ id: 'existing-demo-id', slug: BABY_SHOWER_SLUG }),
		);
		findDraftByInvitationIdMock.mockResolvedValue(
			mockDraft({
				id: 'draft-1',
				invitationId: 'existing-demo-id',
				content: { title: 'Edited Demo Title' },
			}),
		);

		await synchronizeDemoInvitations('admin-1');

		expect(upsertPublishedContentMock).not.toHaveBeenCalled();
		expect(updateInvitationMock).not.toHaveBeenCalled();
	});

	it('skips non-demo invitation rows even if slug matches', async () => {
		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({
				id: 'client-invitation-id',
				kind: 'client' as const,
				slug: BABY_SHOWER_SLUG,
			}),
		);

		await synchronizeDemoInvitations('admin-1');

		expect(findDraftByInvitationIdMock).not.toHaveBeenCalled();
		expect(upsertPublishedContentMock).not.toHaveBeenCalled();
		expect(updateInvitationMock).not.toHaveBeenCalled();
	});

	it('does not overwrite non-demo published content when demo sync runs', async () => {
		findInvitationBySlugMock.mockResolvedValue(
			mockInvitation({
				id: 'non-demo-id',
				kind: 'client' as const,
				slug: 'some-client-slug',
			}),
		);

		await synchronizeDemoInvitations('admin-1');

		expect(upsertPublishedContentMock).not.toHaveBeenCalled();
		expect(updateInvitationMock).not.toHaveBeenCalled();
	});
});
