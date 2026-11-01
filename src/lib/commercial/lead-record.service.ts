import {
	buildLeadStageUpdate,
	parseLeadRecordQuery,
	type ChatLeadInput,
	type LeadAdCodeInput,
	type LeadAdPlatform,
	type LeadLostReason,
	type LeadRoute,
	type LeadStage,
	type LeadStageUpdateInput,
} from '@/lib/commercial/lead-record';
import { enqueueMetaCrmLeadSalesStageEvents } from '@/lib/commercial/meta-capi/lead-stage-events';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';
import { ApiError } from '@/lib/rsvp/core/errors';
import { safeErr } from '@/lib/server/safe-error';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { createLeadCode } from '@/lib/tracking/lead-code';
import { findLeadByCode, upsertLead } from '@/lib/tracking/lead.repository';

/** Attempts to find a free lead code for a chat lead. */
const LEAD_CODE_ATTEMPTS = 3;
const SEARCH_LIMIT = 20;

const LEAD_RECORD_COLUMNS = [
	'id',
	'lead_code',
	'created_at',
	'channel',
	'route',
	'name',
	'phone',
	'phone_e164',
	'event_type',
	'event_date',
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'ad_code',
	'fbc',
	'fbp',
	'fbclid',
	'ttclid',
	'ctwa_clid',
	'stage',
	'lost_reason',
	'package_value',
	'stage_changed_at',
	'qualified_at',
	'order_confirmed_at',
	'order_cancelled_at',
	'paid_delivered_at',
	'lost_at',
].join(',');

const AD_CODE_COLUMNS = 'code,label,platform,campaign,ad_name,active,created_at,updated_at';

interface LeadRecordRow {
	id: string;
	lead_code: string;
	created_at: string;
	channel: string;
	route: LeadRoute | null;
	name: string | null;
	phone: string | null;
	phone_e164: string | null;
	event_type: string | null;
	event_date: string | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	utm_content: string | null;
	ad_code: string | null;
	fbc: string | null;
	fbp: string | null;
	fbclid: string | null;
	ttclid: string | null;
	ctwa_clid: string | null;
	stage: LeadStage;
	lost_reason: LeadLostReason | null;
	package_value: number | string | null;
	stage_changed_at: string | null;
	qualified_at: string | null;
	order_confirmed_at: string | null;
	order_cancelled_at: string | null;
	paid_delivered_at: string | null;
	lost_at: string | null;
}

export interface LeadRecord {
	id: string;
	leadCode: string;
	createdAt: string;
	channel: string;
	route: LeadRoute | null;
	name: string | null;
	phone: string | null;
	eventType: string | null;
	eventDate: string | null;
	campaign: string | null;
	ad: string | null;
	adCode: string | null;
	source: string | null;
	medium: string | null;
	fbc: string | null;
	fbp: string | null;
	fbclid: string | null;
	ttclid: string | null;
	ctwaClid: string | null;
	stage: LeadStage;
	lostReason: LeadLostReason | null;
	packageValue: number | null;
	stageChangedAt: string | null;
	stageDates: Partial<Record<Exclude<LeadStage, 'new'>, string>>;
}

interface LeadAdCodeRow {
	code: string;
	label: string;
	platform: LeadAdPlatform;
	campaign: string | null;
	ad_name: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
}

export interface LeadAdCode {
	code: string;
	label: string;
	platform: LeadAdPlatform;
	campaign: string | null;
	adName: string | null;
	active: boolean;
}

function toLeadRecord(row: LeadRecordRow): LeadRecord {
	const stageDates: LeadRecord['stageDates'] = {};
	if (row.qualified_at) stageDates.qualified = row.qualified_at;
	if (row.order_confirmed_at) stageDates.order_confirmed = row.order_confirmed_at;
	if (row.order_cancelled_at) stageDates.order_cancelled = row.order_cancelled_at;
	if (row.paid_delivered_at) stageDates.paid_delivered = row.paid_delivered_at;
	if (row.lost_at) stageDates.lost = row.lost_at;
	return {
		id: row.id,
		leadCode: row.lead_code,
		createdAt: row.created_at,
		channel: row.channel,
		route: row.route,
		name: row.name,
		phone: row.phone_e164 ?? row.phone,
		eventType: row.event_type,
		eventDate: row.event_date,
		campaign: row.utm_campaign,
		ad: row.utm_content,
		adCode: row.ad_code,
		source: row.utm_source,
		medium: row.utm_medium,
		fbc: row.fbc,
		fbp: row.fbp,
		fbclid: row.fbclid,
		ttclid: row.ttclid,
		ctwaClid: row.ctwa_clid,
		stage: row.stage,
		lostReason: row.lost_reason,
		packageValue: row.package_value === null ? null : Number(row.package_value),
		stageChangedAt: row.stage_changed_at,
		stageDates,
	};
}

function toLeadAdCode(row: LeadAdCodeRow): LeadAdCode {
	return {
		code: row.code,
		label: row.label,
		platform: row.platform,
		campaign: row.campaign,
		adName: row.ad_name,
		active: row.active,
	};
}

