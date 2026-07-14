let mockDeliveryMode = 'test';
let mockTestEventCode = 'TEST12345';
let mockVercelEnvironment: string | undefined = '';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	hashSha256,
	normalizeAndHashEmail,
	normalizeAndHashPhone,
	deliverMetaConversionEvent,
	processPendingMetaConversionEvents,
	sanitizeProviderError,
} from '@/lib/commercial/meta-capi/service';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

// Mock global fetch
const originalFetch = global.fetch;
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock env variables dynamically using local variable
jest.mock('@/lib/server/env', () => ({
	getEnv: (key: string) => {
		if (key === 'META_CAPI_DELIVERY_MODE') return mockDeliveryMode;
		if (key === 'META_TEST_EVENT_CODE') return mockTestEventCode;
		if (key === 'VERCEL_ENV') return mockVercelEnvironment;
		const mockEnv: Record<string, string> = {
			META_CAPI_ACCESS_TOKEN: 'mock-access-token',
			META_PIXEL_ID: 'mock-pixel-id',
			PUBLIC_META_PIXEL_ID: 'mock-pixel-id',
		};
		return mockEnv[key] ?? '';
	},
}));

beforeEach(() => {
	mockRestRequest.mockReset();
	mockFetch.mockReset();
	global.fetch = mockFetch;
	mockDeliveryMode = 'test'; // Reset default
	mockTestEventCode = 'TEST12345';
	mockVercelEnvironment = '';
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
	global.fetch = originalFetch;
});

function enqueueDeliverableEvent(eventId = 'purchase:order-id:deposit_paid'): void {
	mockRestRequest
		.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
		.mockResolvedValueOnce([
			{
				id: 'outbox-id',
				event_name: 'Purchase',
				event_id: eventId,
				value: 899,
				currency: 'MXN',
				customers: { email: 'client@example.com' },
				sales_orders: null,
				leads: { consent_marketing: true },
			},
		])
		.mockResolvedValueOnce([{ id: 'outbox-id' }]);
}

describe('Meta CAPI service helpers', () => {
	it('hashes strings using SHA-256 in lowercase', () => {
		const raw = ' TestValue ';
		const expected = 'b52ccfce5067e90f4b4f8ec8567eb50f9e10850d6e114a2ea09cb45f753011b9'; // sha256 of 'testvalue'
		expect(hashSha256(raw)).toBe(expected);
	});

	it('sanitizes provider errors deterministically without tokens, URLs, or raw identity', () => {
		const sanitized = sanitizeProviderError(
			'https://graph.facebook.com/events?access_token=secret Client@Example.com +52 614 123 4567',
		);
		expect(sanitized).not.toContain('secret');
		expect(sanitized).not.toContain('Client@Example.com');
		expect(sanitized).not.toContain('614 123');
		expect(sanitized.length).toBeLessThanOrEqual(300);
	});

	it('normalizes and hashes emails', () => {
		expect(normalizeAndHashEmail(' Client@Example.COM ')).toBe(
			hashSha256('client@example.com'),
		);
		expect(normalizeAndHashEmail('not-an-email')).toBeUndefined();
		expect(normalizeAndHashEmail('')).toBeUndefined();
	});

	it('normalizes and hashes phone numbers to digits-only E.164 without the plus sign', () => {
		const expected = hashSha256('526141234567');
		expect(normalizeAndHashPhone('+52 614 123 4567')).toBe(expected);
		expect(normalizeAndHashPhone('  52-614-123-4567 ')).toBe(expected);
		expect(normalizeAndHashPhone('')).toBeUndefined();
	});
});

