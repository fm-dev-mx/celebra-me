import {
	findCommercialLeadByCode,
	findCommercialLeadsByEmail,
	findCommercialLeadsByPhone,
	findRecentCommercialLeads,
	type CommercialLeadCandidate,
} from '@/lib/commercial/customer.repository';
import {
	normalizeCommercialEmail,
	normalizeCommercialPhone,
	type NormalizedCommercialPhone,
} from '@/lib/commercial/phone';

export interface CommercialIdentitySearchInput {
	leadCode?: string;
	phone?: string;
	email?: string;
	name?: string;
	eventType?: string;
	packageInterest?: string;
}

export interface CommercialIdentityCandidates {
	normalizedPhone?: NormalizedCommercialPhone;
	normalizedEmail?: string;
	byLeadCode?: CommercialLeadCandidate | null;
	byPhone: CommercialLeadCandidate[];
	byEmail: CommercialLeadCandidate[];
	recentContext: CommercialLeadCandidate[];
}

function blankToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export async function findCommercialIdentityCandidates(
	input: CommercialIdentitySearchInput,
): Promise<CommercialIdentityCandidates> {
	const leadCode = blankToUndefined(input.leadCode);
	const normalizedPhone = normalizeCommercialPhone(input.phone);
	const normalizedEmail = normalizeCommercialEmail(input.email);
	const eventType = blankToUndefined(input.eventType);
	const packageInterest = blankToUndefined(input.packageInterest);

	const [byLeadCode, byPhone, byEmail, recentContext] = await Promise.all([
		leadCode ? findCommercialLeadByCode(leadCode) : Promise.resolve(null),
		normalizedPhone ? findCommercialLeadsByPhone(normalizedPhone.e164) : Promise.resolve([]),
		normalizedEmail ? findCommercialLeadsByEmail(normalizedEmail) : Promise.resolve([]),
		eventType || packageInterest
			? findRecentCommercialLeads({ eventType, packageInterest, limit: 8 })
			: Promise.resolve([]),
	]);

	return {
		normalizedPhone,
		normalizedEmail,
		byLeadCode,
		byPhone,
		byEmail,
		recentContext,
	};
}
