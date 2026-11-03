import { createLeadCode } from '@/lib/tracking/lead-code';
import {
	metaAttributionOrUndefined,
	sanitizeMetaAttribution,
	type MetaAttribution,
} from '@/lib/tracking/meta-attribution';
import {
	upsertLead,
	findLeadByCode,
	resolveLeadReferralAttribution,
	type StoredLead,
	type LeadChannel,
} from '@/lib/tracking/lead.repository';
import { findVisitorSessionMetaAttribution, insertTrackingEvent } from '@/lib/tracking/repository';

function blankToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

async function resolveLeadMetaAttribution(params: {
	sessionId?: string;
	metaAttribution?: MetaAttribution;
}): Promise<MetaAttribution | undefined> {
	const explicitMeta = metaAttributionOrUndefined(
		sanitizeMetaAttribution(params.metaAttribution),
	);
	if (explicitMeta) return explicitMeta;

	const sessionId = blankToUndefined(params.sessionId);
	if (!sessionId) return undefined;

	try {
		return metaAttributionOrUndefined(
			sanitizeMetaAttribution(await findVisitorSessionMetaAttribution(sessionId)),
		);
	} catch {
		return undefined;
	}
}

export async function createLeadFromTrackingEvent(params: {
	leadCode: string;
	sessionId: string;
	sourceEventId: string;
	channel: LeadChannel;
	visitorId: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	utmContent?: string;
	ttclid?: string;
	referralCode?: string;
	metaAttribution?: MetaAttribution;
}): Promise<StoredLead> {
	const {
		leadCode,
		sessionId,
		sourceEventId,
		channel,
		visitorId,
		utmSource,
		utmMedium,
		utmCampaign,
		utmContent,
		ttclid,
		referralCode,
		metaAttribution,
	} = params;

	// Check whether a lead already exists for this lead_code.
	// On lookup failure, still create the lead but skip lead_created
	// to avoid counting an uncertain conversion.
	let existing: StoredLead | null | undefined;
	try {
		existing = await findLeadByCode(leadCode);
	} catch {
		existing = undefined; // lookup failed → skip lead_created
	}
	if (existing && existing.sessionId === sessionId) {
		return existing; // Same-session continuation; do not duplicate or rewrite it.
	}

	if (existing) {
		// A lead code is a session-bound continuation token. Never use a code
		// from another session as an update or disclosure key.
		const replacementLeadCode = createLeadCode();
		const referralAttribution = await resolveLeadReferralAttribution({
			referralCode,
			existingLead: null,
		});
		const replacementLead = await upsertLead({
			leadCode: replacementLeadCode,
			sessionId,
			sourceEventId,
			channel,
			status: 'new',
			consentContact: true,
			consentMarketing: false,
			utmSource: blankToUndefined(utmSource),
			utmMedium: blankToUndefined(utmMedium),
			utmCampaign: blankToUndefined(utmCampaign),
			utmContent: blankToUndefined(utmContent),
			ttclid,
			route: 'landing',
			metaAttribution: await resolveLeadMetaAttribution({ sessionId, metaAttribution }),
			referredByCustomerId: referralAttribution?.referredByCustomerId,
			referralCodeUsed: referralAttribution?.referralCodeUsed,
			referrerExternalId: referralAttribution?.referrerExternalId,
		});
		try {
			await insertTrackingEvent({
				sessionId,
				visitorId,
				eventName: 'lead_created',
				routePath: '/api/tracking/events',
				routeClass: 'commercial',
				eventProperties: {
					lead_code: replacementLead.leadCode,
					lead_channel: channel,
				},
				consentSnapshot: { necessary: true, analytics: false, marketing: false },
				isInternal: false,
			});
		} catch {
			// Non-critical: lead is already persisted.
		}
		return replacementLead;
	}

	const referralAttribution = await resolveLeadReferralAttribution({
		referralCode,
		existingLead: null,
	});
	const lead = await upsertLead({
		leadCode,
		sessionId,
		sourceEventId,
		channel,
		status: 'new',
		consentContact: true,
		consentMarketing: false,
		utmSource: blankToUndefined(utmSource),
		utmMedium: blankToUndefined(utmMedium),
		utmCampaign: blankToUndefined(utmCampaign),
		utmContent: blankToUndefined(utmContent),
		ttclid,
		route: 'landing',
		metaAttribution: await resolveLeadMetaAttribution({ sessionId, metaAttribution }),
		referredByCustomerId: referralAttribution?.referredByCustomerId,
		referralCodeUsed: referralAttribution?.referralCodeUsed,
		referrerExternalId: referralAttribution?.referrerExternalId,
	});

	// Fire lead_created event — only for confirmed-new leads (existing === null).
	if (existing === null) {
		try {
			await insertTrackingEvent({
				sessionId,
				visitorId,
				eventName: 'lead_created',
				routePath: '/api/tracking/events',
				routeClass: 'commercial',
				eventProperties: {
					lead_code: lead.leadCode,
					lead_channel: channel,
				},
				consentSnapshot: { necessary: true, analytics: false, marketing: false },
				isInternal: false,
			});
		} catch {
			// Non-critical: lead is already persisted.
		}
	}

	return lead;
}
