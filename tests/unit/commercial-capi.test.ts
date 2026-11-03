let mockDeliveryMode = 'test';
let mockTestEventCode = 'TEST12345';
let mockDeployEnvironment: string | undefined = '';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	hashSha256,
	normalizeAndHashEmail,
	normalizeAndHashPhone,
	deliverMetaConversionEvent,
	enqueueBrowserConversionEvent,
	isBrowserConversionTrigger,
	isMetaCapiDeliveryEnabled,
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
		if (key === 'CELEBRA_DEPLOY_ENV') return mockDeployEnvironment;
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
	mockDeployEnvironment = '';
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
			'https://graph.facebook.com/events?access_token=secret Client@Example.com +52 100 000 0005',
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
		const expected = hashSha256('521000000005');
		expect(normalizeAndHashPhone('+52 100 000 0005')).toBe(expected);
		expect(normalizeAndHashPhone('  52-100-000-0005 ')).toBe(expected);
		expect(normalizeAndHashPhone('')).toBeUndefined();
	});
});

describe('deliverMetaConversionEvent', () => {
	it('allows production mode only when CELEBRA_DEPLOY_ENV is production', async () => {
		mockDeliveryMode = 'production';
		mockDeployEnvironment = 'production';
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
		['an empty CELEBRA_DEPLOY_ENV', ''],
		['a missing CELEBRA_DEPLOY_ENV', undefined],
		['an arbitrary environment', 'staging'],
	] as Array<[string, string | undefined]>)(
		'blocks production mode in %s',
		async (_label, deployEnvironment) => {
			mockDeliveryMode = 'production';
			mockDeployEnvironment = deployEnvironment;
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
						customers: { email: 'client@example.com', phone_e164: '+521000000005' },
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

	it('sends CompleteRegistration like an order event, at its own time and without a value', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-cr', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					id: 'outbox-cr',
					event_name: 'CompleteRegistration',
					event_id: 'complete_registration:order-id',
					customer_id: 'customer-id',
					created_at: '2026-10-26T18:00:00.000Z',
					value: null,
					currency: 'MXN',
					customers: { email: null, phone_e164: '+526681112233' },
					sales_orders: {
						session_id: 'session-id',
						deposit_paid_at: '2026-10-20T12:00:00.000Z',
					},
					leads: { consent_marketing: true },
				},
			])
			.mockResolvedValueOnce([
				{
					id: 'session-id',
					visitor_id: 'visitor-id',
					fbp: 'fb.1.12345',
					fbc: null,
					fbclid: null,
					landing_path: '/',
					client_ip_address: null,
					client_user_agent: null,
				},
			])
			.mockResolvedValueOnce([{ id: 'outbox-cr' }]);
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ fbtrace_id: 'mock-trace' }),
		});

		await expect(deliverMetaConversionEvent('outbox-cr')).resolves.toBe('sent');

		const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
		expect(event.event_name).toBe('CompleteRegistration');
		expect(event.action_source).toBe('chat');
		expect(event.event_time).toBe(Math.floor(Date.parse('2026-10-26T18:00:00.000Z') / 1000));
		expect(event.custom_data).toBeUndefined();
		expect(event.user_data.ph).toEqual([hashSha256('526681112233')]);
		expect(event.user_data.fbp).toBe('fb.1.12345');
	});

	it.each([
		['new order total', 1800],
		['historical deposit', 899],
	])('delivers the stored %s value with hashed identity in test mode', async (_label, value) => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					customer_id: 'customer-id',
					value,
					currency: 'MXN',
					customers: { email: 'client@example.com', phone_e164: '+521000000005' },
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
					visitor_id: 'visitor-id',
					fbp: 'fb.1.12345',
					fbc: 'fb.1.67890',
					fbclid: 'Click123',
					landing_path: '/demos/xv',
					client_ip_address: '203.0.113.7',
					client_user_agent: 'Mozilla/5.0 (iPhone)',
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
		expect(url).toBe('https://graph.facebook.com/v26.0/mock-pixel-id/events');
		expect(url).not.toContain('mock-access-token');

		const body = JSON.parse(requestInit.body);
		expect(body.access_token).toBe('mock-access-token');
		expect(body.test_event_code).toBe('TEST12345');
		expect(body.data[0].action_source).toBe('chat');
		expect(body.data[0].event_name).toBe('Purchase');
		expect(body.data[0].event_id).toBe('purchase:order-id:deposit_paid');
		expect(body.data[0].custom_data.value).toBe(value);
		expect(body.data[0].custom_data.currency).toBe('MXN');
		expect(body.data[0].event_source_url).toBe('https://www.celebra-me.com/demos/xv');

		// Check matching keys are correctly hashed
		expect(body.data[0].user_data.em).toEqual([hashSha256('client@example.com')]);
		expect(body.data[0].user_data.ph).toEqual([hashSha256('521000000005')]);
		expect(body.data[0].user_data.fbp).toBe('fb.1.12345');
		expect(body.data[0].user_data.fbc).toBe('fb.1.67890');
		expect(body.data[0].user_data.client_ip_address).toBe('203.0.113.7');
		expect(body.data[0].user_data.client_user_agent).toBe('Mozilla/5.0 (iPhone)');
		expect(body.data[0].user_data.external_id).toEqual([hashSha256('visitor-id')]);
		expect(JSON.stringify(body.data)).not.toContain('mock-access-token');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: expect.stringContaining(
					'select=id,visitor_id,fbp,fbc,fbclid,landing_path,client_ip_address,client_user_agent',
				),
			}),
		);
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

	it('falls back to the hashed customer ID and omits client signals when the order has no session', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					customer_id: 'customer-id',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

		await deliverMetaConversionEvent('outbox-id');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.data[0].user_data.external_id).toEqual([hashSha256('customer-id')]);
		expect(body.data[0].user_data).not.toHaveProperty('client_ip_address');
		expect(body.data[0].user_data).not.toHaveProperty('client_user_agent');
		expect(body.data[0].action_source).toBe('chat');
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
				'meta_conversion_events?status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.2026-07-11T18%3A30%3A00.000Z)&select=id&order=created_at.asc&limit=20',
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

