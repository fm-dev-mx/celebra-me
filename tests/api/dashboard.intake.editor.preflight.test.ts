import { GET } from '@/pages/api/dashboard/intake/[id]/editor/preflight';
import { requireEditorReadAccess } from '@/lib/intake/editor-api';
import { getPublicationPreflight } from '@/lib/intake/services/publishing.service';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/intake/editor-api', () => ({
	requireEditorReadAccess: jest.fn(),
	requireInvitationId: (id: string | undefined) => id ?? '',
}));

jest.mock('@/lib/intake/services/publishing.service', () => ({
	getPublicationPreflight: jest.fn(),
}));

describe('/api/dashboard/intake/[id]/editor/preflight', () => {
	it('is authorized, read-only, and never cacheable', async () => {
		(getPublicationPreflight as jest.Mock).mockResolvedValue({
			changedPaths: ['content.envelope.recipientName'],
			changedSections: [{ path: 'content.envelope.recipientName', sectionId: 'envelope' }],
			draftRevision: '2026-07-17T00:00:00.000Z',
			publishedVersion: 1,
			publicMetadataHash: '00000000000000000000000000000000',
			projectionHash: '11111111111111111111111111111111',
		});

		const response = await GET({
			request: new Request('http://localhost/api/dashboard/intake/proj-1/editor/preflight'),
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(requireEditorReadAccess).toHaveBeenCalledTimes(1);
		expect(getPublicationPreflight).toHaveBeenCalledWith('proj-1');
	});

	it('never caches authorization or preflight failures', async () => {
		(requireEditorReadAccess as jest.Mock).mockRejectedValueOnce(
			new ApiError(403, 'forbidden', 'No tienes permiso para ver esta invitación.'),
		);

		const response = await GET({
			request: new Request('http://localhost/api/dashboard/intake/proj-1/editor/preflight'),
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(403);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});
});
