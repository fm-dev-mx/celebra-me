/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => {
	const { ApiError } = jest.requireActual(
		'@/lib/rsvp/core/errors',
	) as typeof import('@/lib/rsvp/core/errors');
	return {
		requireDashboardMutationAccess: jest.fn(
			async (_request: Request, _cookies: unknown, locals: { session?: unknown }) => {
				if (!locals?.session) throw new ApiError(401, 'unauthorized', 'No autorizado.');
				return locals.session;
			},
		),
	};
});

jest.mock('@/lib/rsvp/services/shared/dashboard-guest-context', () => ({
	getEventAccessOrThrow: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/rsvp-deadline.service', () => ({
	updateRsvpDeadline: jest.fn(),
}));

import { getEventAccessOrThrow } from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { updateRsvpDeadline } from '@/lib/rsvp/services/rsvp-deadline.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { POST } from '@/pages/api/dashboard/guests/rsvp-deadline';

const getEventAccess = getEventAccessOrThrow as jest.Mock;
const updateDeadline = updateRsvpDeadline as jest.Mock;

const authorizedLocals = {
	session: {
		userId: 'user-1',
		email: 'user@test.com',
		accessToken: 'token-1',
		role: 'host_client' as const,
		isSuperAdmin: false,
	},
};

const event = { id: 'event-1', slug: 'naomi-huerta', eventType: 'xv', rsvpDeadline: null };

function call(body: Record<string, unknown>, locals: object = authorizedLocals) {
	const request = new Request('http://localhost/api/dashboard/guests/rsvp-deadline', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return POST({
		request,
		locals,
		cookies: { get: () => undefined },
		params: {},
		url: new URL(request.url),
	} as never) as Promise<Response>;
}

describe('POST /api/dashboard/guests/rsvp-deadline', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getEventAccess.mockResolvedValue(event);
	});

	it('rejects requests without a session', async () => {
		const response = await call({ eventId: 'event-1', deadline: '2026-11-20' }, {});
		expect(response.status).toBe(401);
		expect(updateDeadline).not.toHaveBeenCalled();
	});

	it('requires eventId and the deadline key', async () => {
		expect((await call({ deadline: '2026-11-20' })).status).toBe(400);
		expect((await call({ eventId: 'event-1' })).status).toBe(400);
		expect(updateDeadline).not.toHaveBeenCalled();
	});

	it('checks event access before saving', async () => {
		getEventAccess.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'Sin acceso.'));
		const response = await call({ eventId: 'event-2', deadline: '2026-11-20' });
		expect(response.status).toBe(403);
		expect(getEventAccess).toHaveBeenCalledWith('event-2', 'token-1');
		expect(updateDeadline).not.toHaveBeenCalled();
	});

	it('returns 400 when the deadline is after the event', async () => {
		updateDeadline.mockRejectedValueOnce(
			new ApiError(400, 'bad_request', 'La fecha límite no puede ser posterior.'),
		);
		const response = await call({ eventId: 'event-1', deadline: '2026-12-31' });
		expect(response.status).toBe(400);
	});

	it('returns 409 deadline_in_past until the host confirms', async () => {
		updateDeadline.mockRejectedValueOnce(
			new ApiError(409, 'deadline_in_past', 'Esa fecha ya pasó.'),
		);
		const response = await call({ eventId: 'event-1', deadline: '2026-11-01' });
		expect(response.status).toBe(409);
		const payload = (await response.json()) as { code?: string; error?: { code?: string } };
		expect(JSON.stringify(payload)).toContain('deadline_in_past');
		expect(updateDeadline).toHaveBeenCalledWith({
			event,
			deadline: '2026-11-01',
			confirmPast: false,
		});
	});

	it('saves and returns the new RSVP window', async () => {
		const window = {
			deadline: '2026-11-01',
			label: '1 de noviembre de 2026',
			closed: true,
			eventDate: '2026-11-28',
			eventTimeZone: 'America/Chihuahua',
		};
		updateDeadline.mockResolvedValueOnce(window);
		const response = await call({
			eventId: 'event-1',
			deadline: '2026-11-01',
			confirmPast: true,
		});
		expect(response.status).toBe(200);
		expect(JSON.stringify(await response.json())).toContain('1 de noviembre de 2026');
		expect(updateDeadline).toHaveBeenCalledWith({
			event,
			deadline: '2026-11-01',
			confirmPast: true,
		});
	});
});
