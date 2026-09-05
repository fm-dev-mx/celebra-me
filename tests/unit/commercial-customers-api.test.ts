jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/commercial/customer.service', () => ({
	createCommercialCustomer: jest.fn(),
}));

jest.mock('@/lib/commercial/customer.repository', () => ({
	findCommercialCustomerById: jest.fn(),
}));

import { Request as NodeRequest } from 'undici';
import { requireAdminMutationAccess, requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import { findCommercialCustomerById } from '@/lib/commercial/customer.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { GET, POST } from '@/pages/api/dashboard/commercial/customers';

function nodeRequest(
	input: string,
	init?: ConstructorParameters<typeof NodeRequest>[1],
): Request {
	return new NodeRequest(input, init) as unknown as Request;
}

const mockRequireAdminMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockRequireAdminStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockCreateCustomer = createCommercialCustomer as jest.MockedFunction<
	typeof createCommercialCustomer
>;
const mockFindCommercialCustomerById = findCommercialCustomerById as jest.MockedFunction<
	typeof findCommercialCustomerById
>;

function createContext(request: { url: string }) {
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
	mockRequireAdminStrongSession.mockResolvedValue({ isSuperAdmin: true } as never);
	mockCreateCustomer.mockResolvedValue({
		outcome: 'created',
		customer: {
			id: 'customer-id',
			displayName: 'Valentina Hernandez',
			email: 'client@example.com',
			phoneE164: '+526****4567',
		},
	});
	mockFindCommercialCustomerById.mockResolvedValue(null);
});

describe('/api/dashboard/commercial/customers', () => {
	it('creates a commercial customer and links the selected lead as an admin mutation', async () => {
		const request = nodeRequest(
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

		const request = nodeRequest(
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

	describe('GET — customer by ID', () => {
		it('returns customer by ID', async () => {
			mockFindCommercialCustomerById.mockResolvedValue({
				id: 'cust-123',
				displayName: 'Test Customer',
				email: 'test@example.com',
				phoneE164: '+521234567890',
			});

			const request = nodeRequest(
				'https://www.celebra-me.com/api/dashboard/commercial/customers?id=cust-123',
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.data.id).toBe('cust-123');
			expect(mockFindCommercialCustomerById).toHaveBeenCalledWith('cust-123');
		});

		it('returns 404 when customer not found', async () => {
			mockFindCommercialCustomerById.mockResolvedValue(null);

			const request = nodeRequest(
				'https://www.celebra-me.com/api/dashboard/commercial/customers?id=nonexistent',
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.error.code).toBe('not_found');
		});

		it('rejects without id param', async () => {
			const request = nodeRequest(
				'https://www.celebra-me.com/api/dashboard/commercial/customers',
			);

			const response = await GET(createContext(request) as never);

			expect(response.status).toBe(400);
			expect(mockFindCommercialCustomerById).not.toHaveBeenCalled();
		});

		it('authorization: unauthenticated *** 401/403', async () => {
			mockRequireAdminStrongSession.mockRejectedValueOnce(
				new ApiError(401, 'unauthorized', 'Unauthorized.'),
			);

			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/customers?id=some-uuid',
				{ method: 'GET' },
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBeGreaterThanOrEqual(401);
			expect(response.status).toBeLessThanOrEqual(403);
			expect(body.success).toBe(false);
			expect(mockFindCommercialCustomerById).not.toHaveBeenCalled();
		});

		it('authorization: insufficient *** → 403', async () => {
			mockRequireAdminStrongSession.mockRejectedValueOnce(
				new ApiError(403, 'forbidden', 'Not authorized for strong admin access.'),
			);

			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/customers?id=some-uuid',
				{ method: 'GET' },
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(403);
			expect(body.success).toBe(false);
			expect(mockFindCommercialCustomerById).not.toHaveBeenCalled();
		});

		it('authorization: valid *** → 200', async () => {
			mockFindCommercialCustomerById.mockResolvedValue({
				id: 'admin-verified-customer',
				displayName: 'Admin Verified',
				email: 'admin@verified.com',
				phoneE164: '+529876543210',
			});

			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/customers?id=admin-verified-customer',
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.data.id).toBe('admin-verified-customer');
			expect(mockFindCommercialCustomerById).toHaveBeenCalledWith('admin-verified-customer');
		});
	});
});
