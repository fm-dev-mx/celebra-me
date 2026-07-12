jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/commercial/customer.service', () => ({
	createCommercialCustomer: jest.fn(),
}));

import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import { POST } from '@/pages/api/dashboard/commercial/customers';

const mockRequireAdminMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockCreateCustomer = createCommercialCustomer as jest.MockedFunction<
	typeof createCommercialCustomer
>;

function createContext(request: Request) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		props: {},
		locals: {},
		cookies: {} as never,
		redirect: jest.fn() as never,
		rewrite: jest.fn() as never,
		site: undefined,
		generator: 'Astro',
		clientAddress: '127.0.0.1',
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireAdminMutationAccess.mockResolvedValue({
		userId: 'admin-user-id',
		isSuperAdmin: true,
	} as never);
	mockCreateCustomer.mockResolvedValue({
		outcome: 'created',
		customer: {
			id: 'customer-id',
			displayName: 'Valentina Hernandez',
			email: 'client@example.com',
			phoneE164: '+526****4567',
		},
	});
});

describe('/api/dashboard/commercial/customers', () => {
	it('creates a commercial customer and links the selected lead as an admin mutation', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/customers',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					displayName: 'Valentina Hernandez',
					email: 'Client@Example.COM',
					phone: '+52 614 123 4567',
					createdFromLeadId: 'lead-id',
				}),
			},
		);

		const response = await POST(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockRequireAdminMutationAccess).toHaveBeenCalledWith(
			request,
			{},
			'commercial:customers:create',
		);
		expect(mockCreateCustomer).toHaveBeenCalledWith({
			displayName: 'Valentina Hernandez',
			email: 'Client@Example.COM',
			phone: '+52 614 123 4567',
			createdFromLeadId: 'lead-id',
		});
		expect(body.data).toEqual(
			expect.objectContaining({
				outcome: 'created',
				customer: expect.objectContaining({ id: 'customer-id' }),
			}),
		);
	});

	it('returns 409 with friendly message instead of exposing raw duplicate-key errors', async () => {
		mockCreateCustomer.mockRejectedValue(
			new Error(
				'duplicate key value violates unique constraint "idx_customers_normalized_email_unique"',
			),
		);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/customers',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					displayName: 'Valentina Hernandez',
					email: 'Client@Example.COM',
				}),
			},
		);

		const response = await POST(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('conflict');
		expect(body.error.message).toMatch(/ya existe un cliente/i);
	});
});
