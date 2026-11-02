import {
	emptyToUndefined,
	findCommercialCustomerByEmail,
	findCommercialCustomerByPhone,
	linkCommercialLeadToCustomer,
	updateCommercialCustomerAttributes,
	upsertCommercialCustomer,
	type CommercialCustomer,
} from '@/lib/commercial/customer.repository';
import { normalizeCommercialEmail, normalizeCommercialPhone } from '@/lib/commercial/phone';

export interface CreateCommercialCustomerInput {
	displayName: string;
	email?: string;
	phone?: string;
	createdFromLeadId?: string;
	city?: string;
	country?: string;
	isPastClient?: boolean;
	referralCode?: string;
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

async function linkLeadIfRequested(
	createdFromLeadId: string | undefined,
	customerId: string,
): Promise<void> {
	if (createdFromLeadId)
		await linkCommercialLeadToCustomer({ leadId: createdFromLeadId, customerId });
}

/** Fills a missing city, a changed country and the past-client flag on a matched customer. */
async function refreshMatchedCustomer(
	existing: CommercialCustomer,
	city: string | undefined,
	country: string | undefined,
	isPastClient: boolean | undefined,
): Promise<CommercialCustomer> {
	const update = {
		city: city && !existing.city ? city : undefined,
		country: country && existing.country !== country ? country : undefined,
		isPastClient: isPastClient === true && !existing.isPastClient ? true : undefined,
	};
	if (!update.city && !update.country && !update.isPastClient) return existing;
	return (
		(await updateCommercialCustomerAttributes({ customerId: existing.id, ...update })) ??
		existing
	);
}

async function findRacedCustomer(
	normalizedEmail: string | undefined,
	normalizedPhoneE164: string | undefined,
): Promise<CommercialCustomer | null> {
	const racedByEmail = normalizedEmail
		? await findCommercialCustomerByEmail(normalizedEmail)
		: null;
	if (racedByEmail || !normalizedPhoneE164) return racedByEmail;
	return findCommercialCustomerByPhone(normalizedPhoneE164);
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
	const city = emptyToUndefined(input.city);
	const country = emptyToUndefined(input.country)?.toUpperCase();

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
		const customer = await refreshMatchedCustomer(existing, city, country, input.isPastClient);
		await linkLeadIfRequested(createdFromLeadId, customer.id);
		return { outcome: 'matched', customer };
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
			city,
			country,
			isPastClient: input.isPastClient,
			referralCode: input.referralCode,
		});
		await linkLeadIfRequested(createdFromLeadId, customer.id);
		return { outcome: 'created', customer };
	} catch (error) {
		// Handle unique-constraint race: another process inserted the same
		// normalized email / phone between our check and our insert.  Fall
		// back to a final lookup.
		const raced = await findRacedCustomer(normalizedEmail, normalizedPhone?.e164);
		if (raced) {
			await linkLeadIfRequested(createdFromLeadId, raced.id);
			return { outcome: 'matched', customer: raced };
		}

		// Not a race condition — rethrow the original error.
		throw error;
	}
}
