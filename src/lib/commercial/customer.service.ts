import {
	emptyToUndefined,
	findCommercialCustomerByEmail,
	findCommercialCustomerByPhone,
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

/**
 * Creates a commercial customer AFTER checking whether one already exists
 * by normalized email or normalized phone. If an existing match is found the
 * existing customer is returned instead of inserting a duplicate.
 *
 * If a createdFromLeadId is provided the lead is linked to the (new or
 * existing) customer.
 *
 * Matching hierarchy (kept consistent with reconciliation):
 *   1. normalized email
 *   2. normalized phone
 */
export async function createCommercialCustomer(
	input: CreateCommercialCustomerInput,
): Promise<CommercialCustomer> {
	const displayName = emptyToUndefined(input.displayName);
	if (!displayName) {
		throw new Error('Customer display name is required.');
	}

	const normalizedEmail = normalizeCommercialEmail(input.email);
	const normalizedPhone = normalizeCommercialPhone(input.phone);
	const createdFromLeadId = emptyToUndefined(input.createdFromLeadId);

	// --- Search for an existing customer before inserting ---
	const existingByEmail =
		normalizedEmail ? await findCommercialCustomerByEmail(normalizedEmail) : null;

	const existingByPhone =
		!existingByEmail && normalizedPhone
			? await findCommercialCustomerByPhone(normalizedPhone.e164)
			: null;

	const existing = existingByEmail ?? existingByPhone;

	if (existing) {
		// Link the lead to the existing customer if requested.
		if (createdFromLeadId) {
			await linkCommercialLeadToCustomer({
				leadId: createdFromLeadId,
				customerId: existing.id,
			});
		}
		return existing;
	}

	// --- No existing customer found — insert a new one. ---
	try {
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
	} catch (error) {
		// Handle unique-constraint race: another process inserted the same
		// normalized email / phone between our check and our insert.  Fall
		// back to a final lookup.
		const racedByEmail =
			normalizedEmail ? await findCommercialCustomerByEmail(normalizedEmail) : null;

		const racedByPhone =
			!racedByEmail && normalizedPhone
				? await findCommercialCustomerByPhone(normalizedPhone.e164)
				: null;

		const raced = racedByEmail ?? racedByPhone;

		if (raced) {
			if (createdFromLeadId) {
				await linkCommercialLeadToCustomer({
					leadId: createdFromLeadId,
					customerId: raced.id,
				});
			}
			return raced;
		}

		// Not a race condition — rethrow the original error.
		throw error;
	}
}
