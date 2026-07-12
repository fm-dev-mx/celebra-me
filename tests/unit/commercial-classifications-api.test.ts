jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { POST } from '@/pages/api/dashboard/commercial/classifications';

const mockAuth = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockRest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

function context(request: Request) {
	return { request, cookies: {} as never } as never;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockAuth.mockResolvedValue({ userId: 'admin-id', isSuperAdmin: true } as never);
});

describe('commercial test classifications API', () => {
	it('classifies an existing record with actor and reason', async () => {
		mockRest
			.mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 'classification-id' }]);
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/classifications',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'classify',
					recordType: 'sales_order',
					recordId: '11111111-1111-4111-8111-111111111111',
					reason: 'Orden creada para validación CAPI',
				}),
			},
		);

		const response = await POST(context(request));
		expect(response.status).toBe(201);
		expect(mockRest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					classified_by: 'admin-id',
					classification: 'test_qa',
				}),
			}),
		);
	});

	it('returns the existing classification for an equivalent repeated request', async () => {
		mockRest
			.mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }])
			.mockResolvedValueOnce([{ id: 'classification-id', reason: 'Validación CAPI' }]);
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/classifications',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'classify',
					recordType: 'sales_order',
					recordId: '11111111-1111-4111-8111-111111111111',
					reason: 'Validación CAPI',
				}),
			},
		);

		const response = await POST(context(request));
		expect(response.status).toBe(200);
		expect(mockRest).toHaveBeenCalledTimes(2);
	});

	it('returns a domain conflict for an incompatible active classification', async () => {
		mockRest
			.mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }])
			.mockResolvedValueOnce([{ id: 'classification-id', reason: 'Otro motivo' }]);
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/classifications',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'classify',
					recordType: 'sales_order',
					recordId: '11111111-1111-4111-8111-111111111111',
					reason: 'Validación CAPI',
				}),
			},
		);

		const response = await POST(context(request));
		expect(response.status).toBe(409);
	});

	it('reverses classification without deleting evidence', async () => {
		mockRest.mockResolvedValueOnce([
			{ id: 'classification-id', revoked_at: '2026-07-11T19:00:00Z' },
		]);
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/classifications',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'revoke',
					classificationId: '22222222-2222-4222-8222-222222222222',
					reason: 'Clasificación corregida por el propietario',
				}),
			},
		);

		const response = await POST(context(request));
		expect(response.status).toBe(200);
		expect(mockRest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PATCH',
				body: expect.objectContaining({ revoked_by: 'admin-id' }),
			}),
		);
	});
});
