jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftContentConditionally: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

import {
	createDraftRevision,
	updateDraftContentByInvitation,
} from '@/lib/intake/services/draft-generation.service';
import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';

const mockFindDraft = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const mockUpdateDraft = updateDraftContentConditionally as jest.MockedFunction<
	typeof updateDraftContentConditionally
>;
const mockUpdateDraftStatus = updateDraftStatus as jest.MockedFunction<typeof updateDraftStatus>;
const mockFindPublished = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;

const existingDraft = {
	id: 'draft-1',
	invitationId: 'proj-1',
	submissionId: 'sub-1',
	content: { title: 'Original' },
	status: 'draft' as const,
	createdAt: '2026-05-28T14:00:00Z',
	updatedAt: '2026-05-28T14:00:00Z',
};

const reviewedDraft = {
	...existingDraft,
	status: 'reviewed' as const,
};

beforeEach(() => {
	jest.clearAllMocks();
	mockFindPublished.mockResolvedValue(null);
});

describe('createDraftRevision', () => {
	it('reopens approved draft content as an editable revision', async () => {
		const approvedDraft = { ...existingDraft, status: 'approved' as const };
		mockFindDraft.mockResolvedValue(approvedDraft);
		mockUpdateDraftStatus.mockResolvedValue(existingDraft);

		const result = await createDraftRevision('proj-1');

		expect(result.status).toBe('draft');
		expect(mockUpdateDraftStatus).toHaveBeenCalledWith('draft-1', 'draft');
	});

	it('returns an existing editable draft without rewriting it', async () => {
		mockFindDraft.mockResolvedValue(existingDraft);

		const result = await createDraftRevision('proj-1');

		expect(result).toBe(existingDraft);
		expect(mockUpdateDraftStatus).not.toHaveBeenCalled();
	});
});

describe('updateDraftContentByInvitation', () => {
	it('updates content when draft exists and status is draft', async () => {
		mockFindDraft.mockResolvedValue(existingDraft);
		mockUpdateDraft.mockResolvedValue({
			...existingDraft,
			content: { title: 'Updated' },
		});

		const result = await updateDraftContentByInvitation('proj-1', {
			expectedUpdatedAt: existingDraft.updatedAt,
			content: { title: 'Updated' },
		});

		expect(result.content.title).toBe('Updated');
		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', existingDraft.updatedAt, {
			content: { title: 'Updated' },
			status: 'draft',
		});
	});

	it('rejects when no draft exists', async () => {
		mockFindDraft.mockResolvedValue(null);

		await expect(
			updateDraftContentByInvitation('proj-1', {
				expectedUpdatedAt: existingDraft.updatedAt,
				content: {},
			}),
		).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('rejects when draft status is reviewed', async () => {
		mockFindDraft.mockResolvedValue(reviewedDraft);

		await expect(
			updateDraftContentByInvitation('proj-1', {
				expectedUpdatedAt: existingDraft.updatedAt,
				content: {},
			}),
		).rejects.toMatchObject({
			status: 422,
			code: 'invalid_draft_status',
		});
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('rejects when draft status is approved', async () => {
		mockFindDraft.mockResolvedValue({ ...existingDraft, status: 'approved' });

		await expect(
			updateDraftContentByInvitation('proj-1', {
				expectedUpdatedAt: existingDraft.updatedAt,
				content: {},
			}),
		).rejects.toMatchObject({
			status: 422,
			code: 'invalid_draft_status',
		});
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('partial update preserves existing sibling sections', async () => {
		const draftWithFullContent = {
			...existingDraft,
			content: {
				title: 'Original Title',
				description: 'Original Description',
				hero: { name: 'Ana', label: 'XV Anos', variant: 'standard' },
				location: {
					ceremony: { venueName: 'Iglesia' },
					reception: undefined,
					variant: 'standard',
				},
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, _expected, input) => ({
			...draftWithFullContent,
			content: input.content,
		}));

		await updateDraftContentByInvitation('proj-1', {
			expectedUpdatedAt: existingDraft.updatedAt,
			content: { title: 'Updated Title' },
		});

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', existingDraft.updatedAt, {
			content: {
				title: 'Updated Title',
				description: 'Original Description',
				hero: { name: 'Ana', label: 'XV Anos', variant: 'standard' },
				location: {
					ceremony: { venueName: 'Iglesia' },
					reception: undefined,
					variant: 'standard',
				},
			},
			status: 'draft',
		});
	});

	it('updating one nested field does not delete unrelated nested fields', async () => {
		const draftWithFullContent = {
			...existingDraft,
			content: {
				hero: {
					name: 'Ana',
					secondaryName: 'Sofia',
					label: 'XV Anos',
					nickname: 'Anita',
					date: '2027-11-20',
					variant: 'standard',
				},
				family: { fatherName: 'Fernando', motherName: 'Maria', variant: 'standard' },
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, _expected, input) => ({
			...draftWithFullContent,
			content: input.content,
		}));

		await updateDraftContentByInvitation('proj-1', {
			expectedUpdatedAt: existingDraft.updatedAt,
			content: { hero: { name: 'Ana Maria' } },
		});

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', existingDraft.updatedAt, {
			content: {
				hero: {
					name: 'Ana Maria',
					secondaryName: 'Sofia',
					label: 'XV Anos',
					nickname: 'Anita',
					date: '2027-11-20',
					variant: 'standard',
				},
				family: { fatherName: 'Fernando', motherName: 'Maria', variant: 'standard' },
			},
			status: 'draft',
		});
	});

	it('empty content object is safely non-destructive (preserves existing)', async () => {
		const draftWithFullContent = {
			...existingDraft,
			content: {
				title: 'Original Title',
				description: 'Original Description',
				hero: { name: 'Ana', variant: 'standard' },
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, _expected, input) => ({
			...draftWithFullContent,
			content: input.content,
		}));

		await updateDraftContentByInvitation('proj-1', {
			expectedUpdatedAt: existingDraft.updatedAt,
			content: {},
		});

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', existingDraft.updatedAt, {
			content: {
				title: 'Original Title',
				description: 'Original Description',
				hero: { name: 'Ana', variant: 'standard' },
			},
			status: 'draft',
		});
	});

	it('returns an explicit conflict for a stale compatibility-path save', async () => {
		mockFindDraft.mockResolvedValue(existingDraft);
		mockUpdateDraft.mockResolvedValue(null);

		await expect(
			updateDraftContentByInvitation('proj-1', {
				expectedUpdatedAt: '2026-05-28T13:00:00Z',
				content: { title: 'Stale' },
			}),
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
	});
});
