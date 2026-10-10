import {
	ingestClientEngagementBatch,
	recordServerEngagementEvent,
} from '@/lib/rsvp/engagement/engagement.service';
import { recordGuestEngagementEventsRpc } from '@/lib/rsvp/repositories/engagement.repository';
import { getSupabaseUserByAccessToken } from '@/lib/rsvp/auth/auth';

jest.mock('@/lib/rsvp/repositories/engagement.repository', () => ({
	recordGuestEngagementEventsRpc: jest.fn(),
}));
jest.mock('@/lib/rsvp/auth/auth', () => ({
	resolveAccessTokenFromRequest: (request: Request) =>
		request.headers.get('authorization')?.replace('Bearer ', '') ?? '',
	getSupabaseUserByAccessToken: jest.fn(),
}));

const rpcMock = recordGuestEngagementEventsRpc as jest.MockedFunction<
	typeof recordGuestEngagementEventsRpc
>;
const userMock = getSupabaseUserByAccessToken as jest.MockedFunction<
	typeof getSupabaseUserByAccessToken
>;

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const INVITE = '11111111-2222-4333-8444-555555555555';

function request(headers: Record<string, string> = {}): Request {
	return new Request('https://www.celebra-me.com/api/invitacion/x/events', {
		method: 'POST',
		headers: { 'user-agent': IPHONE, ...headers },
	});
}

const batch = {
	events: [
		{
			clientEventId: '6f1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
			schemaVersion: 1 as const,
			occurredAt: '2026-10-10T18:00:00.000Z',
			pageViewId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
			eventName: 'invitation_opened' as const,
			properties: { entry: 'short_link' as const, isReload: false },
		},
	],
};

describe('guest engagement service', () => {
	const env = { ...process.env };

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.VERCEL = '1';
		process.env.VERCEL_ENV = 'production';
		rpcMock.mockResolvedValue({ status: 'ok', accepted: 1, duplicates: 0, rejected: 0 });
	});

	afterAll(() => {
		process.env = env;
	});

	it('maps client events to ledger rows with server-side traits', async () => {
		await ingestClientEngagementBatch(INVITE, batch, request());
		expect(rpcMock).toHaveBeenCalledWith(
			INVITE,
			[
				{
					client_event_id: batch.events[0].clientEventId,
					schema_version: 1,
					event_name: 'invitation_opened',
					occurred_at: batch.events[0].occurredAt,
					page_view_id: batch.events[0].pageViewId,
					traffic_class: 'guest',
					device_class: 'mobile',
					properties: { entry: 'short_link', is_reload: false },
				},
			],
			null,
		);
		expect(userMock).not.toHaveBeenCalled();
	});

	it('passes the signed-in viewer so the database can classify hosts', async () => {
		userMock.mockResolvedValue({ id: 'user-1' } as never);
		await ingestClientEngagementBatch(
			INVITE,
			batch,
			request({ authorization: 'Bearer token' }),
		);
		expect(rpcMock).toHaveBeenCalledWith(INVITE, expect.any(Array), 'user-1');
	});

	it('degrades to an anonymous viewer when the auth lookup fails', async () => {
		userMock.mockRejectedValue(new Error('auth down'));
		await ingestClientEngagementBatch(
			INVITE,
			batch,
			request({ authorization: 'Bearer token' }),
		);
		expect(rpcMock).toHaveBeenCalledWith(INVITE, expect.any(Array), null);
	});

	it('labels Preview traffic as non_production', async () => {
		process.env.VERCEL_ENV = 'preview';
		await ingestClientEngagementBatch(INVITE, batch, request());
		expect(rpcMock.mock.calls[0][1][0].traffic_class).toBe('non_production');
	});

	it('records server events as bot when forced, without a page view', async () => {
		await recordServerEngagementEvent(
			INVITE,
			{ eventName: 'invitation_link_previewed', properties: { crawlerFamily: 'whatsapp' } },
			request({ 'user-agent': 'WhatsApp/2.24.20.80 A' }),
			{ clientEventId: '7f1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f', forceTrafficClass: 'bot' },
		);
		expect(rpcMock).toHaveBeenCalledWith(
			INVITE,
			[
				expect.objectContaining({
					client_event_id: '7f1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
					event_name: 'invitation_link_previewed',
					page_view_id: null,
					traffic_class: 'bot',
					properties: { crawler_family: 'whatsapp' },
				}),
			],
			null,
		);
	});

	it('never throws from server events', async () => {
		rpcMock.mockRejectedValue(new Error('db down'));
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		await expect(
			recordServerEngagementEvent(
				INVITE,
				{ eventName: 'rsvp_submitted', properties: { attendanceStatus: 'confirmed' } },
				request(),
			),
		).resolves.toBeUndefined();
		warn.mockRestore();
	});
});
