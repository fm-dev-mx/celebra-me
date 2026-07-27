jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftContentConditionally: jest.fn(),
	upsertDraft: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	applyDraftMutation,
	DraftRevisionConflictError,
} from '@/lib/intake/services/draft-mutation.service';

const findDraftMock = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const updateDraftMock = updateDraftContentConditionally as jest.MockedFunction<
	typeof updateDraftContentConditionally
>;
const findPublishedMock = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;

const galleryBaseline = {
	gallery: {
		title: 'Galería',
		items: [
			{
				key: 'thank-you-confetti',
				layoutRole: 'feature' as const,
				aspectRatio: '8 / 5',
				alt: 'Confeti',
				focalPoint: '72% 36%',
				image: {
					type: 'uploaded' as const,
					assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
				},
			},
		],
	},
};

describe('applyDraftMutation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		findPublishedMock.mockResolvedValue(null);
	});

	it('rejects stale draft revisions before writing', async () => {
		findDraftMock.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: { gallery: { items: [] } },
			status: 'draft',
			updatedAt: '2026-07-27T17:22:00.216614+00:00',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		});

		await expect(
			applyDraftMutation({
				invitationId: 'inv-1',
				expectedDraftUpdatedAt: '2026-07-27T17:00:00.000Z',
				patch: {
					kind: 'fields',
					fields: [{ path: 'gallery.title', value: 'X' }],
				},
				actor: 'editor',
				skipDocumentSchema: true,
			}),
		).rejects.toBeInstanceOf(DraftRevisionConflictError);

		expect(updateDraftMock).not.toHaveBeenCalled();
	});

	it('rejects a missing expected revision when a draft already exists', async () => {
		findDraftMock.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: galleryBaseline,
			status: 'draft',
			updatedAt: '2026-07-27T17:22:00.216614+00:00',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		});

		await expect(
			applyDraftMutation({
				invitationId: 'inv-1',
				expectedDraftUpdatedAt: null,
				patch: {
					kind: 'section',
					section: 'gallery',
					value: { ...galleryBaseline.gallery, title: 'Recuerdos' },
				},
				actor: 'editor',
				skipDocumentSchema: true,
			}),
		).rejects.toBeInstanceOf(DraftRevisionConflictError);

		expect(updateDraftMock).not.toHaveBeenCalled();
	});

	it('preserves unexposed gallery metadata when applying a fields patch', async () => {
		findDraftMock.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: galleryBaseline,
			status: 'draft',
			updatedAt: '2026-07-27T17:22:00.216614+00:00',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		});
		updateDraftMock.mockImplementation(async (_id, _expected, input) => ({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: input.content,
			status: 'draft',
			updatedAt: '2026-07-27T18:00:00.000Z',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		}));

		const result = await applyDraftMutation({
			invitationId: 'inv-1',
			expectedDraftUpdatedAt: '2026-07-27T17:22:00.216614+00:00',
			patch: {
				kind: 'fields',
				fields: [{ path: 'gallery.title', value: 'Recuerdos' }],
			},
			actor: 'cli',
			skipDocumentSchema: true,
		});

		const savedContent = updateDraftMock.mock.calls[0]![2]!.content as typeof galleryBaseline;
		expect(savedContent.gallery.title).toBe('Recuerdos');
		expect(savedContent.gallery.items[0]?.key).toBe('thank-you-confetti');
		expect(savedContent.gallery.items[0]?.layoutRole).toBe('feature');
		expect(savedContent.gallery.items[0]?.aspectRatio).toBe('8 / 5');
		expect(savedContent.gallery.items[0]?.focalPoint).toBe('72% 36%');
		expect(result.draftUpdatedAt).toBe('2026-07-27T18:00:00.000Z');
	});

	it('preserves gallery item metadata when applying a section patch', async () => {
		findDraftMock.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: galleryBaseline,
			status: 'draft',
			updatedAt: '2026-07-27T17:22:00.216614+00:00',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		});
		updateDraftMock.mockImplementation(async (_id, _expected, input) => ({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: input.content,
			status: 'draft',
			updatedAt: '2026-07-27T18:00:00.000Z',
			createdAt: '2026-07-27T17:00:00.000Z',
			submissionId: null,
		}));

		await applyDraftMutation({
			invitationId: 'inv-1',
			expectedDraftUpdatedAt: '2026-07-27T17:22:00.216614+00:00',
			patch: {
				kind: 'section',
				section: 'gallery',
				value: {
					...galleryBaseline.gallery,
					title: 'Recuerdos',
				},
			},
			actor: 'editor',
			skipDocumentSchema: true,
		});

		const savedContent = updateDraftMock.mock.calls[0]![2]!.content as typeof galleryBaseline;
		expect(savedContent.gallery.title).toBe('Recuerdos');
		expect(savedContent.gallery.items[0]?.key).toBe('thank-you-confetti');
		expect(savedContent.gallery.items[0]?.layoutRole).toBe('feature');
		expect(savedContent.gallery.items[0]?.aspectRatio).toBe('8 / 5');
		expect(savedContent.gallery.items[0]?.focalPoint).toBe('72% 36%');
	});
});
