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

describe('applyDraftMutation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		findPublishedMock.mockResolvedValue(null);
	});

	it('rejects stale draft revisions', async () => {
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

	it('preserves unexposed gallery metadata when applying a fields patch', async () => {
		const baseline = {
			gallery: {
				title: 'Galería',
				items: [
					{
						key: 'thank-you-confetti',
						layoutRole: 'feature',
						aspectRatio: '8 / 5',
						alt: 'Confeti',
						focalPoint: '72% 36%',
						image: {
							type: 'uploaded',
							assetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
						},
					},
				],
			},
		};

		findDraftMock.mockResolvedValue({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: baseline,
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

		const savedContent = updateDraftMock.mock.calls[0]![2]!.content as typeof baseline;
		expect(savedContent.gallery.title).toBe('Recuerdos');
		expect(savedContent.gallery.items[0]?.key).toBe('thank-you-confetti');
		expect(savedContent.gallery.items[0]?.layoutRole).toBe('feature');
		expect(savedContent.gallery.items[0]?.aspectRatio).toBe('8 / 5');
		expect(savedContent.gallery.items[0]?.focalPoint).toBe('72% 36%');
		expect(result.draftUpdatedAt).toBe('2026-07-27T18:00:00.000Z');
	});
});
