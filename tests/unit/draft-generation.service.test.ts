jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftStatus: jest.fn(),
}));

import type { InvitationContentDraft } from '@/lib/intake/types';
import { createDraftRevision, getDraft } from '@/lib/intake/services/draft-generation.service';
import {
	findDraftByInvitationId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';

const mockFindDraft = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const mockUpdateStatus = updateDraftStatus as jest.MockedFunction<typeof updateDraftStatus>;

const draftRow: InvitationContentDraft = {
	id: 'draft-1',
	invitationId: 'proj-1',
	submissionId: null,
	content: { title: 'XV Años — Ana Sofía' },
	status: 'approved',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('getDraft', () => {
	it('returns draft when found', async () => {
		mockFindDraft.mockResolvedValue(draftRow);

		const result = await getDraft('proj-1');
		expect(result).toEqual(draftRow);
		expect(mockFindDraft).toHaveBeenCalledWith('proj-1');
	});

	it('returns null when no draft exists', async () => {
		mockFindDraft.mockResolvedValue(null);

		const result = await getDraft('proj-1');
		expect(result).toBeNull();
	});
});

describe('createDraftRevision', () => {
	it('reopens an approved draft for editing', async () => {
		mockFindDraft.mockResolvedValue(draftRow);
		mockUpdateStatus.mockResolvedValue({ ...draftRow, status: 'draft' });

		const result = await createDraftRevision('proj-1');
		expect(mockUpdateStatus).toHaveBeenCalledWith('draft-1', 'draft');
		expect(result.status).toBe('draft');
	});

	it('returns an editable draft unchanged', async () => {
		mockFindDraft.mockResolvedValue({ ...draftRow, status: 'draft' });

		const result = await createDraftRevision('proj-1');
		expect(mockUpdateStatus).not.toHaveBeenCalled();
		expect(result.status).toBe('draft');
	});

	it('rejects when the invitation has no draft', async () => {
		mockFindDraft.mockResolvedValue(null);

		await expect(createDraftRevision('proj-1')).rejects.toThrow('No se encontro un borrador');
	});
});
