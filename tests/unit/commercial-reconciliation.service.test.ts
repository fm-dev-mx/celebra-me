jest.mock('@/lib/commercial/customer.repository', () => ({
	findCommercialLeadByCode: jest.fn(),
	findCommercialLeadsByPhone: jest.fn(),
	findCommercialLeadsByEmail: jest.fn(),
	findRecentCommercialLeads: jest.fn(),
}));

import {
	findCommercialLeadByCode,
	findCommercialLeadsByEmail,
	findCommercialLeadsByPhone,
	findRecentCommercialLeads,
} from '@/lib/commercial/customer.repository';
import { findCommercialIdentityCandidates } from '@/lib/commercial/reconciliation.service';

const mockFindByCode = findCommercialLeadByCode as jest.MockedFunction<
	typeof findCommercialLeadByCode
>;
const mockFindByPhone = findCommercialLeadsByPhone as jest.MockedFunction<
	typeof findCommercialLeadsByPhone
>;
const mockFindByEmail = findCommercialLeadsByEmail as jest.MockedFunction<
	typeof findCommercialLeadsByEmail
>;
const mockFindRecent = findRecentCommercialLeads as jest.MockedFunction<
	typeof findRecentCommercialLeads
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockFindByCode.mockResolvedValue(null);
	mockFindByPhone.mockResolvedValue([]);
	mockFindByEmail.mockResolvedValue([]);
	mockFindRecent.mockResolvedValue([]);
});

describe('findCommercialIdentityCandidates', () => {
	it('searches by exact lead code before phone, email, and recent context', async () => {
		mockFindByCode.mockResolvedValue({
			id: 'lead-code-id',
			leadCode: 'CM-ABC123',
			channel: 'whatsapp',
			status: 'new',
		});
		mockFindByPhone.mockResolvedValue([
			{ id: 'lead-phone-id', leadCode: 'CM-PHONE1', channel: 'whatsapp', status: 'new' },
		]);
		mockFindByEmail.mockResolvedValue([
			{ id: 'lead-email-id', leadCode: 'CM-EMAIL1', channel: 'contact_form', status: 'new' },
		]);
		mockFindRecent.mockResolvedValue([
			{ id: 'lead-recent-id', leadCode: 'CM-RECENT', channel: 'manual', status: 'contacted' },
		]);

		const result = await findCommercialIdentityCandidates({
			leadCode: ' CM-ABC123 ',
			phone: '+52 614 123 4567',
			email: ' Client@Example.COM ',
			eventType: 'xv',
			packageInterest: 'premium',
		});

		expect(result.normalizedPhone?.e164).toBe('+526141234567');
		expect(result.byLeadCode?.leadCode).toBe('CM-ABC123');
		expect(result.byPhone).toHaveLength(1);
		expect(result.byEmail).toHaveLength(1);
		expect(result.recentContext).toHaveLength(1);
		expect(mockFindByCode).toHaveBeenCalledWith('CM-ABC123');
		expect(mockFindByPhone).toHaveBeenCalledWith('+526141234567');
		expect(mockFindByEmail).toHaveBeenCalledWith('client@example.com');
		expect(mockFindRecent).toHaveBeenCalledWith({
			eventType: 'xv',
			packageInterest: 'premium',
			limit: 8,
		});
	});

	it('does not search by name as a primary identifier', async () => {
		await findCommercialIdentityCandidates({ name: 'Valentina Hernandez' });

		expect(mockFindByCode).not.toHaveBeenCalled();
		expect(mockFindByPhone).not.toHaveBeenCalled();
		expect(mockFindByEmail).not.toHaveBeenCalled();
		expect(mockFindRecent).not.toHaveBeenCalled();
	});
});
