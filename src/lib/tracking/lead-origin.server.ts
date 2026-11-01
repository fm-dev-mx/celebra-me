import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadDemoInventory } from '@/lib/commercial/demo-inventory.server';
import { loadCommercialRows } from './commercial-pagination.server';
import {
	LEAD_ORIGIN_EVENT_NAMES,
	buildLeadOrigin,
	leadOriginWindowStart,
	normalizeLeadCode,
	type LeadOrigin,
	type LeadOriginEventRow,
	type LeadOriginFollowupRow,
	type LeadOriginLeadRow,
	type LeadOriginSessionRow,
} from './lead-origin';

export type LeadOriginResult =
	| { status: 'invalid'; query: string }
	| { status: 'not_found'; leadCode: string }
	| { status: 'found'; origin: LeadOrigin };

const SESSION_COLUMNS =
	'id,visitor_id,started_at,landing_path,referrer,utm_source,utm_medium,utm_campaign,fbclid,fbc,device_type,is_internal';
const EVENT_COLUMNS =
	'id,session_id,visitor_id,event_name,occurred_at,route_path,event_properties,is_internal';
const SESSION_CHUNK = 100;

const get = <T>(pathWithQuery: string) =>
	supabaseRestRequest<T[]>({ pathWithQuery, method: 'GET', useServiceRole: true });

async function firstRow<T>(pathWithQuery: string): Promise<T | null> {
	return (await get<T>(`${pathWithQuery}&limit=1`))[0] ?? null;
}

/** Server-only, read-only: resolves a folio to what the visitor did before contacting us. */
export async function loadLeadOrigin(query: string): Promise<LeadOriginResult> {
	const leadCode = normalizeLeadCode(query);
	if (!leadCode) return { status: 'invalid', query: query.slice(0, 40) };

	const lead = await firstRow<LeadOriginLeadRow>(
		`leads?select=id,lead_code,session_id,source_event_id,created_at&lead_code=eq.${leadCode}`,
	);
	if (!lead) return { status: 'not_found', leadCode };

	const [click, leadSession, inventory] = await Promise.all([
		lead.source_event_id
			? firstRow<LeadOriginEventRow>(
					`tracking_events?select=${EVENT_COLUMNS}&id=eq.${encodeURIComponent(lead.source_event_id)}`,
				)
			: null,
		lead.session_id
			? firstRow<LeadOriginSessionRow>(
					`visitor_sessions?select=${SESSION_COLUMNS}&id=eq.${encodeURIComponent(lead.session_id)}`,
				)
			: null,
		loadDemoInventory(),
	]);

	const contactAt = click?.occurred_at ?? lead.created_at;
	const visitorId = leadSession?.visitor_id ?? click?.visitor_id ?? null;
	const visitorSessions = visitorId
		? await loadCommercialRows<LeadOriginSessionRow>(
				`visitor_sessions?select=${SESSION_COLUMNS}&visitor_id=eq.${encodeURIComponent(visitorId)}&is_internal=eq.false&started_at=gte.${encodeURIComponent(leadOriginWindowStart(contactAt))}&started_at=lte.${encodeURIComponent(contactAt)}`,
			)
		: [];

	const sessionIds = [
		...new Set([
			...(leadSession && !leadSession.is_internal ? [leadSession.id] : []),
			...visitorSessions.map((s) => s.id),
		]),
	];
	const events: LeadOriginEventRow[] = [];
	for (let i = 0; i < sessionIds.length; i += SESSION_CHUNK) {
		const ids = sessionIds.slice(i, i + SESSION_CHUNK).join(',');
		events.push(
			...(await loadCommercialRows<LeadOriginEventRow>(
				`tracking_events?select=${EVENT_COLUMNS}&session_id=in.(${ids})&event_name=in.(${LEAD_ORIGIN_EVENT_NAMES.join(',')})&is_internal=eq.false`,
			)),
		);
	}

	let followups: LeadOriginFollowupRow[] | null = null;
	try {
		followups = await get<LeadOriginFollowupRow>(
			`commercial_demo_followups?select=demo_slug,action,occurred_at&lead_id=eq.${encodeURIComponent(lead.id)}&action=eq.demo_shared&order=occurred_at.asc`,
		);
	} catch {
		/* Missing migration or query failure is unknown, never "no demos shared". */
	}

	return {
		status: 'found',
		origin: buildLeadOrigin({
			lead,
			click,
			leadSession,
			visitorSessions,
			events,
			followups,
			demoTitles: new Map(inventory.map((demo) => [demo.slug, demo.title])),
		}),
	};
}
