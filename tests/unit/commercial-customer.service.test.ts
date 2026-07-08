jest.mock('@/lib/commercial/customer.repository', () => ({
	linkCommercialLeadToCustomer: jest.fn(),
	upsertCommercialCustomer: jest.fn(),
}));

import {
	linkCommercialLeadToCustomer,
	upsertCommercialCustomer,
} from '@/lib/commercial/customer.repository';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';

const mockLinkLeadToCustomer = linkCommercialLeadToCustomer as jest.MockedFunction<
	typeof linkCommercialLeadToCustomer
>;
const mockUpsertCustomer = upsertCommercialCustomer as jest.MockedFunction<
	typeof upsertCommercialCustomer
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertCustomer.mockResolvedValue({
		id: 'customer-id',
		displayName: 'Valentina Hernandez',
		email: 'client@example.com',
		phoneE164: '+526141234567',
	});
	mockLinkLeadToCustomer.mockResolvedValue(undefined);
});

describe('createCommercialCustomer', () => {
	it('normalizes customer identity and links the selected lead', async () => {
		const customer = await createCommercialCustomer({
			displayName: ' Valentina Hernandez ',
			email: ' Client@Example.COM ',
			phone: '+52 614 123 4567',
			createdFromLeadId: 'lead-id',
		});

		expect(customer.id).toBe('customer-id');
		expect(mockUpsertCustomer).toHaveBeenCalledWith({
			displayName: 'Valentina Hernandez',
			email: 'client@example.com',
			normalizedEmail: 'client@example.com',
			phoneCountryCode: '+52',
			phoneNational: '6141234567',
			phoneE164: '+526141234567',
			createdFromLeadId: 'lead-id',
		});
		expect(mockLinkLeadToCustomer).toHaveBeenCalledWith({
			leadId: 'lead-id',
			customerId: 'customer-id',
		});
	});

	it('rejects customer creation without a display name', async () => {
		await expect(createCommercialCustomer({ displayName: '   ' })).rejects.toThrow(
			'Customer display name is required.',
		);

		expect(mockUpsertCustomer).not.toHaveBeenCalled();
		expect(mockLinkLeadToCustomer).not.toHaveBeenCalled();
	});
});
