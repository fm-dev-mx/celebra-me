/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/server/env', () => ({
	getEnv: (key: string) =>
		({
			META_CAPI_DELIVERY_MODE: 'production',
			CELEBRA_DEPLOY_ENV: 'production',
			META_CAPI_ACCESS_TOKEN: 'mock-access-token',
			META_PIXEL_ID: 'mock-pixel-id',
			PUBLIC_META_PIXEL_ID: 'mock-pixel-id',
		})[key] ?? '',
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import {
	retryPendingConsentWithdrawal,
	saveConsent,
	VISITOR_STORAGE_KEY,
} from '@/lib/tracking/consent-client';
import { POST } from '@/pages/api/tracking/consent';
import { createApiContext } from '../helpers/api-mocks';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockFetch = jest.fn();
const originalFetch = global.fetch;

const VISITOR_ID = 'visitor_123456';
const CLICK_EVENT_ID = '99999999-9999-4999-8999-999999999999';
const PENDING_KEY = 'cm_consent_withdrawal_pending';

interface StoredSession {
	id: string;
	visitor_id: string;
	client_ip_address: string;
	client_user_agent: string;
	consent_snapshot: {
		necessary: true;
		analytics: boolean;
		marketing: boolean;
		decidedAt?: string;
	};
}

let storage: Map<string, string>;
let sessions: StoredSession[];

/** In-memory stand-in for the Supabase REST tables touched by withdrawal and delivery. */
function fakeRest(options: { pathWithQuery: string; method?: string; body?: unknown }): unknown {
	const { pathWithQuery: path, method, body } = options;
	if (path.startsWith('visitor_sessions?visitor_id=eq.') && method === 'PATCH') {
		const visitorId = decodeURIComponent(path.split('eq.')[1]);
		const patch = body as Pick<StoredSession, 'consent_snapshot'>;
		sessions = sessions.map((row) =>
			row.visitor_id === visitorId ? { ...row, ...patch } : row,
		);
		return null;
	}
	if (path.startsWith('visitor_sessions?id=eq.')) {
		const id = decodeURIComponent(path.slice('visitor_sessions?id=eq.'.length).split('&')[0]);
		return sessions.filter((row) => row.id === id);
	}
	if (path === 'rpc/claim_meta_conversion_event') return [{ id: 'outbox-id', attempt_count: 1 }];
	if (path.startsWith('meta_conversion_events?id=eq.')) {
		return [
			{
				id: 'outbox-id',
				event_name: 'Contact',
				event_id: CLICK_EVENT_ID,
				customer_id: null,
				session_id: 'session-a',
				event_source_path: '/demos/xv',
				created_at: '2026-10-25T12:00:00.000Z',
				value: null,
				currency: 'MXN',
				customers: null,
				sales_orders: null,
				leads: null,
			},
		];
	}
	if (path === 'rpc/finalize_meta_conversion_event') return [{ id: 'outbox-id' }];
	throw new Error(`Unexpected REST call: ${method ?? 'GET'} ${path}`);
}

function session(id: string, marketing: boolean): StoredSession {
	return {
		id,
		visitor_id: VISITOR_ID,
		client_ip_address: '203.0.113.7',
		client_user_agent: 'Mozilla/5.0 (iPhone)',
		consent_snapshot: { necessary: true, analytics: true, marketing },
	};
}

beforeEach(() => {
	storage = new Map();
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key),
		},
	});
	sessions = [session('session-a', true), session('session-b', true)];
	mockRestRequest.mockReset();
	mockRestRequest.mockImplementation(async (options) => fakeRest(options) as never);
	mockCheckRateLimit.mockResolvedValue(true);
	mockFetch.mockReset();
	mockFetch.mockResolvedValue({ ok: true });
	global.fetch = mockFetch;
});

afterEach(() => {
	global.fetch = originalFetch;
});

