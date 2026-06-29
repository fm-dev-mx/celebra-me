jest.mock('@/lib/tracking/lead.repository', () => ({
	upsertLead: jest.fn(),
	findLeadByCode: jest.fn(),
}));

jest.mock('@/lib/tracking/repository', () => ({
	insertTrackingEvent: jest.fn(),
}));

import { createLeadCode } from '@/lib/tracking/lead-code';
import {
	createLeadFromContactSubmission,
	createLeadFromTrackingEvent,
} from '@/lib/tracking/lead.service';
import { upsertLead, findLeadByCode } from '@/lib/tracking/lead.repository';
import { insertTrackingEvent } from '@/lib/tracking/repository';

const mockUpsertLead = upsertLead as jest.MockedFunction<typeof upsertLead>;
const mockFindLeadByCode = findLeadByCode as jest.MockedFunction<typeof findLeadByCode>;
const mockInsertTrackingEvent = insertTrackingEvent as jest.MockedFunction<
	typeof insertTrackingEvent
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertLead.mockResolvedValue({
		id: 'lead-id',
		leadCode: 'CM-ABC123',
		status: 'new',
	});
	mockFindLeadByCode.mockResolvedValue(null);
	mockInsertTrackingEvent.mockResolvedValue({
		id: 'lead-created-event-id',
		eventName: 'lead_created',
	});
});

describe('createLeadCode', () => {
	it('creates a short human-friendly Celebra-me lead code', () => {
		expect(createLeadCode(() => 0)).toBe('CM-222222');
		expect(createLeadCode(() => 0.99999)).toMatch(/^CM-[A-Z0-9]{6}$/);
	});
});

describe('createLeadFromContactSubmission', () => {
	it('creates a deduplicated contact-form lead and fires lead_created for new leads', async () => {
		const result = await createLeadFromContactSubmission({
			name: 'Valentina Hernandez',
			email: 'client@example.com',
			phone: '+52 614 123 4567',
			eventType: 'xv',
			packageInterest: 'premium',
			message: 'Quiero una invitacion para septiembre con musica.',
			consentContact: true,
			consentMarketing: false,
			leadCode: 'CM-ABC123',
			sessionId: '11111111-1111-4111-8111-111111111111',
			visitorId: 'visitor_00000000-0000-4000-8000-000000000000',
			utmSource: 'instagram',
			utmMedium: 'paid',
			utmCampaign: 'summer',
		});

		expect(result).toEqual({
			id: 'lead-id',
			leadCode: 'CM-ABC123',
			status: 'new',
		});
		expect(mockUpsertLead).toHaveBeenCalledWith(
			expect.objectContaining({
				leadCode: 'CM-ABC123',
				channel: 'contact_form',
			}),
		);
		// Verify lead_created event was fired
		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventName: 'lead_created',
				visitorId: 'visitor_00000000-0000-4000-8000-000000000000',
				eventProperties: expect.objectContaining({
					lead_code: 'CM-ABC123',
					lead_channel: 'contact_form',
				}),
			}),
		);
	});
});

describe('createLeadFromTrackingEvent', () => {
	it('creates a whatsapp-channel lead and fires lead_created once for new codes', async () => {
		const result = await createLeadFromTrackingEvent({
			leadCode: 'CM-WHATSAPP',
			sessionId: '22222222-2222-4222-8222-222222222222',
			sourceEventId: '33333333-3333-4333-8333-333333333333',
			channel: 'whatsapp',
			visitorId: 'visitor_44444444-4444-4444-8444-444444444444',
			utmSource: 'facebook',
			utmMedium: 'paid',
			utmCampaign: 'whatsapp_campaign',
		});

		expect(result).toEqual({
			id: 'lead-id',
			leadCode: 'CM-ABC123',
			status: 'new',
		});

		expect(mockUpsertLead).toHaveBeenCalledWith(
			expect.objectContaining({
				leadCode: 'CM-WHATSAPP',
				channel: 'whatsapp',
				status: 'new',
				sessionId: '22222222-2222-4222-8222-222222222222',
			}),
		);

		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventName: 'lead_created',
				visitorId: 'visitor_44444444-4444-4444-8444-444444444444',
				sessionId: '22222222-2222-4222-8222-222222222222',
				eventProperties: expect.objectContaining({
					lead_code: 'CM-ABC123',
					lead_channel: 'whatsapp',
				}),
			}),
		);
	});

	it('does not create a lead or emit lead_created for duplicate lead_code', async () => {
		// Simulate an existing lead for this code
		mockFindLeadByCode.mockResolvedValue({
			id: 'existing-lead-id',
			leadCode: 'CM-DUPLICATE',
			status: 'new',
		});

		const result = await createLeadFromTrackingEvent({
			leadCode: 'CM-DUPLICATE',
			sessionId: '88888888-8888-4888-8888-888888888888',
			sourceEventId: '99999999-9999-4999-8999-999999999999',
			channel: 'whatsapp',
			visitorId: 'visitor_duplicate_user',
		});

		// Must return the existing lead, not a new one
		expect(result).toEqual({
			id: 'existing-lead-id',
			leadCode: 'CM-DUPLICATE',
			status: 'new',
		});

		// Must NOT call upsert (already exists)
		expect(mockUpsertLead).not.toHaveBeenCalled();

		// Must NOT emit lead_created event
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
	});

	it('uses the new lead status for early-intent leads', async () => {
		mockUpsertLead.mockResolvedValue({
			id: 'lead-id-2',
			leadCode: 'CM-EARLYINTENT',
			status: 'new',
		});

		const result = await createLeadFromTrackingEvent({
			leadCode: 'CM-EARLYINTENT',
			sessionId: '55555555-5555-4555-8555-555555555555',
			sourceEventId: '66666666-6666-4666-8666-666666666666',
			channel: 'whatsapp',
			visitorId: 'visitor_77777777-7777-4777-8777-777777777777',
		});

		expect(result.status).toBe('new');
		expect(mockUpsertLead).toHaveBeenCalledWith(expect.objectContaining({ status: 'new' }));
	});
});
