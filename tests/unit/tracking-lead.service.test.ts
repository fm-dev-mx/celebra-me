jest.mock('@/lib/tracking/lead.repository', () => ({
	upsertLead: jest.fn(),
}));

import { createLeadCode } from '@/lib/tracking/lead-code';
import { createLeadFromContactSubmission } from '@/lib/tracking/lead.service';
import { upsertLead } from '@/lib/tracking/lead.repository';

const mockUpsertLead = upsertLead as jest.MockedFunction<typeof upsertLead>;

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertLead.mockResolvedValue({
		id: 'lead-id',
		leadCode: 'CM-ABC123',
		status: 'new',
	});
});

describe('createLeadCode', () => {
	it('creates a short human-friendly Celebra-me lead code', () => {
		expect(createLeadCode(() => 0)).toBe('CM-222222');
		expect(createLeadCode(() => 0.99999)).toMatch(/^CM-[A-Z0-9]{6}$/);
	});
});

describe('createLeadFromContactSubmission', () => {
	it('creates a deduplicated contact-form lead with campaign fields', async () => {
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
				name: 'Valentina Hernandez',
				email: 'client@example.com',
				phone: '+52 614 123 4567',
				eventType: 'xv',
				packageInterest: 'premium',
				messageSummary: 'Quiero una invitacion para septiembre con musica.',
				utmSource: 'instagram',
				utmMedium: 'paid',
				utmCampaign: 'summer',
			}),
		);
	});
});
