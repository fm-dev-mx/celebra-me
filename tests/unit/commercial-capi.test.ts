let mockDeliveryMode = 'test';
let mockTestEventCode = 'TEST12345';

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
} from '@/lib/commercial/meta-capi/service';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock env variables dynamically using local variable
jest.mock('@/lib/server/env', () => ({
	getEnv: (key: string) => {
		if (key === 'META_CAPI_DELIVERY_MODE') return mockDeliveryMode;
		if (key === 'META_TEST_EVENT_CODE') return mockTestEventCode;
		const mockEnv: Record<string, string> = {
			META_CAPI_ACCESS_TOKEN: 'mock-access-token',
			META_PIXEL_ID: 'mock-pixel-id',
			PUBLIC_META_PIXEL_ID: 'mock-pixel-id',
		};
		return mockEnv[key] ?? '';
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockDeliveryMode = 'test'; // Reset default
	mockTestEventCode = 'TEST12345';
});

describe('Meta CAPI service helpers', () => {
	it('hashes strings using SHA-256 in lowercase', () => {
		const raw = ' TestValue ';
		const expected = 'b52ccfce5067e90f4b4f8ec8567eb50f9e10850d6e114a2ea09cb45f753011b9'; // sha256 of 'testvalue'
		expect(hashSha256(raw)).toBe(expected);
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
	it('skips delivery and marks status as skipped when META_CAPI_DELIVERY_MODE is disabled', async () => {
		mockDeliveryMode = 'disabled';

		mockRestRequest
			.mockResolvedValueOnce([
				{ id: 'outbox-id', attempt_count: 0 },
			]) // PATCH status = sending
			.mockResolvedValueOnce([]); // PATCH status = skipped (inside updateStatus)

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('skipped');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PATCH',
				body: expect.objectContaining({
					status: 'skipped',
				}),
			}),
		);
	});

	it('formats the payload with hashed values and sends it to Meta in test mode', async () => {
		mockRestRequest
			.mockResolvedValueOnce([
				{ id: 'outbox-id', attempt_count: 0 },
			]) // PATCH status = sending
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
					leads: null,
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
			.mockResolvedValueOnce([]); // PATCH status = sent

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
	});

	it('enforces route policy and falls back to home page if landing path is a private guest route', async () => {
		mockRestRequest
			.mockResolvedValueOnce([
				{ id: 'outbox-id', attempt_count: 0 },
			]) // PATCH status = sending
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
					leads: null,
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
			.mockResolvedValueOnce([]); // PATCH status = sent

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
		mockRestRequest
			.mockResolvedValueOnce([
				{ id: 'outbox-id', attempt_count: 1 },
			]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: null,
				},
			]) // GET details
			.mockResolvedValueOnce([]); // PATCH status = failed

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
				method: 'PATCH',
				pathWithQuery: 'meta_conversion_events?id=eq.outbox-id',
				body: expect.objectContaining({
					status: 'failed',
					attempt_count: 2,
					last_error_code: '190',
					last_error_message: 'Some Meta CAPI error message',
				}),
			}),
		);
	});

	it('fails with CONFIG_ERROR when META_CAPI_DELIVERY_MODE is test but META_TEST_EVENT_CODE is missing', async () => {
		mockDeliveryMode = 'test';
		mockTestEventCode = '';

		mockRestRequest
			.mockResolvedValueOnce([
				{ id: 'outbox-id', attempt_count: 0 },
			]) // PATCH status = sending
			.mockResolvedValueOnce([
				{
					id: 'outbox-id',
					event_name: 'Purchase',
					event_id: 'purchase:order-id:deposit_paid',
					value: 899,
					currency: 'MXN',
					customers: { email: 'client@example.com' },
					sales_orders: null,
					leads: null,
				},
			]) // GET details
			.mockResolvedValueOnce([]); // PATCH status = failed

		const status = await deliverMetaConversionEvent('outbox-id');

		expect(status).toBe('failed');
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PATCH',
				pathWithQuery: 'meta_conversion_events?id=eq.outbox-id',
				body: expect.objectContaining({
					status: 'failed',
					last_error_code: 'CONFIG_ERROR',
					last_error_message: 'Missing META_TEST_EVENT_CODE in test mode.',
				}),
			}),
		);
	});
});

describe('processPendingMetaConversionEvents', () => {
	it('queries and runs pending outbox conversions', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ id: 'id-1' }, { id: 'id-2' }]) // GET pending list
			.mockResolvedValue([
				{ id: 'mock-id', attempt_count: 0 },
			]); // PATCH status inside deliverMetaConversionEvent

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({}),
		});

		const result = await processPendingMetaConversionEvents();

		expect(result).toEqual({ processed: 2, failed: 0, skipped: 0 });
		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				pathWithQuery: expect.stringContaining('meta_conversion_events?status=in.(pending,failed)'),
			}),
		);
	});
});
