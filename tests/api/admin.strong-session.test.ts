import type { APIContext } from 'astro';
import { GET as getEvents } from '@/pages/api/dashboard/admin/events';
import { PATCH as updateEvent } from '@/pages/api/dashboard/admin/events/[eventId]';
import { GET as getUsers, POST as createUser } from '@/pages/api/dashboard/admin/users';
import { GET as getClaimCodes } from '@/pages/api/dashboard/claimcodes';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { listAdminUsers, createAdminUser } from '@/lib/rsvp/services/user-admin.service';
import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { updateEventAdmin } from '@/lib/rsvp/services/event-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	listAllEventsService: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/security/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	listAdminUsers: jest.fn(),
	createAdminUser: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/claim-code-admin.service', () => ({
	listClaimCodesAdmin: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	updateEventAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const requireAdminMutationAccessMock = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;

const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const createAdminUserMock = createAdminUser as jest.MockedFunction<typeof createAdminUser>;
const listClaimCodesAdminMock = listClaimCodesAdmin as jest.MockedFunction<
	typeof listClaimCodesAdmin
>;
const updateEventAdminMock = updateEventAdmin as jest.MockedFunction<typeof updateEventAdmin>;

function createMockContext(options?: {
	payload?: unknown;
	headers?: Record<string, string>;
	url?: string;
	params?: Record<string, string>;
}): APIContext {
	const h = new Headers({ 'Content-Type': 'application/json' });
	for (const [key, value] of Object.entries(options?.headers ?? {})) {
		h.set(key, value);
	}

	const body =
		options?.payload === undefined || options?.payload === null
			? ''
			: typeof options.payload === 'string'
				? options.payload
				: JSON.stringify(options.payload);

	return {
		request: {
			url: options?.url ?? 'http://localhost/api/test',
			json: async () => options?.payload,
			text: async () => body,
			headers: h,
		},
		cookies: {},
		params: options?.params ?? {},
		url: new URL(options?.url ?? 'http://localhost/api/test'),
	} as unknown as APIContext;
}

describe('Admin API Strong Session Guard', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		requireAdminMutationAccessMock.mockResolvedValue({
			userId: 'admin',
			email: 'admin@test.com',
			accessToken: 'token',
			role: 'super_admin',
			isSuperAdmin: true,
		});
	});

	describe('super_admin with AAL1 (no MFA)', () => {
		it('GET /api/dashboard/admin/events returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getEvents(createMockContext());
			expect(response.status).toBe(403);
			const body = await response.json();
			expect(body.error.code).toBe('forbidden');
		});

		it('GET /api/dashboard/admin/users returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getUsers(
				createMockContext({ url: 'http://localhost/api/dashboard/admin/users' }),
			);
			expect(response.status).toBe(403);
		});

		it('POST /api/dashboard/admin/users returns 403', async () => {
			requireAdminMutationAccessMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await createUser(
				createMockContext({
					payload: { role: 'host_client' },
					url: 'http://localhost/api/dashboard/admin/users',
				}),
			);
			expect(response.status).toBe(403);
		});

		it('PATCH /api/dashboard/admin/events/[eventId] returns 403', async () => {
			requireAdminMutationAccessMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await updateEvent(
				createMockContext({
					params: { eventId: '550e8400-e29b-41d4-a716-446655440000' },
				}),
			);
			expect(response.status).toBe(403);
		});

		it('GET /api/dashboard/claimcodes returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getClaimCodes(
				createMockContext({ url: 'http://localhost/api/dashboard/claimcodes' }),
			);
			expect(response.status).toBe(403);
		});
	});

	describe('super_admin with AAL2 (MFA enabled)', () => {
		it('GET /api/dashboard/admin/events returns 200', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const response = await getEvents(createMockContext());
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(Array.isArray(body.items)).toBe(true);
		});

		it('GET /api/dashboard/admin/users returns 200', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminUsersMock.mockResolvedValue([
				{
					id: 'user-1',
					email: 'user@test.com',
					role: 'host_client',
					createdAt: new Date().toISOString(),
					assignedEvents: [],
				},
			]);

			const response = await getUsers(
				createMockContext({ url: 'http://localhost/api/dashboard/admin/users' }),
			);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(Array.isArray(body.items)).toBe(true);
		});

		it('POST /api/dashboard/admin/users returns 201', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			createAdminUserMock.mockResolvedValue({
				item: {
					id: 'user-2',
					email: 'cliente-ab12cd34@clientes.celebra.invalid',
					role: 'host_client',
					createdAt: new Date().toISOString(),
					assignedEvents: [],
				},
				credentials: {
					temporaryPassword: 'TempPass123!aA1',
				},
			});

			const response = await createUser(
				createMockContext({
					payload: { role: 'host_client' },
					url: 'http://localhost/api/dashboard/admin/users',
				}),
			);
			expect(response.status).toBe(201);
		});

		it('PATCH /api/dashboard/admin/events/[eventId] returns 200', async () => {
			requireAdminMutationAccessMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			updateEventAdminMock.mockResolvedValue({
				id: '550e8400-e29b-41d4-a716-446655440000',
				ownerUserId: 'admin-1',
				slug: 'updated-event-title',
				eventType: 'boda',
				title: 'Updated Event Title',
				status: 'draft',
				publishedAt: null,
				invitationId: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			const response = await updateEvent(
				createMockContext({
					params: { eventId: '550e8400-e29b-41d4-a716-446655440000' },
					payload: { title: 'Updated Event Title' },
				}),
			);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item.title).toBe('Updated Event Title');
		});
	});

	describe('host_client (any auth level)', () => {
		it('GET /api/dashboard/admin/events returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'No autorizado'),
			);

			const response = await getEvents(createMockContext());
			expect(response.status).toBe(403);
		});

		it('GET /api/dashboard/claimcodes returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'No autorizado'),
			);

			const response = await getClaimCodes(
				createMockContext({ url: 'http://localhost/api/dashboard/claimcodes' }),
			);
			expect(response.status).toBe(403);
		});
	});

	describe('Error propagation through guard failures', () => {
		it('returns normalized 403 (not 500) when CSRF token is invalid', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(
					403,
					'forbidden',
					'Token CSRF inválido. Por favor recarga la página e intenta de nuevo.',
				),
			);

			const response = await getEvents(
				createMockContext({ headers: { 'X-CSRF-Token': 'bad-token' } }),
			);

			expect(response.status).toBe(403);
			const body = (await response.json()) as { error: { code: string; message: string } };
			expect(body.error.code).toBe('forbidden');
			expect(body.error.message).toContain('CSRF');
		});

		it('returns 403 (not 500) when CSRF validation fails', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Token CSRF inválido.'),
			);

			const response = await getEvents(
				createMockContext({ headers: { 'X-CSRF-Token': 'bad-token' } }),
			);

			expect(response.status).toBe(403);
			const body = (await response.json()) as { error: { code: string } };
			expect(body.error.code).toBe('forbidden');
		});
	});

	describe('Authorization guard is called', () => {
		it('GET /api/dashboard/admin/events calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			await getEvents(createMockContext());
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});

		it('GET /api/dashboard/admin/users calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminUsersMock.mockResolvedValue([]);

			await getUsers(
				createMockContext({ url: 'http://localhost/api/dashboard/admin/users' }),
			);
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});

		it('GET /api/dashboard/claimcodes calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listClaimCodesAdminMock.mockResolvedValue([]);

			await getClaimCodes(
				createMockContext({ url: 'http://localhost/api/dashboard/claimcodes' }),
			);
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});
	});
});