describe('deliverMetaConversionEvent', () => {
	it('allows production mode only when VERCEL_ENV is production', async () => {
		mockDeliveryMode = 'production';
		mockVercelEnvironment = 'production';
		enqueueDeliverableEvent();
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ events_received: 1 }),
		});

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('sent');
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(requestBody.test_event_code).toBeUndefined();
	});

	it.each([
		['preview', 'preview'],
		['development', 'development'],
		['uppercase production', 'PRODUCTION'],
		['production with leading whitespace', ' production'],
		['production with trailing whitespace', 'production '],
		['an empty VERCEL_ENV', ''],
		['a missing VERCEL_ENV', undefined],
		['an arbitrary environment', 'staging'],
	] as Array<[string, string | undefined]>)(
		'blocks production mode in %s',
		async (_label, vercelEnvironment) => {
			mockDeliveryMode = 'production';
			mockVercelEnvironment = vercelEnvironment;
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
				.mockResolvedValueOnce([{ id: 'outbox-id' }]);

			const status = await deliverMetaConversionEvent('outbox-id');

			expect(status).toBe('skipped');
			expect(mockFetch).not.toHaveBeenCalled();
			expect(mockRestRequest).toHaveBeenLastCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						p_status: 'skipped',
						p_error_code: 'DELIVERY_DISABLED',
						p_next_attempt_at: null,
					}),
				}),
			);
		},
	);

	it('skips delivery and marks status as skipped when META_CAPI_DELIVERY_MODE is disabled', async () => {
		mockDeliveryMode = 'disabled';

		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }]) // PATCH status = sending
			.mockResolvedValueOnce([{ id: 'outbox-id' }]); // fenced finalize = skipped

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('skipped');
		// No Meta CAPI fetch request should be made when delivery mode is disabled
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'skipped',
				}),
			}),
		);
	});

	it.each([
		['missing', null],
		['rejected', false],
	])(
		'skips %s marketing consent before preparing Meta user data',
		async (_label, consentMarketing) => {
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
				.mockResolvedValueOnce([
					{
						id: 'outbox-id',
						event_name: 'Purchase',
						event_id: 'purchase:order-id:deposit_paid',
						value: 899,
						currency: 'MXN',
						customers: { email: 'client@example.com', phone_e164: '+526141234567' },
						sales_orders: null,
						leads:
							consentMarketing === null
								? null
								: { consent_marketing: consentMarketing },
					},
				])
				.mockResolvedValueOnce([{ id: 'outbox-id' }]);

			const status = await deliverMetaConversionEvent('outbox-id');

			expect(status).toBe('skipped');
			expect(mockFetch).not.toHaveBeenCalled();
			expect(mockRestRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						p_status: 'skipped',
						p_error_code: 'CONSENT_REQUIRED',
					}),
				}),
			);
		},
	);

	it('does not deliver an event that another worker already claimed', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-11T18:30:00.000Z'));
		mockRestRequest.mockResolvedValueOnce([]);

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('not_claimed');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenCalledWith({
			pathWithQuery: 'rpc/claim_meta_conversion_event',
			method: 'POST',
			useServiceRole: true,
			body: expect.objectContaining({
				p_event_id: 'outbox-id',
				p_lease_seconds: 120,
				p_now: '2026-07-11T18:30:00.000Z',
			}),
		});
	});

	it('reports a zero-row fenced completion as a lost claim without another status mutation', async () => {
		mockDeliveryMode = 'disabled';
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1, claim_id: 'claim-a' }])
			.mockResolvedValueOnce([]);

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('lost_claim');
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'skipped',
					p_claim_id: expect.any(String),
				}),
			}),
		);
	});

	it('formats the payload with hashed values and sends it to Meta in test mode', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com', phone_e164: '+526141234567' },
					sales_orders: {
						session_id: 'session-id',
						deposit_paid_at: '2026-07-08T12:00:00.000Z',
					},
					leads: { consent_marketing: true },
				},
			]) // GET details
			.mockResolvedValueOnce([
				{
					id: 'session-id',
					fbp: 'fb.1.12345',
					fbc: 'fb.1.67890',
					fbclid: 'Click123',
					landing_path: '/demos/xv',
				},
			]) // GET session details
			.mockResolvedValueOnce([{ id: 'outbox-id' }]); // fenced finalize = sent

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ fbtrace_id: 'mock-trace' }),
		});

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('sent');
		expect(mockFetch).toHaveBeenCalledTimes(1);

		const [url, requestInit] = mockFetch.mock.calls[0];
		expect(url).toContain('mock-pixel-id');
		expect(url).toContain('mock-access-token');

		const body = JSON.parse(requestInit.body);
		expect(body.test_event_code).toBe('TEST12345');
		expect(body.data[0].event_name).toBe('Purchase');
		expect(body.data[0].event_id).toBe('purchase:order-id:deposit_paid');
		expect(body.data[0].custom_data.value).toBe(899);
		expect(body.data[0].custom_data.currency).toBe('MXN');
		expect(body.data[0].event_source_url).toBe('https://www.celebra-me.com/demos/xv');

		// Check matching keys are correctly hashed
		expect(body.data[0].user_data.em).toEqual([hashSha256('client@example.com')]);
		expect(body.data[0].user_data.ph).toEqual([hashSha256('526141234567')]);
		expect(body.data[0].user_data.fbp).toBe('fb.1.12345');
		expect(body.data[0].user_data.fbc).toBe('fb.1.67890');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'sent',
					p_payload_hash: expect.any(String),
					p_claim_id: expect.any(String),
				}),
			}),
		);
	});

	it('enforces route policy and falls back to home page if landing path is a private guest route', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: {
						session_id: 'session-id',
						deposit_paid_at: '2026-07-08T12:00:00.000Z',
					},
					leads: { consent_marketing: true },
				},
			]) // GET details
			.mockResolvedValueOnce([
				{
					id: 'session-id',
					fbp: null,
					fbc: null,
					fbclid: null,
					landing_path: '/xv/valentina-hernandez', // Excluded guest route!
				},
			]) // GET session details
			.mockResolvedValueOnce([{ id: 'outbox-id' }]); // fenced finalize = sent

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ fbtrace_id: 'mock-trace' }),
		});

		await deliverMetaConversionEvent('outbox-id');

		const [, requestInit] = mockFetch.mock.calls[0];
		const body = JSON.parse(requestInit.body);
		// Falls back to home page because landing path is a private guest route
		expect(body.data[0].event_source_url).toBe('https://www.celebra-me.com/');
	});

	it('updates outbox to failed with last error message if CAPI request fails', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-11T18:30:00.000Z'));
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 2 }]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			]) // GET details
			.mockResolvedValueOnce([{ id: 'outbox-id' }]); // fenced finalize = failed

		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({
				error: { message: 'Some Meta CAPI error message', code: 190 },
			}),
		});

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('failed');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'failed',
					p_error_code: '190',
					p_error_message: 'Some Meta CAPI error message',
					p_next_attempt_at: '2026-07-11T18:50:00.000Z',
				}),
			}),
		);
	});

	it('marks delivery ambiguous when Meta accepts but sent persistence fails', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			])
			.mockRejectedValueOnce(new Error('database unavailable after Meta acceptance'))
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ events_received: 1, fbtrace_id: 'trace-id' }),
		});

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('ambiguous');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'ambiguous',
					p_error_code: 'PERSISTENCE_AFTER_ACCEPTANCE_FAILED',
					p_next_attempt_at: null,
				}),
			}),
		);
	});

	it('schedules a retry when the Meta network request fails', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-11T18:30:00.000Z'));
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockRejectedValueOnce(new Error('connection reset'));

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('failed');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					p_status: 'failed',
					p_error_code: 'NETWORK_ERROR',
					p_error_message: 'connection reset',
					p_next_attempt_at: '2026-07-11T18:40:00.000Z',
				}),
			}),
		);
	});

	it.each(['TimeoutError', 'AbortError'])(
		'classifies %s from the Meta request timeout as ambiguous',
		async (errorName) => {
			const stableEventId = 'purchase:order-id:deposit_paid';
			const timeoutSignal = new AbortController().signal;
			const timeoutSpy = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal);
			enqueueDeliverableEvent(stableEventId);
			const timeoutError = new Error('The operation was aborted due to timeout');
			timeoutError.name = errorName;
			mockFetch.mockRejectedValueOnce(timeoutError);

			const status = await deliverMetaConversionEvent('outbox-id');

			expect(status).toBe('ambiguous');
			expect(timeoutSpy).toHaveBeenCalledWith(10_000);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ signal: timeoutSignal }),
			);
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.data[0].event_id).toBe(stableEventId);
			expect(mockRestRequest).toHaveBeenLastCalledWith(
				expect.objectContaining({
					pathWithQuery: 'rpc/finalize_meta_conversion_event',
					body: expect.objectContaining({
						p_status: 'ambiguous',
						p_error_code: 'META_REQUEST_TIMEOUT',
						p_next_attempt_at: null,
					}),
				}),
			);
		},
	);

	it('preserves the stable event_id across an approved retry', async () => {
		const stableEventId = 'purchase:order-id:deposit_paid';
		enqueueDeliverableEvent(stableEventId);
		enqueueDeliverableEvent(stableEventId);
		mockFetch.mockResolvedValue({ ok: true, json: async () => ({ events_received: 1 }) });

		await deliverMetaConversionEvent('outbox-id');
		await deliverMetaConversionEvent('outbox-id');

		const eventIds = mockFetch.mock.calls.map(([, requestInit]) => {
			const requestBody = JSON.parse(requestInit.body);
			return requestBody.data[0].event_id;
		});
		expect(eventIds).toEqual([stableEventId, stableEventId]);
	});

	it('fails with CONFIG_ERROR when META_CAPI_DELIVERY_MODE is test but META_TEST_EVENT_CODE is missing', async () => {
		mockTestEventCode = '';

		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			]) // GET details
			.mockResolvedValueOnce([{ id: 'outbox-id' }]); // fenced finalize = failed

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('failed');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/finalize_meta_conversion_event',
				body: expect.objectContaining({
					p_status: 'failed',
					p_error_code: 'CONFIG_ERROR',
					p_error_message: 'Missing META_TEST_EVENT_CODE in test mode.',
				}),
			}),
		);
	});
});

