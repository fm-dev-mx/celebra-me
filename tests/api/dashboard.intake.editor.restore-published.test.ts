import { POST } from '@/pages/api/dashboard/intake/[id]/editor/restore-published';
import { requireEditorMutationAccess } from '@/lib/intake/editor-api';
import {
	getInvitationEditorContext,
	restoreInvitationEditorFromPublished,
} from '@/lib/intake/services/invitation-editor.service';
import { createMockRequest } from '../helpers/api-mocks';
import { createRuntimeMutationCommandContext } from '@/lib/server/runtime-mutation-context';

jest.mock('@/lib/intake/editor-api', () => ({
	requireEditorMutationAccess: jest.fn(),
	requireInvitationId: (id: string | undefined) => id ?? '',
}));

jest.mock('@/lib/intake/services/invitation-editor.service', () => ({
	getInvitationEditorContext: jest.fn(),
	restoreInvitationEditorFromPublished: jest.fn(),
}));

jest.mock('@/lib/server/runtime-mutation-context', () => ({
	createRuntimeMutationCommandContext: jest.fn(),
}));

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_CONTEXT = { operationId: OPERATION_ID, environment: 'local' };

describe('/api/dashboard/intake/[id]/editor/restore-published', () => {
	it('restores published content behind the editor mutation guard', async () => {
		(requireEditorMutationAccess as jest.Mock).mockResolvedValue({ userId: 'admin-1' });
		(createRuntimeMutationCommandContext as jest.Mock).mockResolvedValue(COMMAND_CONTEXT);
		(getInvitationEditorContext as jest.Mock).mockResolvedValue({
			invitation: { id: 'proj-1' },
		});
		(restoreInvitationEditorFromPublished as jest.Mock).mockResolvedValue({ id: 'draft-1' });

		const response = await POST({
			request: createMockRequest({
				operationId: OPERATION_ID,
				expectedDraftUpdatedAt: '2026-05-30T01:00:00Z',
				expectedInvitationUpdatedAt: '2026-05-30T00:00:00Z',
			}),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(requireEditorMutationAccess).toHaveBeenCalled();
		expect(restoreInvitationEditorFromPublished).toHaveBeenCalledWith(
			'proj-1',
			{
				operationId: OPERATION_ID,
				expectedDraftUpdatedAt: '2026-05-30T01:00:00Z',
				expectedInvitationUpdatedAt: '2026-05-30T00:00:00Z',
			},
			COMMAND_CONTEXT,
		);
	});
});
