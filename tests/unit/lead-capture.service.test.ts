jest.mock('@/lib/tracking/repository', () => ({
	upsertVisitorSession: jest.fn(),
	insertTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.repository', () => ({
	findLeadByCode: jest.fn(),
	upsertLead: jest.fn(),
}));

jest.mock('@/lib/commercial/customer.service', () => ({
	createCommercialCustomer: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	enqueueBrowserConversionEvent: jest.fn(),
}));

import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import { enqueueBrowserConversionEvent } from '@/lib/commercial/meta-capi/service';
import { submitLeadCapture } from '@/lib/tracking/lead-capture.service';
import { findLeadByCode, upsertLead } from '@/lib/tracking/lead.repository';
import { insertTrackingEvent, upsertVisitorSession } from '@/lib/tracking/repository';

const mockUpsertVisitorSession = jest.mocked(upsertVisitorSession);
const mockInsertTrackingEvent = jest.mocked(insertTrackingEvent);
const mockFindLeadByCode = jest.mocked(findLeadByCode);
const mockUpsertLead = jest.mocked(upsertLead);
const mockCreateCustomer = jest.mocked(createCommercialCustomer);
const mockEnqueue = jest.mocked(enqueueBrowserConversionEvent);

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const BROWSER_USER_AGENT =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function futureDate(days = 120): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function makeRequest(userAgent = BROWSER_USER_AGENT): Request {
	return new Request('https://www.celebra-me.com/api/leads/capture', {
		method: 'POST',
		headers: { cookie: '', 'user-agent': userAgent, 'cf-connecting-ip': '203.0.113.7' },
	});
}

function makePayload(overrides: Record<string, unknown> = {}) {
	return {
		eventId: EVENT_ID,
		sessionId: SESSION_ID,
		visitorId: 'visitor_123456',
		leadCode: 'CM-ABC234',
		routePath: '/',
		source: 'facebook',
		medium: 'paid',
		campaign: 'octubre',
		metaAttribution: { fbp: 'fb.1.1700000000000.123', fbc: 'fb.1.1700000000000.abc' },
		consentSnapshot: { necessary: true, analytics: true, marketing: true },
		eventType: 'xv',
		eventDate: futureDate(),
		contactName: 'Gloria Garza',
		celebrantNames: 'Andrea',
		phone: '668 111 2233',
		demoSlug: 'demo-xv-celestial-blue',
		sourceArea: 'hero',
		ctaId: 'hero_whatsapp',
		website: '',
		elapsedMs: 15_000,
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertVisitorSession.mockResolvedValue(undefined);
	mockInsertTrackingEvent.mockResolvedValue({ id: EVENT_ID, eventName: 'form_submitted' });
	mockFindLeadByCode.mockResolvedValue(null);
	mockUpsertLead.mockImplementation(async (input) => ({
		id: 'lead-id',
		leadCode: input.leadCode,
		status: 'new',
		sessionId: input.sessionId ?? null,
	}));
	mockCreateCustomer.mockResolvedValue({
		outcome: 'created',
		customer: { id: 'customer-id', displayName: 'Gloria Garza', phoneE164: '+526681112233' },
	});
	mockEnqueue.mockResolvedValue(undefined);
});

