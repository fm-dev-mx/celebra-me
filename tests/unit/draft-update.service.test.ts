jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByProjectId: jest.fn(),
	updateDraftContent: jest.fn(),
}));

import { updateDraftContentByProject } from '@/lib/intake/services/draft-generation.service';
import {
	findDraftByProjectId,
	updateDraftContent,
} from '@/lib/intake/repositories/invitation-content-draft.repository';

const mockFindDraft = findDraftByProjectId as jest.MockedFunction<typeof findDraftByProjectId>;
const mockUpdateDraft = updateDraftContent as jest.MockedFunction<typeof updateDraftContent>;

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
});
