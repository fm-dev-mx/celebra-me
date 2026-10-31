/** @jest-environment node */
jest.mock('@/lib/rsvp/auth/authorization');
jest.mock('@/lib/invitation-data/draft-service');
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { createOrderDraft, getOrderDraftOptions } from '@/lib/invitation-data/draft-service';
import { GET, POST } from '@/pages/api/dashboard/commercial/orders/[orderId]/draft';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createApiContext, createMockRequest } from '../helpers/api-mocks';
const orderId = 'b4000000-0000-4000-8000-000000000001';
function context(body: unknown) {
	return createApiContext(
		createMockRequest(
			body,
			{},
			'https://www.celebra-me.com/api/dashboard/commercial/orders/draft',
		),
		{ orderId },
	) as never;
}
beforeEach(() => jest.resetAllMocks());

it('requires strong admin authentication for reading draft options', async () => {
	jest.mocked(requireAdminStrongSession).mockRejectedValue(
		new ApiError(403, 'forbidden', 'Denied'),
	);
	expect((await GET(context(null))).status).toBe(403);
	expect(getOrderDraftOptions).not.toHaveBeenCalled();
});
it('requires the admin mutation guard before processing input', async () => {
	jest.mocked(requireAdminMutationAccess).mockRejectedValue(
		new ApiError(403, 'forbidden', 'Denied'),
	);
	expect((await POST(context({ themeId: 'editorial' }))).status).toBe(403);
	expect(createOrderDraft).not.toHaveBeenCalled();
});
it('rejects missing design selection', async () => {
	expect((await POST(context({}))).status).toBe(400);
	expect(createOrderDraft).not.toHaveBeenCalled();
});
it('returns created or existing drafts with private cache controls', async () => {
	for (const created of [true, false]) {
		jest.mocked(createOrderDraft).mockResolvedValue({
			invitationId: orderId,
			editorUrl: `/dashboard/invitaciones/${orderId}/editar`,
			created,
		});
		const response = await POST(context({ themeId: 'editorial' }));
		expect(response.status).toBe(created ? 201 : 200);
		expect(response.headers.get('cache-control')).toContain('no-store');
	}
	expect(requireAdminMutationAccess).toHaveBeenCalledWith(
		expect.objectContaining({ url: expect.any(String) }),
		expect.anything(),
		'commercial:invitation-data:write',
	);
});
