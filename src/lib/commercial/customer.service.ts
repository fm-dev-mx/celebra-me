import {
	linkCommercialLeadToCustomer,
	upsertCommercialCustomer,
	type CommercialCustomer,
} from '@/lib/commercial/customer.repository';
import { normalizeCommercialEmail, normalizeCommercialPhone } from '@/lib/commercial/phone';

export interface CreateCommercialCustomerInput {
	displayName: string;
	email?: string;
	phone?: string;
	createdFromLeadId?: string;
}

function blankToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export async function createCommercialCustomer(
	input: CreateCommercialCustomerInput,
): Promise<CommercialCustomer> {
	const displayName = blankToUndefined(input.displayName);
	if (!displayName) {
		throw new Error('Customer display name is required.');
	}

	const normalizedEmail = normalizeCommercialEmail(input.email);
	const normalizedPhone = normalizeCommercialPhone(input.phone);
	const createdFromLeadId = blankToUndefined(input.createdFromLeadId);

	const customer = await upsertCommercialCustomer({
		displayName,
		email: normalizedEmail,
		normalizedEmail,
		phoneCountryCode: normalizedPhone?.countryCode,
		phoneNational: normalizedPhone?.national,
		phoneE164: normalizedPhone?.e164,
		createdFromLeadId,
	});

	if (createdFromLeadId) {
		await linkCommercialLeadToCustomer({
			leadId: createdFromLeadId,
			customerId: customer.id,
		});
	}

	return customer;
}
