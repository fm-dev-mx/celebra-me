import { POST } from '@/pages/api/dashboard/guests';
import { PATCH } from '@/pages/api/dashboard/guests/[guestId]';
import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import {
	createDashboardGuest,
	updateDashboardGuest,
} from '@/lib/rsvp/services/dashboard-guests.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from './rsvp.helpers';
import { mockAdminSecurityPass } from '../helpers/mock-admin-security';

// Mock funciones de seguridad
mockAdminSecurityPass();

jest.mock('@/lib/rsvp/auth/auth', () => ({
	getSessionContextFromRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	createDashboardGuest: jest.fn(),
	updateDashboardGuest: jest.fn(),
}));

const getSessionContextFromRequestMock = getSessionContextFromRequest as jest.MockedFunction<
	typeof getSessionContextFromRequest
>;
const createDashboardGuestMock = createDashboardGuest as jest.MockedFunction<
	typeof createDashboardGuest
>;
const updateDashboardGuestMock = updateDashboardGuest as jest.MockedFunction<
	typeof updateDashboardGuest
>;

describe('dashboard guests duplicate phone handling', () => {
	beforeEach(() => {
		// Mock funciones de seguridad
		mockAdminSecurityPass();

		const session = {
			userId: 'host-1',
			email: 'host@test.com',
			accessToken: 'token',
			role: 'host_client' as const,
			isSuperAdmin: false,
		};
		getSessionContextFromRequestMock.mockResolvedValue(session);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 409 conflict when creating guest with duplicate phone', async () => {
		const duplicateError = new ApiError(
			409,
			'conflict',
			'Ya existe un invitado con ese número de teléfono en este evento.',
			{
				constraint: 'guest_invitations_event_phone_unique',
				errorCode: 'conflict_duplicate_phone',
			},
		);
		createDashboardGuestMock.mockRejectedValue(duplicateError);

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				fullName: 'Guest Duplicate',
				phone: '6680000000',
				maxAllowedAttendees: 2,
			}),
			url: new URL('http://localhost/api/dashboard/guests'),
		} as never);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('conflict');
		expect(body.error.message).toBe(
			'Ya existe un invitado con ese número de teléfono en este evento.',
		);
	});

	it('returns 409 conflict when updating guest to duplicate phone', async () => {
		const duplicateError = new ApiError(
			409,
			'conflict',
			'Ya existe un invitado con ese número de teléfono en este evento.',
			{
				constraint: 'guest_invitations_event_phone_unique',
				errorCode: 'conflict_duplicate_phone',
			},
		);
		updateDashboardGuestMock.mockRejectedValue(duplicateError);

		const response = await PATCH({
			params: { guestId: 'guest-1' },
			request: createMockRequest({
				phone: '6680000001',
				fullName: 'Updated Guest',
			}),
			url: new URL('http://localhost/api/dashboard/guests/guest-1'),
		} as never);

		expect(response.status).toBe(409);

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('conflict');
		expect(body.error.message).toBe(
			'Ya existe un invitado con ese número de teléfono en este evento.',
		);
	});

	it('handles generic 23505 PostgreSQL error code via ApiError', async () => {
		const duplicateError = new ApiError(
			409,
			'conflict',
			'Ya existe un registro con los mismos datos.',
			{ errorCode: 'conflict_unique_violation' },
		);
		createDashboardGuestMock.mockRejectedValue(duplicateError);

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '6680000000',
				maxAllowedAttendees: 2,
			}),
			url: new URL('http://localhost/api/dashboard/guests'),
		} as never);

		expect(response.status).toBe(409);

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('conflict');
		expect(body.error.message).toBe('Ya existe un registro con los mismos datos.');
	});

	it('handles plain Error with 23505 code (should return 500 since service converts it)', async () => {
		const duplicateError = new Error('23505: duplicate key value violates unique constraint');
		createDashboardGuestMock.mockRejectedValue(duplicateError);

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '6680000000',
				maxAllowedAttendees: 2,
			}),
			url: new URL('http://localhost/api/dashboard/guests'),
		} as never);

		expect(response.status).toBe(500);

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
	});

	it('handles other errors with 500 internal error', async () => {
		const genericError = new Error('Some other database error');
		createDashboardGuestMock.mockRejectedValue(genericError);

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '6680000000',
				maxAllowedAttendees: 2,
			}),
			url: new URL('http://localhost/api/dashboard/guests'),
		} as never);

		expect(response.status).toBe(500);

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
	});
});
