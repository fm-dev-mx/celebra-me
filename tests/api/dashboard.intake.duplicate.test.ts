jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn().mockResolvedValue({ userId: 'admin-1' }),
}));

import { POST } from '@/pages/api/dashboard/intake/[id]/duplicate';
import { createMockRequest } from '../helpers/api-mocks';

it('rejects Dashboard demo-duplicate client creation', async () => {
	const response = await POST({
		request: createMockRequest({
			title: 'Copia de demo',
			clientName: '',
			clientEmail: '',
			clientWhatsapp: '',
		}),
		params: { id: 'demo-invitation-id' },
		cookies: {},
	} as never);

	expect(response.status).toBe(403);
	expect(await response.json()).toMatchObject({
		error: {
			code: 'forbidden',
			details: { reason: 'canonical_creation_required', via: 'duplicate' },
		},
	});
});
