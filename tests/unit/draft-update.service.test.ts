jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByProjectId: jest.fn(),
	updateDraftContent: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

import {
	createDraftRevision,
	updateDraftContentByProject,
} from '@/lib/intake/services/draft-generation.service';
import {
	findDraftByProjectId,
	updateDraftContent,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';

const mockFindDraft = findDraftByProjectId as jest.MockedFunction<typeof findDraftByProjectId>;
const mockUpdateDraft = updateDraftContent as jest.MockedFunction<typeof updateDraftContent>;
const mockUpdateDraftStatus = updateDraftStatus as jest.MockedFunction<typeof updateDraftStatus>;

const existingDraft = {
	id: 'draft-1',
	invitationProjectId: 'proj-1',
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

describe('updateDraftContentByProject', () => {
	it('updates content when draft exists and status is draft', async () => {
		mockFindDraft.mockResolvedValue(existingDraft);
		mockUpdateDraft.mockResolvedValue({
			...existingDraft,
			content: { title: 'Updated' },
		});

		const result = await updateDraftContentByProject('proj-1', { title: 'Updated' });

		expect(result.content.title).toBe('Updated');
		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', { title: 'Updated' });
	});

	it('rejects when no draft exists', async () => {
		mockFindDraft.mockResolvedValue(null);

		await expect(updateDraftContentByProject('proj-1', {})).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('rejects when draft status is reviewed', async () => {
		mockFindDraft.mockResolvedValue(reviewedDraft);

		await expect(updateDraftContentByProject('proj-1', {})).rejects.toMatchObject({
			status: 422,
			code: 'invalid_draft_status',
		});
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('rejects when draft status is approved', async () => {
		mockFindDraft.mockResolvedValue({ ...existingDraft, status: 'approved' });

		await expect(updateDraftContentByProject('proj-1', {})).rejects.toMatchObject({
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
				hero: { name: 'Ana', label: 'XV Anos' },
				location: { ceremony: { venueName: 'Iglesia' } },
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, merged) => merged as never);

		await updateDraftContentByProject('proj-1', { title: 'Updated Title' });

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', {
			title: 'Updated Title',
			description: 'Original Description',
			hero: { name: 'Ana', label: 'XV Anos' },
			location: { ceremony: { venueName: 'Iglesia' } },
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
				},
				family: { fatherName: 'Fernando', motherName: 'Maria' },
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, merged) => merged as never);

		await updateDraftContentByProject('proj-1', {
			hero: { name: 'Ana Maria' },
		});

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', {
			hero: {
				name: 'Ana Maria',
				secondaryName: 'Sofia',
				label: 'XV Anos',
				nickname: 'Anita',
				date: '2027-11-20',
			},
			family: { fatherName: 'Fernando', motherName: 'Maria' },
		});
	});

	it('empty content object is safely non-destructive (preserves existing)', async () => {
		const draftWithFullContent = {
			...existingDraft,
			content: {
				title: 'Original Title',
				description: 'Original Description',
				hero: { name: 'Ana' },
			},
		};
		mockFindDraft.mockResolvedValue(draftWithFullContent);
		mockUpdateDraft.mockImplementation(async (_id, merged) => merged as never);

		await updateDraftContentByProject('proj-1', {});

		expect(mockUpdateDraft).toHaveBeenCalledWith('draft-1', {
			title: 'Original Title',
			description: 'Original Description',
			hero: { name: 'Ana' },
		});
	});
});