describe('processPendingMetaConversionEvents', () => {
	it('queries pending and due failed outbox conversions and runs claimed rows', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-11T18:30:00.000Z'));
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'id-1' }, { id: 'id-2' }]) // GET pending list
			.mockResolvedValue([
				{
					id: 'mock-id',
					attempt_count: 0,
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: null,
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			]); // claim, detail, and final status updates

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({}),
		});

		const result = await processPendingMetaConversionEvents();

		expect(result).toEqual({ processed: 2, failed: 0, skipped: 0, ambiguous: 0 });
		expect(mockRestRequest).toHaveBeenCalledWith({
			pathWithQuery:
				'meta_conversion_events?status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.2026-07-11T18%3A30%3A00.000Z)&select=id&limit=20',
			method: 'GET',
			useServiceRole: true,
		});
	});

	it('skips all pending events when delivery mode is disabled', async () => {
		mockDeliveryMode = 'disabled';

		mockRestRequest
			.mockResolvedValueOnce([{ id: 'id-1' }, { id: 'id-2' }]) // GET pending list
			.mockResolvedValue([{ id: 'mock-id', attempt_count: 0 }]); // PATCH status inside deliverMetaConversionEvent

		const result = await processPendingMetaConversionEvents();

		expect(result).toEqual({ processed: 0, failed: 0, skipped: 2, ambiguous: 0 });
		// No Meta CAPI fetch request should be made when delivery mode is disabled
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
