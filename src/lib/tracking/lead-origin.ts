/**
 * Lead origin (pure). Assembles what a folio (CM-XXXXXX) lead did before contacting us: the
 * WhatsApp click, the session it arrived in, demos and packages seen, earlier visits and demos
 * the operator shared. Internal traffic is dropped; demos opened in another tab are joined
 * through `visitor_id` within a bounded window before the click.
 */

export const LEAD_CODE_PATTERN = /^CM-[A-Z0-9]{6}$/;
/** Visitor-level join window: sessions that started up to this many days before the click. */
export const LEAD_ORIGIN_WINDOW_DAYS = 30;
export const LEAD_ORIGIN_EVENT_NAMES = [
	'demo_viewed',
	'scroll_depth_reached',
	'package_viewed',
] as const;

export interface LeadOriginLeadRow {
	id: string;
	lead_code: string;
	session_id: string | null;
	source_event_id: string | null;
	created_at: string;
}

export interface LeadOriginSessionRow {
	id: string;
	visitor_id: string;
	started_at: string;
	landing_path: string;
	referrer: string | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	fbclid: string | null;
	fbc: string | null;
	device_type: string | null;
	is_internal: boolean;
}

export interface LeadOriginEventRow {
	id: string;
	session_id: string | null;
	visitor_id: string;
	event_name: string;
	occurred_at: string;
	route_path: string;
	event_properties: Record<string, unknown>;
	is_internal: boolean;
}

export interface LeadOriginFollowupRow {
	demo_slug: string;
	action: string;
	occurred_at: string;
}

export interface LeadOriginInput {
	lead: LeadOriginLeadRow;
	click: LeadOriginEventRow | null;
	leadSession: LeadOriginSessionRow | null;
	visitorSessions: readonly LeadOriginSessionRow[];
	events: readonly LeadOriginEventRow[];
	/** `null` when the followups read failed: unknown, never "none shared". */
	followups: readonly LeadOriginFollowupRow[] | null;
	demoTitles: ReadonlyMap<string, string>;
}

export interface LeadOriginDemo {
	slug: string;
	title: string;
	views: number;
	maxDepth: number | null;
	lastSeenAt: string;
	/** Seen only in another session of the same visitor (another tab or day). */
	otherLinkOnly: boolean;
}

export interface LeadOrigin {
	leadCode: string;
	hasNavigation: boolean;
	click: {
		label: string | null;
		section: string | null;
		page: string;
		demoSlug: string | null;
		promoCode: string | null;
		at: string;
	} | null;
	arrival: {
		landingPath: string;
		referrer: string | null;
		utm: string | null;
		metaAd: boolean;
		device: string | null;
		startedAt: string;
	} | null;
	demos: LeadOriginDemo[];
	packages: { id: string; name: string; views: number }[];
	visits: number;
	firstVisitAt: string | null;
	contactAt: string;
	sharedDemos: { slug: string; title: string; at: string }[] | null;
}

export function normalizeLeadCode(value: string | null | undefined): string | null {
	const code = (value ?? '').trim().toUpperCase();
	return LEAD_CODE_PATTERN.test(code) ? code : null;
}

