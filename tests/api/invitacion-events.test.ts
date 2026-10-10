import { POST } from '@/pages/api/invitacion/[inviteId]/events';
import { ingestClientEngagementBatch } from '@/lib/rsvp/engagement/engagement.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/engagement/engagement.service', () => ({
	ingestClientEngagementBatch: jest.fn(),
}));
jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const ingestMock = ingestClientEngagementBatch as jest.MockedFunction<
	typeof ingestClientEngagementBatch
>;
const rateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const INVITE = '11111111-2222-4333-8444-555555555555';
const validBatch = {
	events: [
		{
			clientEventId: '6f1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
			schemaVersion: 1,
			occurredAt: '2026-10-10T18:00:00.000Z',
			pageViewId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
			eventName: 'rsvp_form_viewed',
			properties: {},
		},
	],
};

function call(inviteId: string, body: unknown) {
	return POST({ params: { inviteId }, request: createMockRequest(body) } as never);
}

describe('POST /api/invitacion/:inviteId/events', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		rateLimitMock.mockResolvedValue(true);
		ingestMock.mockResolvedValue({ status: 'ok', accepted: 1, duplicates: 0, rejected: 0 });
	});

	it('accepts a valid batch with 202 and a private cache policy', async () => {
		const response = await call(INVITE, validBatch);
		expect(response.status).toBe(202);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.json()).toEqual({ accepted: 1, duplicates: 0, rejected: 0 });
	});

	it('returns 404 for malformed and unknown invites', async () => {
		expect((await call('not-a-uuid', validBatch)).status).toBe(404);
		expect(ingestMock).not.toHaveBeenCalled();
		ingestMock.mockResolvedValue({ status: 'not_found' });
		expect((await call(INVITE, validBatch)).status).toBe(404);
	});

	it('returns 400 for invalid payloads', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		expect((await call(INVITE, '{not json')).status).toBe(400);
		expect((await call(INVITE, { events: [] })).status).toBe(400);
		expect(ingestMock).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('returns 429 when rate limited', async () => {
		rateLimitMock.mockResolvedValue(false);
		expect((await call(INVITE, validBatch)).status).toBe(429);
	});
});