describe('Meta CAPI browser events', () => {
	const clickEventId = '99999999-9999-4999-8999-999999999999';
	const contactRow = {
		id: 'outbox-id',
		event_name: 'Contact',
		event_id: clickEventId,
		customer_id: null,
		session_id: 'session-id',
		event_source_path: '/demos/xv',
		created_at: '2026-10-25T12:00:00.000Z',
		value: null,
		currency: 'MXN',
		customers: null,
		sales_orders: null,
		leads: null,
	};
	const sessionRow = (marketing: boolean, userAgent: string | null = 'Mozilla/5.0 (iPhone)') => ({
		id: 'session-id',
		visitor_id: 'visitor-id',
		fbp: 'fb.1.12345',
		fbc: null,
		fbclid: null,
		landing_path: '/',
		client_ip_address: '203.0.113.7',
		client_user_agent: userAgent,
		consent_snapshot: { necessary: true, analytics: true, marketing },
	});

	it('queues a browser event idempotently by its Pixel eventID', async () => {
		mockRestRequest.mockImplementation(async (request) =>
			request.method === 'POST' && request.pathWithQuery.startsWith('meta_conversion_events')
				? [{ id: 'outbox-id' }]
				: [],
		);
		const outboxId = await enqueueBrowserConversionEvent({
			trigger: 'whatsapp_contact_clicked',
			eventId: clickEventId,
			sessionId: 'session-id',
			eventSourcePath: '/demos/xv',
		});
		expect(mockRestRequest).toHaveBeenCalledWith({
			pathWithQuery: 'meta_conversion_events?on_conflict=event_id&select=id',
			method: 'POST',
			useServiceRole: true,
			prefer: 'resolution=ignore-duplicates,return=representation',
			body: {
				event_name: 'Contact',
				event_id: clickEventId,
				trigger_status: 'whatsapp_contact_clicked',
				session_id: 'session-id',
				event_source_path: '/demos/xv',
				value: 150,
				currency: 'MXN',
				status: 'pending',
			},
		});
		expect(outboxId).toBe('outbox-id');
	});

	it('returns no row id when the Pixel eventID was already queued', async () => {
		mockRestRequest.mockResolvedValueOnce([]);
		await expect(
			enqueueBrowserConversionEvent({
				trigger: 'page_viewed',
				eventId: clickEventId,
				sessionId: 'session-id',
				eventSourcePath: '/',
			}),
		).resolves.toBeNull();
	});

	it.each([
		['page_viewed', 'PageView'],
		['demo_viewed', 'ViewContent'],
		['package_viewed', 'ViewContent'],
		['form_submitted', 'Lead'],
	] as const)('queues %s as a %s row keyed by its trigger', async (trigger, eventName) => {
		mockRestRequest.mockResolvedValueOnce([]);
		await enqueueBrowserConversionEvent({
			trigger,
			eventId: clickEventId,
			sessionId: 'session-id',
			eventSourcePath: '/',
		});
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					event_name: eventName,
					event_id: clickEventId,
					trigger_status: trigger,
				}),
			}),
		);
	});

	it('recognizes only the first-party events the server mirrors', () => {
		expect(
			[
				'page_viewed',
				'demo_viewed',
				'package_viewed',
				'whatsapp_contact_clicked',
				'form_submitted',
			].every(isBrowserConversionTrigger),
		).toBe(true);
		expect(isBrowserConversionTrigger('cta_clicked')).toBe(false);
		expect(isBrowserConversionTrigger('lead_created')).toBe(false);
		expect(isBrowserConversionTrigger('toString')).toBe(false);
	});

	it.each(['PageView', 'ViewContent'])(
		'sends a %s as a website event with the Pixel event_id and the session external_id',
		async (eventName) => {
			mockRestRequest
				.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
				.mockResolvedValueOnce([{ ...contactRow, event_name: eventName }])
				.mockResolvedValueOnce([sessionRow(true)])
				.mockResolvedValueOnce([{ id: 'outbox-id' }]);
			mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

			await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

			const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
			expect(event).toMatchObject({
				event_name: eventName,
				event_id: clickEventId,
				action_source: 'website',
				event_source_url: 'https://www.celebra-me.com/demos/xv',
			});
			expect(event.user_data.external_id).toEqual([hashSha256('visitor-id')]);
		},
	);

	it('sends a Contact as a website event with the same event_id the Pixel used', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([contactRow])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		const event = body.data[0];
		expect(event.event_name).toBe('Contact');
		expect(event.event_id).toBe(clickEventId);
		expect(event.action_source).toBe('website');
		expect(event.event_source_url).toBe('https://www.celebra-me.com/demos/xv');
		expect(event.event_time).toBe(Math.floor(Date.parse(contactRow.created_at) / 1000));
		expect(event).not.toHaveProperty('custom_data');
		expect(event.user_data).toEqual({
			external_id: [hashSha256('visitor-id')],
			fbp: 'fb.1.12345',
			client_ip_address: '203.0.113.7',
			client_user_agent: 'Mozilla/5.0 (iPhone)',
		});
	});

	it('queues a capture-form Lead with its customer, lead, and estimated value', async () => {
		mockRestRequest.mockResolvedValueOnce([]);
		await enqueueBrowserConversionEvent({
			trigger: 'form_submitted',
			eventId: clickEventId,
			sessionId: 'session-id',
			eventSourcePath: '/',
			customerId: 'customer-id',
			leadId: 'lead-id',
		});
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					event_name: 'Lead',
					trigger_status: 'form_submitted',
					customer_id: 'customer-id',
					lead_id: 'lead-id',
					value: 150,
					currency: 'MXN',
				}),
			}),
		);
	});

	it('preserves an explicit value override on browser conversions', async () => {
		mockRestRequest.mockResolvedValueOnce([]);
		await enqueueBrowserConversionEvent({
			trigger: 'whatsapp_contact_clicked',
			eventId: clickEventId,
			sessionId: 'session-id',
			eventSourcePath: '/demos/xv',
			value: 250,
			currency: 'MXN',
		});
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					event_name: 'Contact',
					value: 250,
					currency: 'MXN',
				}),
			}),
		);
	});

	it('adds the hashed phone to a capture-form Lead that carries its customer', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					...contactRow,
					event_name: 'Lead',
					customer_id: 'customer-id',
					event_source_path: '/',
					customers: { email: null, phone_e164: '+526681112233' },
				},
			])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

		const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
		expect(event.event_name).toBe('Lead');
		expect(event.action_source).toBe('website');
		expect(event.user_data.ph).toEqual([normalizeAndHashPhone('+526681112233')]);
		expect(event.user_data.external_id).toEqual([hashSha256('visitor-id')]);
		expect(event.user_data).not.toHaveProperty('em');
	});

	it('sends consented CRM stages with a hashed lead phone and the lead fbp/fbc', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					...contactRow,
					event_name: 'LeadQuoted',
					event_id: 'crm-lead-stage:lead-id:quoted',
					trigger_status: 'crm_lead_quoted',
					session_id: null,
					leads: {
						consent_marketing: true,
						session_id: 'session-id',
						phone_e164: '+526681112233',
						fbp: 'fb.1.lead-browser',
						fbc: 'fb.1.lead-click',
					},
				},
			])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events_received: 1 }) });

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

		const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
		expect(event).toMatchObject({
			event_name: 'LeadQuoted',
			event_id: 'crm-lead-stage:lead-id:quoted',
			action_source: 'system_generated',
			custom_data: {
				event_source: 'crm',
				lead_event_source: 'Celebra-me',
				lead_stage: 'quoted',
			},
			user_data: {
				ph: [normalizeAndHashPhone('+526681112233')],
				fbp: 'fb.1.lead-browser',
				fbc: 'fb.1.lead-click',
			},
		});
		expect(event.event_source_url).toBeUndefined();
		expect(event.user_data).not.toHaveProperty('client_ip_address');
		expect(event.user_data).not.toHaveProperty('client_user_agent');
		expect(JSON.stringify(event)).not.toContain('+526681112233');
	});

	it.each([
		['lead consent withdrawn', { consent_marketing: false, session_id: 'session-id' }, true],
		['session consent withdrawn', { consent_marketing: true, session_id: 'session-id' }, false],
	] as const)('skips a CRM stage when %s', async (_reason, lead, sessionMarketing) => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					...contactRow,
					event_name: 'LeadPaid',
					trigger_status: 'crm_lead_paid',
					leads: { ...lead, phone_e164: '+526681112233' },
				},
			])
			.mockResolvedValueOnce([sessionRow(sessionMarketing)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'CONSENT_REQUIRED' }),
			}),
		);
	});

	const crmLead = {
		consent_marketing: true,
		session_id: 'session-id',
		phone_e164: '+526681112233',
		fbp: 'fb.1.lead-browser',
		fbc: 'fb.1.lead-click',
	};
	const salesStageRow = (overrides: Record<string, unknown> = {}) => ({
		...contactRow,
		event_name: 'Lead',
		event_id: 'crm-lead-stage:lead-id:qualified',
		trigger_status: 'crm_lead_qualified',
		lead_id: 'lead-id',
		session_id: null,
		event_source_path: null,
		created_at: new Date().toISOString(),
		leads: crmLead,
		...overrides,
	});
	const confirmedPurchaseRow = (overrides: Record<string, unknown> = {}) =>
		salesStageRow({
			event_name: 'Purchase',
			event_id: 'crm-lead-stage:lead-id:order_confirmed',
			trigger_status: 'crm_lead_order_confirmed',
			value: '2490.00',
			...overrides,
		});
	const pathOfCall = (call: number) =>
		(mockRestRequest.mock.calls[call][0] as { pathWithQuery: string }).pathWithQuery;

	it('sends a qualified lead as a chat Lead with fbc and the hashed phone', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([salesStageRow()])
			// The lead card is not a browser hit, so a session without user agent still delivers.
			.mockResolvedValueOnce([sessionRow(true, null)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events_received: 1 }) });

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

		const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
		expect(event).toMatchObject({
			event_name: 'Lead',
			event_id: 'crm-lead-stage:lead-id:qualified',
			action_source: 'chat',
			custom_data: { event_source: 'crm', lead_stage: 'qualified' },
			user_data: {
				ph: [normalizeAndHashPhone('+526681112233')],
				fbc: 'fb.1.lead-click',
			},
		});
		expect(event.custom_data).not.toHaveProperty('value');
		expect(event.event_source_url).toBeUndefined();
	});

	it('sends a confirmed order as a chat Purchase valued at the package in MXN', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([confirmedPurchaseRow()])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events_received: 1 }) });

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');

		const duplicateQuery = pathOfCall(3);
		expect(duplicateQuery).toContain('lead_id=eq.lead-id');
		expect(duplicateQuery).toContain('trigger_status=eq.deposit_paid');
		expect(duplicateQuery).toContain('status=in.(sending,sent,ambiguous)');
		expect(duplicateQuery).toContain('id=neq.outbox-id');
		const event = JSON.parse(mockFetch.mock.calls[0][1].body).data[0];
		expect(event).toMatchObject({
			event_name: 'Purchase',
			action_source: 'chat',
			custom_data: { lead_stage: 'order_confirmed', value: 2490, currency: 'MXN' },
			user_data: { ph: [normalizeAndHashPhone('+526681112233')], fbc: 'fb.1.lead-click' },
		});
	});

	it('skips the confirmed-order Purchase when the deposit Purchase already reached Meta', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([confirmedPurchaseRow()])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([{ id: 'deposit-outbox-id' }])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'PURCHASE_SENT_AT_DEPOSIT' }),
			}),
		);
	});

	it('skips the deposit Purchase of a lead whose confirmed order owns the Purchase', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					trigger_status: 'deposit_paid',
					lead_id: 'lead-id',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: { consent_marketing: true },
				},
			])
			.mockResolvedValueOnce([{ id: 'confirmed-outbox-id' }])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		const duplicateQuery = pathOfCall(2);
		expect(duplicateQuery).toContain('trigger_status=eq.crm_lead_order_confirmed');
		expect(duplicateQuery).toContain('status=in.(pending,sending,failed,sent,ambiguous)');
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'PURCHASE_SENT_AT_ORDER_CONFIRMED' }),
			}),
		);
	});

	it.each([
		['Lead', salesStageRow],
		['Purchase', confirmedPurchaseRow],
	] as const)('skips a chat %s queued more than seven days ago', async (_name, buildRow) => {
		const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([buildRow({ created_at: eightDaysAgo })])
			.mockResolvedValueOnce([sessionRow(true)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'EVENT_TOO_OLD' }),
			}),
		);
	});

	it('skips a browser event when the session no longer has marketing consent', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([{ ...contactRow, event_name: 'Lead' }])
			.mockResolvedValueOnce([sessionRow(false)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'CONSENT_REQUIRED' }),
			}),
		);
	});

	it('skips a browser event whose session has no user agent', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'outbox-id', attempt_count: 1 }])
			.mockResolvedValueOnce([contactRow])
			.mockResolvedValueOnce([sessionRow(true, null)])
			.mockResolvedValueOnce([{ id: 'outbox-id' }]);

		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'MISSING_CLIENT_USER_AGENT' }),
			}),
		);
	});

	it('reports delivery as enabled only outside disabled mode', () => {
		mockDeliveryMode = 'test';
		expect(isMetaCapiDeliveryEnabled()).toBe(true);
		mockDeliveryMode = 'disabled';
		expect(isMetaCapiDeliveryEnabled()).toBe(false);
	});
});