/** Earliest `started_at` the visitor-level join accepts for a click at `contactAt`. */
export function leadOriginWindowStart(contactAt: string): string {
	return new Date(Date.parse(contactAt) - LEAD_ORIGIN_WINDOW_DAYS * 86_400_000).toISOString();
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function depthOf(value: unknown): number | null {
	const depth = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(depth) ? depth : null;
}

function utmOf(session: LeadOriginSessionRow): string | null {
	const parts = [session.utm_source, session.utm_medium, session.utm_campaign]
		.map(text)
		.filter((part): part is string => part !== null);
	return parts.length > 0 ? parts.join(' / ') : null;
}

type Click = NonNullable<LeadOrigin['click']>;
type Arrival = NonNullable<LeadOrigin['arrival']>;
type PackageView = LeadOrigin['packages'][number];

function windowedSessions(
	leadSession: LeadOriginSessionRow | null,
	visitorSessions: readonly LeadOriginSessionRow[],
	contactAt: string,
): Map<string, LeadOriginSessionRow> {
	const windowStart = Date.parse(leadOriginWindowStart(contactAt));
	const contactTime = Date.parse(contactAt);
	const sessions = new Map<string, LeadOriginSessionRow>();
	if (leadSession) sessions.set(leadSession.id, leadSession);
	for (const session of visitorSessions) {
		const started = Date.parse(session.started_at);
		if (session.is_internal || started < windowStart || started > contactTime) continue;
		sessions.set(session.id, session);
	}
	return sessions;
}

/** Deepest scroll bucket per session and page, so a demo's depth is read on its own route. */
function deepestByPage(events: readonly LeadOriginEventRow[]): Map<string, number> {
	const deepest = new Map<string, number>();
	for (const event of events) {
		if (event.event_name !== 'scroll_depth_reached') continue;
		const depth = depthOf(event.event_properties.depth_bucket);
		if (depth === null) continue;
		const key = `${event.session_id}|${event.route_path}`;
		deepest.set(key, Math.max(depth, deepest.get(key) ?? 0));
	}
	return deepest;
}

function demosSeen(
	events: readonly LeadOriginEventRow[],
	leadSessionId: string | null,
	demoTitles: ReadonlyMap<string, string>,
): LeadOriginDemo[] {
	const deepest = deepestByPage(events);
	const demos = new Map<string, LeadOriginDemo>();
	for (const event of events) {
		const slug =
			event.event_name === 'demo_viewed' ? text(event.event_properties.demo_slug) : null;
		if (!slug) continue;
		const demo = demos.get(slug) ?? {
			slug,
			title: demoTitles.get(slug) ?? slug,
			views: 0,
			maxDepth: null,
			lastSeenAt: event.occurred_at,
			otherLinkOnly: true,
		};
		demo.views += 1;
		const depth = deepest.get(`${event.session_id}|${event.route_path}`);
		if (depth !== undefined) demo.maxDepth = Math.max(depth, demo.maxDepth ?? 0);
		if (event.occurred_at > demo.lastSeenAt) demo.lastSeenAt = event.occurred_at;
		if (event.session_id === leadSessionId) demo.otherLinkOnly = false;
		demos.set(slug, demo);
	}
	return [...demos.values()].sort(
		(a, b) => b.views - a.views || b.lastSeenAt.localeCompare(a.lastSeenAt),
	);
}

function packagesSeen(events: readonly LeadOriginEventRow[]): PackageView[] {
	const packages = new Map<string, PackageView>();
	for (const event of events) {
		const id =
			event.event_name === 'package_viewed' ? text(event.event_properties.package_id) : null;
		if (!id) continue;
		const entry = packages.get(id) ?? {
			id,
			name: text(event.event_properties.package_name) ?? id,
			views: 0,
		};
		entry.views += 1;
		packages.set(id, entry);
	}
	return [...packages.values()].sort((a, b) => b.views - a.views);
}

function clickOf(click: LeadOriginEventRow): Click {
	const props = click.event_properties;
	return {
		label: text(props.cta_label),
		section: text(props.cta_location) ?? text(props.source_area),
		page: click.route_path,
		demoSlug: text(props.demo_slug),
		promoCode: text(props.promo_code),
		at: click.occurred_at,
	};
}

function arrivalOf(session: LeadOriginSessionRow): Arrival {
	return {
		landingPath: session.landing_path,
		referrer: text(session.referrer),
		utm: utmOf(session),
		metaAd: Boolean(text(session.fbclid) || text(session.fbc)),
		device: text(session.device_type),
		startedAt: session.started_at,
	};
}

export function buildLeadOrigin(input: LeadOriginInput): LeadOrigin {
	const { lead, demoTitles } = input;
	const click = input.click && !input.click.is_internal ? input.click : null;
	const leadSession =
		input.leadSession && !input.leadSession.is_internal ? input.leadSession : null;
	const contactAt = click?.occurred_at ?? lead.created_at;
	const sessions = windowedSessions(leadSession, input.visitorSessions, contactAt);
	const events = input.events.filter(
		(event) =>
			!event.is_internal && event.session_id !== null && sessions.has(event.session_id),
	);
	const sharedDemos =
		input.followups
			?.filter((f) => f.action === 'demo_shared')
			.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
			.map((f) => ({
				slug: f.demo_slug,
				title: demoTitles.get(f.demo_slug) ?? f.demo_slug,
				at: f.occurred_at,
			})) ?? null;

	return {
		leadCode: lead.lead_code,
		hasNavigation: click !== null || sessions.size > 0,
		click: click ? clickOf(click) : null,
		arrival: leadSession ? arrivalOf(leadSession) : null,
		demos: demosSeen(events, leadSession?.id ?? null, demoTitles),
		packages: packagesSeen(events),
		visits: sessions.size,
		firstVisitAt: [...sessions.values()].map((s) => s.started_at).sort()[0] ?? null,
		contactAt,
		sharedDemos,
	};
}