async function forwardWithdrawalToRoute(): Promise<Response> {
	const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
	const request = new Request(`https://www.celebra-me.com${url}`, init);
	return POST(createApiContext(request) as never);
}

describe('marketing consent withdrawal', () => {
	it('stops a queued Contact from being sent after the visitor withdraws marketing', async () => {
		// Control: with consent still granted the same row is delivered.
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('sent');
		mockFetch.mockClear();

		storage.set(VISITOR_STORAGE_KEY, VISITOR_ID);
		saveConsent(true, true);
		expect(mockFetch).not.toHaveBeenCalled();

		const withdrawal = saveConsent(false, false);
		expect(mockFetch).toHaveBeenCalledWith('/api/tracking/consent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				visitorId: VISITOR_ID,
				analytics: false,
				decidedAt: withdrawal.updatedAt,
			}),
			keepalive: true,
		});

		const response = await forwardWithdrawalToRoute();
		expect(response.status).toBe(200);
		const withdrawn = {
			necessary: true,
			analytics: false,
			marketing: false,
			decidedAt: withdrawal.updatedAt,
		};
		expect(sessions.map((row) => row.consent_snapshot)).toEqual([withdrawn, withdrawn]);

		mockFetch.mockClear();
		await expect(deliverMetaConversionEvent('outbox-id')).resolves.toBe('skipped');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRestRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ p_error_code: 'CONSENT_REQUIRED' }),
			}),
		);
	});

	it('sends nothing for a visitor that was never tracked', () => {
		saveConsent(false, false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('rejects malformed and rate-limited withdrawals without touching sessions', async () => {
		const send = (body: unknown) =>
			POST(
				createApiContext(
					new Request('https://www.celebra-me.com/api/tracking/consent', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(body),
					}),
				) as never,
			);

		const decidedAt = '2026-10-25T12:05:00.000Z';
		expect((await send({ visitorId: VISITOR_ID, marketing: true, decidedAt })).status).toBe(
			400,
		);
		expect((await send({ visitorId: VISITOR_ID, analytics: true })).status).toBe(400);
		expect(
			(await send({ visitorId: VISITOR_ID, analytics: true, decidedAt: 'yesterday' })).status,
		).toBe(400);
		mockCheckRateLimit.mockResolvedValueOnce(false);
		expect((await send({ visitorId: VISITOR_ID, analytics: true, decidedAt })).status).toBe(
			429,
		);
		expect(mockRestRequest).not.toHaveBeenCalled();
	});

	describe('pending withdrawal retry', () => {
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		beforeEach(() => {
			storage.set(VISITOR_STORAGE_KEY, VISITOR_ID);
		});

		it('keeps a lost withdrawal pending and resends it on the next page load', async () => {
			mockFetch.mockRejectedValueOnce(new TypeError('offline'));
			const withdrawal = saveConsent(true, false);
			await flush();
			expect(JSON.parse(storage.get(PENDING_KEY) ?? 'null')).toEqual({
				visitorId: VISITOR_ID,
				analytics: true,
				decidedAt: withdrawal.updatedAt,
			});

			mockFetch.mockClear();
			retryPendingConsentWithdrawal();
			await flush();
			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
				visitorId: VISITOR_ID,
				analytics: true,
				decidedAt: withdrawal.updatedAt,
			});
			expect(storage.has(PENDING_KEY)).toBe(false);
		});

		it('keeps a rejected withdrawal pending', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			saveConsent(false, false);
			await flush();
			expect(storage.has(PENDING_KEY)).toBe(true);
		});

		it('drops the pending withdrawal when marketing is granted again', async () => {
			mockFetch.mockRejectedValueOnce(new TypeError('offline'));
			saveConsent(false, false);
			await flush();
			saveConsent(true, true);
			expect(storage.has(PENDING_KEY)).toBe(false);

			mockFetch.mockClear();
			retryPendingConsentWithdrawal();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});
});
