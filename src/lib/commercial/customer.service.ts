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

export type CommercialCustomerReconciliationResult =
	| { outcome: 'created' | 'matched'; customer: CommercialCustomer }
	| { outcome: 'conflict'; matches: CommercialCustomer[] };

function hasIdentityConflict(
	byEmail: CommercialCustomer | null,
	byPhone: CommercialCustomer | null,
): byEmail is CommercialCustomer {
	return Boolean(byEmail && byPhone && byEmail.id !== byPhone.id);
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
): Promise<CommercialCustomerReconciliationResult> {
	const displayName = emptyToUndefined(input.displayName);
	if (!displayName) {
		throw new Error('Customer display name is required.');
	}

	const normalizedEmail = normalizeCommercialEmail(input.email);
	const normalizedPhone = normalizeCommercialPhone(input.phone);
	const createdFromLeadId = emptyToUndefined(input.createdFromLeadId);

	// --- Search for an existing customer before inserting ---
	const [existingByEmail, existingByPhone] = await Promise.all([
		normalizedEmail ? findCommercialCustomerByEmail(normalizedEmail) : Promise.resolve(null),
		normalizedPhone
			? findCommercialCustomerByPhone(normalizedPhone.e164)
			: Promise.resolve(null),
	]);
	if (hasIdentityConflict(existingByEmail, existingByPhone)) {
		return { outcome: 'conflict', matches: [existingByEmail, existingByPhone!] };
	}

	const existing = existingByEmail ?? existingByPhone;

	if (existing) {
		// Link the lead to the existing customer if requested.
		if (createdFromLeadId) {
			await linkCommercialLeadToCustomer({
				leadId: createdFromLeadId,
				customerId: existing.id,
			});
		}
		return { outcome: 'matched', customer: existing };
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

		return { outcome: 'created', customer };
	} catch (error) {
		// Handle unique-constraint race: another process inserted the same
		// normalized email / phone between our check and our insert.  Fall
		// back to a final lookup.
		const racedByEmail = normalizedEmail
			? await findCommercialCustomerByEmail(normalizedEmail)
			: null;

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
			return { outcome: 'matched', customer: raced };
		}

		// Not a race condition — rethrow the original error.
		throw error;
	}
}
