/** @jest-environment node */
jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({ requireAdminRateLimit: jest.fn() }));
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
	requireAdminMutationAccess: jest.fn(),
}));
jest.mock('@/lib/commercial/quote-reminders.service', () => ({
	loadQuoteReminders: jest.fn(),
	prepareQuoteReminder: jest.fn(),
}));
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { loadQuoteReminders, prepareQuoteReminder } from '@/lib/commercial/quote-reminders.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { GET, POST } from '@/pages/api/dashboard/commercial/quote-reminders';
import { createApiContext, createMockRequest } from '../helpers/api-mocks';

const input = {
	leadId: '11111111-1111-4111-8111-111111111111',
	idempotencyKey: '22222222-2222-4222-8222-222222222222',
};
beforeEach(() => {
	jest.resetAllMocks();
	jest.mocked(requireAdminMutationAccess).mockResolvedValue({ userId: 'admin' } as never);
	jest.mocked(loadQuoteReminders).mockResolvedValue([]);
});
it('guards the list and returns the standard envelope', async () => {
	const response = await GET(createApiContext(createMockRequest()) as never);
	expect(await response.json()).toEqual({ success: true, data: [] });
	expect(requireAdminRateLimit).toHaveBeenCalledWith(
		expect.anything(),
		'commercial:quote-reminders:read',
	);
	expect(requireAdminStrongSession).toHaveBeenCalled();
});
it('requires strong authentication for reads', async () => {
	jest.mocked(requireAdminStrongSession).mockRejectedValue(
		new ApiError(403, 'forbidden', 'Sin acceso.'),
	);
	expect((await GET(createApiContext(createMockRequest()) as never)).status).toBe(403);
	expect(loadQuoteReminders).not.toHaveBeenCalled();
});
it('runs mutation protection before reading the body or calling the service', async () => {
	jest.mocked(requireAdminMutationAccess).mockRejectedValue(
		new ApiError(403, 'forbidden', 'Sin acceso.'),
	);
	expect((await POST(createApiContext(createMockRequest(input)) as never)).status).toBe(403);
	expect(prepareQuoteReminder).not.toHaveBeenCalled();
});
it.each([{ leadId: 'invalid' }, { ...input, whatsappUrl: 'https://evil.example' }])(
	'rejects malformed or extra inputs',
	async (body) => {
		expect((await POST(createApiContext(createMockRequest(body)) as never)).status).toBe(400);
		expect(prepareQuoteReminder).not.toHaveBeenCalled();
	},
);
it('uses the authenticated actor and surfaces stale candidate conflicts', async () => {
	jest.mocked(prepareQuoteReminder).mockRejectedValue(
		new ApiError(409, 'conflict', 'Actualice la lista.'),
	);
	expect((await POST(createApiContext(createMockRequest(input)) as never)).status).toBe(409);
	expect(prepareQuoteReminder).toHaveBeenCalledWith(input, 'admin');
});
