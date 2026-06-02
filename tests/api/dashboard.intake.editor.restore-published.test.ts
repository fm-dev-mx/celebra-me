import { POST } from '@/pages/api/dashboard/intake/[id]/editor/restore-published';
import { requireEditorMutationAccess } from '@/lib/intake/editor-api';
import {
	getInvitationEditorContext,
	restoreInvitationEditorFromPublished,
} from '@/lib/intake/services/invitation-editor.service';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/intake/editor-api', () => ({
	requireEditorMutationAccess: jest.fn(),
	requireInvitationId: (id: string | undefined) => id ?? '',
}));

jest.mock('@/lib/intake/services/invitation-editor.service', () => ({
	getInvitationEditorContext: jest.fn(),
	restoreInvitationEditorFromPublished: jest.fn(),
}));

describe('/api/dashboard/intake/[id]/editor/restore-published', () => {
	it('restores published content behind the editor mutation guard', async () => {
		(getInvitationEditorContext as jest.Mock).mockResolvedValue({
			invitation: { id: 'proj-1' },
		});
		(restoreInvitationEditorFromPublished as jest.Mock).mockResolvedValue({ id: 'draft-1' });

		const response = await POST({
			request: createMockRequest({ expectedUpdatedAt: '2026-05-30T01:00:00Z' }),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(requireEditorMutationAccess).toHaveBeenCalled();
		expect(restoreInvitationEditorFromPublished).toHaveBeenCalledWith('proj-1', {
			expectedUpdatedAt: '2026-05-30T01:00:00Z',
		});
	});
});