describe('submitLeadCapture', () => {
	it('stores session, event, lead and customer, and queues the Meta Lead with the customer', async () => {
		const result = await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'production',
			payload: makePayload(),
		});

		expect(result).toEqual({ accepted: true, leadCode: 'CM-ABC234', tracked: true });
		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: SESSION_ID,
				metaAttribution: expect.objectContaining({ fbp: 'fb.1.1700000000000.123' }),
				clientSignals: expect.objectContaining({ userAgent: BROWSER_USER_AGENT }),
			}),
		);
		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				eventName: 'form_submitted',
				eventProperties: expect.objectContaining({
					form_id: 'aparta_fecha',
					event_type: 'xv',
					demo_slug: 'demo-xv-celestial-blue',
					event_id: EVENT_ID,
				}),
			}),
		);
		// The tracking event never carries personal data.
		const properties = mockInsertTrackingEvent.mock.calls[0][0].eventProperties;
		expect(JSON.stringify(properties)).not.toMatch(/Gloria|Andrea|6681112233/);

		expect(mockUpsertLead).toHaveBeenCalledWith(
			expect.objectContaining({
				leadCode: 'CM-ABC234',
				sessionId: SESSION_ID,
				sourceEventId: EVENT_ID,
				channel: 'contact_form',
				name: 'Gloria Garza',
				phoneE164: '+526681112233',
				eventType: 'xv',
				celebrantNames: 'Andrea',
				demoSlug: 'demo-xv-celestial-blue',
				consentMarketing: true,
			}),
		);
		expect(mockCreateCustomer).toHaveBeenCalledWith({
			displayName: 'Gloria Garza',
			phone: '668 111 2233',
			createdFromLeadId: 'lead-id',
		});
		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({ eventName: 'lead_created' }),
		);
		expect(mockEnqueue).toHaveBeenCalledWith({
			trigger: 'form_submitted',
			eventId: EVENT_ID,
			sessionId: SESSION_ID,
			eventSourcePath: '/',
			customerId: 'customer-id',
			leadId: 'lead-id',
		});
	});

	it('stores lead and customer without tracking or Meta when there is no consent', async () => {
		const result = await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'production',
			payload: makePayload({
				consentSnapshot: { necessary: true, analytics: false, marketing: false },
			}),
		});

		expect(result).toEqual({ accepted: true, leadCode: 'CM-ABC234', tracked: false });
		expect(mockUpsertVisitorSession).not.toHaveBeenCalled();
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
		expect(mockEnqueue).not.toHaveBeenCalled();
		expect(mockUpsertLead).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: undefined,
				metaAttribution: undefined,
				consentMarketing: false,
			}),
		);
		expect(mockCreateCustomer).toHaveBeenCalled();
	});

	it('tracks with analytics consent only but never queues the Meta Lead', async () => {
		await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'production',
			payload: makePayload({
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			}),
		});

		expect(mockInsertTrackingEvent).toHaveBeenCalled();
		expect(mockUpsertLead).toHaveBeenCalledWith(
			expect.objectContaining({ metaAttribution: undefined, consentMarketing: false }),
		);
		expect(mockEnqueue).not.toHaveBeenCalled();
	});

	it('stores the lead but neither tracks nor queues the Meta Lead outside Production', async () => {
		const result = await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'preview',
			payload: makePayload(),
		});

		expect(result).toMatchObject({ accepted: true, tracked: false });
		expect(mockUpsertLead).toHaveBeenCalled();
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
		expect(mockEnqueue).not.toHaveBeenCalled();
	});

	it('moves to a fresh lead code when the proposed one belongs to another session', async () => {
		mockFindLeadByCode.mockImplementation(async (code) =>
			code === 'CM-ABC234'
				? { id: 'other', leadCode: code, status: 'new', sessionId: 'another-session' }
				: null,
		);

		const result = await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'production',
			payload: makePayload(),
		});

		expect(result.leadCode).toMatch(/^CM-[A-Z0-9]{6}$/);
		expect(result.leadCode).not.toBe('CM-ABC234');
		expect(mockUpsertLead).toHaveBeenCalledTimes(1);
		expect(mockUpsertLead.mock.calls[0][0].leadCode).toBe(result.leadCode);
	});

	it('updates the session’s own lead from an earlier WhatsApp click', async () => {
		mockFindLeadByCode.mockResolvedValue({
			id: 'lead-id',
			leadCode: 'CM-ABC234',
			status: 'new',
			sessionId: SESSION_ID,
		});

		await submitLeadCapture({
			request: makeRequest(),
			deployEnvironment: 'production',
			payload: makePayload(),
		});

		expect(mockUpsertLead.mock.calls[0][0].leadCode).toBe('CM-ABC234');
		expect(mockInsertTrackingEvent).not.toHaveBeenCalledWith(
			expect.objectContaining({ eventName: 'lead_created' }),
		);
	});

	it.each([
		['a filled honeypot', { website: 'https://spam.example' }, BROWSER_USER_AGENT, 'honeypot'],
		['a submission faster than a person', { elapsedMs: 500 }, BROWSER_USER_AGENT, 'too_fast'],
		['an automated user agent', {}, 'curl/8.4.0', 'automated_traffic'],
	])('drops %s without writing anything', async (_label, overrides, userAgent, reason) => {
		const result = await submitLeadCapture({
			request: makeRequest(userAgent),
			deployEnvironment: 'production',
			payload: makePayload(overrides),
		});

		expect(result).toEqual({ accepted: false, leadCode: 'CM-ABC234', reason });
		expect(mockUpsertLead).not.toHaveBeenCalled();
		expect(mockCreateCustomer).not.toHaveBeenCalled();
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
	});

	it.each([
		['phone', { phone: '12345' }],
		['eventDate', { eventDate: '2020-01-01' }],
		['eventType', { eventType: 'graduacion' }],
		['contactName', { contactName: 'A' }],
		['demoSlug', { demoSlug: 'demo-desconocido' }],
		['leadCode', { leadCode: 'CM-AB' }],
	])('rejects an invalid %s with the field name', async (field, overrides) => {
		await expect(
			submitLeadCapture({
				request: makeRequest(),
				deployEnvironment: 'production',
				payload: makePayload(overrides),
			}),
		).rejects.toMatchObject({
			status: 400,
			code: 'validation_error',
			details: { fields: [field] },
		});
		expect(mockUpsertLead).not.toHaveBeenCalled();
	});
});
