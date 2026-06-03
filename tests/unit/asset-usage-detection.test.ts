import {
	collectAssetUsagesByInvitation,
	collectAssetUsage,
} from '@/lib/intake/services/asset-usage.service';
import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';

jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

const mockFindDraft = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const mockFindPublished = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

beforeEach(() => {
	jest.clearAllMocks();
});

describe('collectAssetUsagesByInvitation', () => {
	it('detects published uploaded refs with src', async () => {
		mockFindDraft.mockResolvedValue(null);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			invitationId: 'inv-1',
			slug: 'test',
			eventType: 'xv',
			isDemo: false,
			content: {
				gallery: {
					items: [
						{
							image: {
								type: 'uploaded',
								assetId: VALID_UUID,
								src: 'https://cdn.test/img.webp',
							},
							caption: 'Published',
						},
					],
				},
			},
			version: 1,
			publishedAt: '2026-06-01T00:00:00.000Z',
			createdAt: '2026-06-01T00:00:00.000Z',
			updatedAt: '2026-06-01T00:00:00.000Z',
		} as any);

		const usages = await collectAssetUsagesByInvitation('inv-1', VALID_UUID);
		expect(usages).toHaveLength(1);
		expect(usages[0]).toMatchObject({
			assetId: VALID_UUID,
			usedInDraft: false,
			usedInPublished: true,
			publishedRefs: expect.arrayContaining([
				expect.objectContaining({ path: expect.stringContaining('gallery') }),
			]),
		});
	});

	it('detects draft uploaded refs without src', async () => {
		mockFindDraft.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			submissionId: null,
			content: {
				hero: {
					name: 'Test',
					backgroundImage: { type: 'uploaded', assetId: VALID_UUID },
				},
			},
			status: 'draft',
			createdAt: '2026-06-01T00:00:00.000Z',
			updatedAt: '2026-06-01T00:00:00.000Z',
		} as any);
		mockFindPublished.mockResolvedValue(null);

		const usages = await collectAssetUsagesByInvitation('inv-1', VALID_UUID);
		expect(usages).toHaveLength(1);
		expect(usages[0]).toMatchObject({
			assetId: VALID_UUID,
			usedInDraft: true,
			usedInPublished: false,
			draftRefs: expect.arrayContaining([
				expect.objectContaining({ path: expect.stringContaining('hero') }),
			]),
		});
	});

	it('detects usage in both draft and published', async () => {
		mockFindDraft.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			submissionId: null,
			content: { gallery: { items: [{ image: { type: 'uploaded', assetId: VALID_UUID } }] } },
			status: 'draft',
			createdAt: '',
			updatedAt: '',
		} as any);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			invitationId: 'inv-1',
			slug: 'test',
			eventType: 'xv',
			isDemo: false,
			content: {
				gallery: {
					items: [
						{
							image: {
								type: 'uploaded',
								assetId: VALID_UUID,
								src: 'https://cdn.test/img.webp',
							},
						},
					],
				},
			},
			version: 1,
			publishedAt: '',
			createdAt: '',
			updatedAt: '',
		} as any);

		const usages = await collectAssetUsagesByInvitation('inv-1', VALID_UUID);
		expect(usages).toHaveLength(1);
		expect(usages[0].usedInDraft).toBe(true);
		expect(usages[0].usedInPublished).toBe(true);
	});

	it('returns empty array for unused assetId', async () => {
		mockFindDraft.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			submissionId: null,
			content: { gallery: { items: [{ image: { type: 'internal', key: 'hero' } }] } },
			status: 'draft',
			createdAt: '',
			updatedAt: '',
		} as any);
		mockFindPublished.mockResolvedValue(null);

		const usages = await collectAssetUsagesByInvitation('inv-1', VALID_UUID);
		expect(usages).toHaveLength(1);
		expect(usages[0].usedInDraft).toBe(false);
		expect(usages[0].usedInPublished).toBe(false);
	});

	it('collects multiple assetIds when no assetId filter is given', async () => {
		const UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
		mockFindDraft.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			submissionId: null,
			content: {
				gallery: {
					items: [
						{ image: { type: 'uploaded', assetId: VALID_UUID } },
						{ image: { type: 'uploaded', assetId: UUID_2 } },
					],
				},
			},
			status: 'draft',
			createdAt: '',
			updatedAt: '',
		} as any);
		mockFindPublished.mockResolvedValue(null);

		const usages = await collectAssetUsagesByInvitation('inv-1');
		expect(usages).toHaveLength(2);
		expect(usages.map((u) => u.assetId).sort()).toEqual([VALID_UUID, UUID_2].sort());
	});
});

describe('collectAssetUsage', () => {
	it('returns empty usage when assetId is not found', async () => {
		mockFindDraft.mockResolvedValue(null);
		mockFindPublished.mockResolvedValue(null);

		const usage = await collectAssetUsage('inv-1', VALID_UUID);
		expect(usage).toMatchObject({
			assetId: VALID_UUID,
			usedInDraft: false,
			usedInPublished: false,
			draftRefs: [],
			publishedRefs: [],
		});
	});

	it('blocks deletion when used in published content (simulates delete check)', async () => {
		mockFindDraft.mockResolvedValue(null);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			invitationId: 'inv-1',
			slug: 'test',
			eventType: 'xv',
			isDemo: false,
			content: {
				gallery: {
					items: [
						{
							image: {
								type: 'uploaded',
								assetId: VALID_UUID,
								src: 'https://cdn.test/img.webp',
							},
						},
					],
				},
			},
			version: 1,
			publishedAt: '',
			createdAt: '',
			updatedAt: '',
		} as any);

		const usage = await collectAssetUsage('inv-1', VALID_UUID);
		expect(usage.usedInPublished).toBe(true);
		expect(usage.publishedRefs.length).toBeGreaterThan(0);
		// Would block deletion in asset.service.ts deleteAsset
	});
});