async function fetchLeadRecords(filter: string): Promise<LeadRecord[]> {
	const rows = await supabaseRestRequest<LeadRecordRow[]>({
		pathWithQuery: `leads?${filter}&select=${LEAD_RECORD_COLUMNS}&order=created_at.desc&limit=${SEARCH_LIMIT}`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toLeadRecord);
}

/** Lead records matching a CM- code, a phone number or a name; the latest ones when empty. */
export async function searchLeadRecords(raw: string): Promise<LeadRecord[]> {
	if (!raw.trim()) return fetchLeadRecords('stage=neq.lost');
	const query = parseLeadRecordQuery(raw);
	if (!query) {
		throw new ApiError(400, 'bad_request', 'Escriba un código CM-, un teléfono o un nombre.');
	}
	switch (query.kind) {
		case 'code':
			return fetchLeadRecords(`lead_code=eq.${encodeURIComponent(query.leadCode)}`);
		case 'phone':
			return fetchLeadRecords(`phone_e164=like.${encodeURIComponent(`*${query.digits}`)}`);
		case 'name':
			return fetchLeadRecords(`name=ilike.${encodeURIComponent(`*${query.text}*`)}`);
	}
}

/** Moves a lead to a stage, stamping the time it entered it; also keeps the package value. */
export async function updateLeadStage(input: LeadStageUpdateInput): Promise<LeadRecord> {
	const id = encodeURIComponent(input.leadId);
	const current = await supabaseRestRequest<Array<{ stage: LeadStage }>>({
		pathWithQuery: `leads?id=eq.${id}&select=stage&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	if (current.length === 0) {
		throw new ApiError(404, 'not_found', 'No se encontró la ficha.');
	}
	const rows = await supabaseRestRequest<LeadRecordRow[]>({
		pathWithQuery: `leads?id=eq.${id}&select=${LEAD_RECORD_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: buildLeadStageUpdate(current[0].stage, input),
	});
	if (rows.length === 0) {
		throw new ApiError(404, 'not_found', 'No se encontró la ficha.');
	}
	const record = toLeadRecord(rows[0]);
	// The stage change already landed; a Meta outbox failure must not undo it for the owner.
	try {
		await enqueueMetaCrmLeadSalesStageEvents(record);
	} catch (error) {
		console.error('[lead-record] Could not queue the Meta stage event:', safeErr(error));
	}
	return record;
}

async function findActiveAdCode(code: string): Promise<LeadAdCodeRow | null> {
	const rows = await supabaseRestRequest<LeadAdCodeRow[]>({
		pathWithQuery: `lead_ad_codes?code=eq.${encodeURIComponent(code)}&active=is.true&select=${AD_CODE_COLUMNS}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

async function allocateLeadCode(): Promise<string> {
	for (let attempt = 0; attempt < LEAD_CODE_ATTEMPTS; attempt += 1) {
		const leadCode = createLeadCode();
		if (!(await findLeadByCode(leadCode))) return leadCode;
	}
	throw new Error('Could not allocate a free lead code.');
}

/**
 * Chat route: the owner captures a WhatsApp chat that opened with a per-ad code. The ad's
 * platform, campaign and name become the lead's UTM source, campaign and content.
 */
export async function createChatLead(input: ChatLeadInput): Promise<LeadRecord> {
	const adCode = await findActiveAdCode(input.adCode);
	if (!adCode) {
		throw new ApiError(400, 'bad_request', `El código ${input.adCode} no está en el catálogo.`);
	}
	const phone = normalizeCommercialPhone(input.phone);
	const leadCode = await allocateLeadCode();
	const lead = await upsertLead({
		leadCode,
		channel: 'whatsapp',
		route: 'chat',
		adCode: adCode.code,
		name: input.name,
		phone: input.phone,
		phoneCountryCode: phone?.countryCode,
		phoneNational: phone?.national,
		phoneE164: phone?.e164,
		eventType: input.eventType,
		eventDate: input.eventDate,
		utmSource: adCode.platform,
		utmCampaign: adCode.campaign ?? undefined,
		utmContent: adCode.ad_name ?? undefined,
		consentContact: true,
		consentMarketing: false,
	});
	const [record] = await fetchLeadRecords(`id=eq.${encodeURIComponent(lead.id)}`);
	if (!record) throw new Error('The chat lead was not stored.');
	return record;
}

export async function listAdCodes(): Promise<LeadAdCode[]> {
	const rows = await supabaseRestRequest<LeadAdCodeRow[]>({
		pathWithQuery: `lead_ad_codes?select=${AD_CODE_COLUMNS}&order=active.desc,code.asc`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toLeadAdCode);
}

/** Creates or edits a per-ad code; the code itself is the key. */
export async function upsertAdCode(input: LeadAdCodeInput): Promise<LeadAdCode> {
	const rows = await supabaseRestRequest<LeadAdCodeRow[]>({
		pathWithQuery: `lead_ad_codes?on_conflict=code&select=${AD_CODE_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			code: input.code,
			label: input.label,
			platform: input.platform,
			campaign: input.campaign ?? null,
			ad_name: input.adName ?? null,
			active: input.active,
			updated_at: new Date().toISOString(),
		},
	});
	if (rows.length === 0) throw new Error('The ad code was not stored.');
	return toLeadAdCode(rows[0]);
}
