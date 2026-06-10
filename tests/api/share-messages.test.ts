import { POST } from '@/pages/api/dashboard/guests/share-messages';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { updateShareMessages } from '@/lib/rsvp/services/dashboard-guests.service';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireDashboardSessionFromLocals: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/dashboard-guests.service', () => ({
	updateShareMessages: jest.fn(),
}));

jest.mock('@/pages/api/dashboard/guests/dashboard-guests-lib', () => ({
	requireDashboardRateLimit: jest.fn().mockResolvedValue(undefined),
}));

const mockSession = requireDashboardSessionFromLocals as jest.MockedFunction<
	typeof requireDashboardSessionFromLocals
>;
const mockUpdateService = updateShareMessages as jest.MockedFunction<typeof updateShareMessages>;

function setup() {
	mockSession.mockReturnValue({
		userId: 'host-1',
		email: 'host@test.com',
		accessToken: 'token',
		role: 'host_client',
		isSuperAdmin: false,
	} as never);
}

describe('POST /api/dashboard/guests/share-messages', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setup();
	});

	it('returns 400 when eventId is missing', async () => {
		const response = await POST({
			request: createMockRequest({ invitation: 'Hello', reminder: 'Reminder' }),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toMatchObject({
			success: false,
			error: { code: 'bad_request', message: 'eventId is required.' },
		});
	});

	it('returns 400 when invitation exceeds 500 characters', async () => {
		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'A'.repeat(501),
				reminder: 'Reminder',
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(400);
	});

	it('returns 400 when reminder exceeds 500 characters', async () => {
		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'Invitation',
				reminder: 'R'.repeat(501),
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(400);
	});

	it('passes trimmed values to service and returns result', async () => {
		mockUpdateService.mockResolvedValue({
			shareMessages: { invitation: 'Custom invitation', reminder: 'Custom reminder' },
			reminderSettings: {
				enabled: true,
				showWhenDaysBeforeEvent: 7,
				audience: 'unconfirmed',
			},
		});

		const response = await POST({
			request: createMockRequest({
				eventId: '  evt-1  ',
				invitation: '  Custom invitation  ',
				reminder: '  Custom reminder  ',
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(200);
		expect(mockUpdateService).toHaveBeenCalledWith({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: 'Custom invitation', reminder: 'Custom reminder' },
			reminderSettings: null,
		});

		const body = await response.json();
		expect(body).toEqual({
			shareMessages: { invitation: 'Custom invitation', reminder: 'Custom reminder' },
			reminderSettings: {
				enabled: true,
				showWhenDaysBeforeEvent: 7,
				audience: 'unconfirmed',
			},
		});
	});

	it('requires authentication', async () => {
		mockSession.mockImplementation(() => {
			throw new Error('Unauthorized');
		});

		const response = await POST({
			request: createMockRequest({ eventId: 'evt-1' }),
			locals: {},
		} as never);

		expect(response.status).toBe(500);
	});

	it('applies rate limiting', async () => {
		mockUpdateService.mockResolvedValue({
			shareMessages: { invitation: 'Test', reminder: 'Test' },
			reminderSettings: {
				enabled: true,
				showWhenDaysBeforeEvent: 7,
				audience: 'unconfirmed',
			},
		});

		await POST({
			request: createMockRequest({ eventId: 'evt-1', invitation: 'Hi', reminder: 'Bye' }),
			locals: { session: mockSession },
		} as never);

		expect(requireDashboardRateLimit).toHaveBeenCalledWith(
			'share-messages:host-1',
			expect.any(Object),
		);
	});

	it('passes valid reminderSettings to service', async () => {
		mockUpdateService.mockResolvedValue({
			shareMessages: { invitation: 'Inv', reminder: 'Rem' },
			reminderSettings: { enabled: true, showWhenDaysBeforeEvent: 3, audience: 'all-shared' },
		});

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'Inv',
				reminder: 'Rem',
				reminderSettings: {
					enabled: true,
					showWhenDaysBeforeEvent: 3,
					audience: 'all-shared',
				},
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(200);
		expect(mockUpdateService).toHaveBeenCalledWith({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: 'Inv', reminder: 'Rem' },
			reminderSettings: { enabled: true, showWhenDaysBeforeEvent: 3, audience: 'all-shared' },
		});
	});

	it('returns 400 when reminderSettings has invalid audience', async () => {
		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'Inv',
				reminder: 'Rem',
				reminderSettings: {
					enabled: true,
					showWhenDaysBeforeEvent: 3,
					audience: 'invalid-value',
				},
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(400);
	});

	it('returns 400 when reminderSettings has negative days', async () => {
		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'Inv',
				reminder: 'Rem',
				reminderSettings: {
					enabled: true,
					showWhenDaysBeforeEvent: -1,
					audience: 'unconfirmed',
				},
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(400);
	});

	it('works without reminderSettings (backward compatible)', async () => {
		mockUpdateService.mockResolvedValue({
			shareMessages: { invitation: 'Inv', reminder: 'Rem' },
			reminderSettings: {
				enabled: true,
				showWhenDaysBeforeEvent: 7,
				audience: 'unconfirmed',
			},
		});

		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				invitation: 'Inv',
				reminder: 'Rem',
			}),
			locals: { session: mockSession },
		} as never);

		expect(response.status).toBe(200);
		expect(mockUpdateService).toHaveBeenCalledWith({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: 'Inv', reminder: 'Rem' },
			reminderSettings: null,
		});
	});
});
