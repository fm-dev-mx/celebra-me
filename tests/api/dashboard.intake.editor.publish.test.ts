import { POST } from '@/pages/api/dashboard/intake/[id]/editor/publish';
import { requireEditorMutationAccess } from '@/lib/intake/editor-api';
import { getInvitationEditorContext } from '@/lib/intake/services/invitation-editor.service';
import { publishDraft } from '@/lib/intake/services/publishing.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/intake/editor-api', () => ({
	requireEditorMutationAccess: jest.fn(),
	requireInvitationId: (id: string | undefined) => id ?? '',
}));

jest.mock('@/lib/intake/services/invitation-editor.service', () => ({
	getInvitationEditorContext: jest.fn(),
}));

jest.mock('@/lib/intake/services/publishing.service', () => ({
	publishDraft: jest.fn(),
}));

const payload = {
	draftRevision: '2026-07-18T00:00:00.000Z',
	publishedVersion: 1,
	publicMetadataHash: '0'.repeat(32),
	projectionHash: '1'.repeat(32),
	idempotencyKey: '00000000-0000-4000-8000-000000000001',
};

describe('/api/dashboard/intake/[id]/editor/publish', () => {
	it('never caches a successful publication response', async () => {
		(publishDraft as jest.Mock).mockResolvedValue({ publishedContent: { version: 2 } });
		(getInvitationEditorContext as jest.Mock).mockResolvedValue({
			invitation: { id: 'proj-1' },
		});

		const response = await POST({
			request: createMockRequest(payload),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it.each([
		[
			'authorization',
			() =>
				(requireEditorMutationAccess as jest.Mock).mockRejectedValueOnce(
					new ApiError(401, 'unauthorized', 'No autorizado.'),
				),
			401,
		],
		[
			'validation',
			() =>
				(publishDraft as jest.Mock).mockRejectedValueOnce(
					new ApiError(422, 'bad_request', 'Los datos no son válidos.'),
				),
			422,
		],
		[
			'conflict',
			() =>
				(publishDraft as jest.Mock).mockRejectedValueOnce(
					new ApiError(409, 'conflict', 'El borrador cambió.'),
				),
			409,
		],
		[
			'maintenance',
			() =>
				(publishDraft as jest.Mock).mockRejectedValueOnce(
					new ApiError(503, 'upgrade_required', 'Se requiere mantenimiento.'),
				),
			503,
		],
		[
			'server',
			() =>
				(publishDraft as jest.Mock).mockRejectedValueOnce(
					new ApiError(500, 'internal_error', 'Error interno.'),
				),
			500,
		],
	])('never caches a %s failure', async (_kind, arrange, expectedStatus) => {
		arrange();

		const response = await POST({
			request: createMockRequest(payload),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(expectedStatus);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});
});
