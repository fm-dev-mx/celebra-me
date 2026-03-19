import { GET } from '@/pages/api/dashboard/guests/stream';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { listDashboardGuests } from '@/lib/rsvp/services/dashboard-guests.service';
import { subscribeGuestStreamEvent } from '@/lib/rsvp/core/stream';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TextEncoder as NodeTextEncoder } from 'node:util';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	listDashboardGuests: jest.fn(),
}));

jest.mock('@/lib/rsvp/core/stream', () => ({
	subscribeGuestStreamEvent: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const listDashboardGuestsMock = listDashboardGuests as jest.MockedFunction<
	typeof listDashboardGuests
>;
const subscribeGuestStreamEventMock = subscribeGuestStreamEvent as jest.MockedFunction<
	typeof subscribeGuestStreamEvent
>;

function createRequestWithSignal(): Request {
	return {
		headers: { get: () => null },
		signal: {
			addEventListener: jest.fn(),
		},
	} as unknown as Request;
}

describe('GET /api/dashboard/guests/stream', () => {
	const originalReadableStream = global.ReadableStream;
	const originalTextEncoder = global.TextEncoder;

	beforeEach(() => {
		(global as unknown as { ReadableStream: typeof global.ReadableStream }).ReadableStream =
			NodeReadableStream as unknown as typeof global.ReadableStream;
		(global as unknown as { TextEncoder: typeof global.TextEncoder }).TextEncoder =
			NodeTextEncoder as unknown as typeof global.TextEncoder;
		requireHostSessionMock.mockResolvedValue({
			userId: 'host-1',
			email: 'host@test.com',
			accessToken: 'token',
		});
		listDashboardGuestsMock.mockResolvedValue({
			eventId: 'evt-1',
			items: [],
			totals: {
				totalInvitations: 0,
				totalPeople: 0,
				pendingInvitations: 0,
				pendingPeople: 0,
				confirmedInvitations: 0,
				confirmedPeople: 0,
				declinedInvitations: 0,
				declinedPeople: 0,
				viewed: 0,
			},
			updatedAt: new Date().toISOString(),
		});
		subscribeGuestStreamEventMock.mockReturnValue(() => {});
	});

	afterEach(() => {
		(global as unknown as { ReadableStream?: typeof global.ReadableStream }).ReadableStream =
			originalReadableStream;
		(global as unknown as { TextEncoder?: typeof global.TextEncoder }).TextEncoder =
			originalTextEncoder;
		jest.clearAllMocks();
	});

	it('returns 401 if host session is missing', async () => {
		requireHostSessionMock.mockRejectedValue(
			new ApiError(401, 'unauthorized', 'No autorizado.'),
		);
		const response = await GET({
			request: createRequestWithSignal(),
			url: new URL('http://localhost/api/dashboard/guests/stream?eventId=evt-1'),
		} as never);
		expect(response.status).toBe(401);
	});

	it('returns 400 when eventId is missing', async () => {
		const response = await GET({
			request: createRequestWithSignal(),
			url: new URL('http://localhost/api/dashboard/guests/stream'),
		} as never);
		expect(response.status).toBe(400);
	});

	it('returns SSE response when authorized and event exists', async () => {
		const response = await GET({
			request: createRequestWithSignal(),
			url: new URL('http://localhost/api/dashboard/guests/stream?eventId=evt-1'),
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/event-stream');
		expect(subscribeGuestStreamEventMock).toHaveBeenCalledWith('evt-1', expect.any(Function));
	});
});
