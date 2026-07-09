jest.mock('@/lib/commercial/customer.repository', () => ({
	emptyToUndefined: jest.fn((value: string | undefined) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : undefined;
	}),
	findCommercialCustomerByEmail: jest.fn(),
	findCommercialCustomerByPhone: jest.fn(),
	linkCommercialLeadToCustomer: jest.fn(),
	upsertCommercialCustomer: jest.fn(),
}));

import {
	findCommercialCustomerByEmail,
	findCommercialCustomerByPhone,
	linkCommercialLeadToCustomer,
	upsertCommercialCustomer,
} from '@/lib/commercial/customer.repository';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';

const mockFindByEmail = findCommercialCustomerByEmail as jest.MockedFunction<
	typeof findCommercialCustomerByEmail
>;
const mockFindByPhone = findCommercialCustomerByPhone as jest.MockedFunction<
	typeof findCommercialCustomerByPhone
>;
const mockLinkLeadToCustomer = linkCommercialLeadToCustomer as jest.MockedFunction<
	typeof linkCommercialLeadToCustomer
>;
const mockUpsertCustomer = upsertCommercialCustomer as jest.MockedFunction<
	typeof upsertCommercialCustomer
>;

const existingCustomer = {
	id: 'existing-customer-id',
	displayName: 'Valentina Hernandez',
	email: 'client@example.com',
	phoneE164: '+526141234567',
};

const newCustomer = {
	id: 'customer-id',
	displayName: 'Valentina Hernandez',
	email: 'client@example.com',
	phoneE164: '+526****4567',
};

beforeEach(() => {
	jest.clearAllMocks();
	mockFindByEmail.mockResolvedValue(null);
	mockFindByPhone.mockResolvedValue(null);
	mockUpsertCustomer.mockResolvedValue(newCustomer);
	mockLinkLeadToCustomer.mockResolvedValue(undefined);
});

describe('createCommercialCustomer', () => {
	it('returns existing customer when normalized email already exists', async () => {
		mockFindByEmail.mockResolvedValue(existingCustomer);

		const customer = await createCommercialCustomer({
			displayName: 'Valentina Hernandez',
			email: 'Client@Example.COM',
			phone: '+52 614 123 4567',
			createdFromLeadId: 'lead-id',
		});

		expect(customer.id).toBe('existing-customer-id');
		expect(customer.displayName).toBe('Valentina Hernandez');
		// Should not have attempted an insert.
		expect(mockUpsertCustomer).not.toHaveBeenCalled();
		// Should still link the lead even when returning existing customer.
		expect(mockLinkLeadToCustomer).toHaveBeenCalledWith({
			leadId: 'lead-id',
			customerId: 'existing-customer-id',
		});
	});

	it('returns existing customer when normalized phone exists and email has no match', async () => {
		mockFindByEmail.mockResolvedValue(null);
		mockFindByPhone.mockResolvedValue(existingCustomer);

		const customer = await createCommercialCustomer({
			displayName: 'Nuevo Nombre', // Different name
			email: 'other@example.com',
			phone: '+52 614 123 4567',
			createdFromLeadId: 'lead-id',
		});

		expect(customer.id).toBe('existing-customer-id');
		expect(mockUpsertCustomer).not.toHaveBeenCalled();
		expect(mockLinkLeadToCustomer).toHaveBeenCalledWith({
			leadId: 'lead-id',
			customerId: 'existing-customer-id',
		});
	});

	it('creates a new customer when no existing match is found', async () => {
		const customer = await createCommercialCustomer({
			displayName: ' Valentina Hernandez ',
			email: ' Client@Example.COM ',
			phone: '+52 614 123 4567',
			createdFromLeadId: 'lead-id',
		});

		expect(customer.id).toBe('customer-id');
		expect(mockFindByEmail).toHaveBeenCalledWith('client@example.com');
		expect(mockFindByPhone).toHaveBeenCalledWith('+526141234567');
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

	it('recovers from a unique-constraint race by looking up the existing customer', async () => {
		// Insert fails with a generic error (simulating a constraint violation).
		mockUpsertCustomer.mockRejectedValueOnce(
			new Error('duplicate key value violates unique constraint "idx_customers_normalized_email_unique"'),
		);
		// Second lookup (race recovery) finds the record.
		mockFindByEmail.mockResolvedValueOnce(null); // First call (before insert)
		mockFindByEmail.mockResolvedValueOnce(existingCustomer); // Second call (after insert failure)

		const customer = await createCommercialCustomer({
			displayName: 'Valentina Hernandez',
			email: 'client@example.com',
			createdFromLeadId: 'lead-id',
		});

		expect(customer.id).toBe('existing-customer-id');
		expect(mockLinkLeadToCustomer).toHaveBeenCalledWith({
			leadId: 'lead-id',
			customerId: 'existing-customer-id',
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
