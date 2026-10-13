import { getCollection } from 'astro:content';
import { getContentEntrySlug } from '@/lib/content/events';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import { ApiError } from '@/lib/rsvp/core/errors';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import {
	DEMO_PERIODS,
	DEMO_SORTS,
	type DemoEngagementReport,
	type DemoPeriod,
	type DemoSort,
} from '@/interfaces/dashboard/demo-engagement.interface';
import { loadCommercialRows } from './commercial-pagination.server';
import { commercialPeriod } from './commercial-period';
import {
	DEMO_MIN_SESSIONS,
	summarizeDemoEngagement,
	type DemoCatalogItem,
	type DemoTrackingEvent,
} from './demo-engagement';

/** Commercial tracking of demo routes starts on this date. */
export const DEMO_TRACKING_SINCE = '2026-06-29';

async function loadDemoCatalog(): Promise<DemoCatalogItem[]> {
	return (await getCollection('event-demos')).map((entry) => {
		const slug = getContentEntrySlug(entry.id);
		const data = entry.data as { eventType: string; theme?: { preset?: unknown } };
		const card = DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug);
		return {
			slug,
			title: card?.title ?? slug,
			eventType: data.eventType,
			themePreset: typeof data.theme?.preset === 'string' ? data.theme.preset : null,
		};
	});
}

export interface DemoEngagementQuery {
	period?: string | null;
	eventType?: string | null;
	sort?: string | null;
}

export function parseDemoEngagementQuery(query: DemoEngagementQuery) {
	const period = Number(query.period?.trim() || 30);
	if (!(DEMO_PERIODS as readonly number[]).includes(period)) {
		throw new ApiError(400, 'bad_request', 'Periodo inválido.');
	}
	const eventType = query.eventType?.trim() || 'all';
	if (eventType !== 'all' && !(EVENT_TYPES as readonly string[]).includes(eventType)) {
		throw new ApiError(400, 'bad_request', 'Tipo de evento inválido.');
	}
	const sort = query.sort?.trim() || 'reach100';
	if (!(DEMO_SORTS as readonly string[]).includes(sort)) {
		throw new ApiError(400, 'bad_request', 'Orden inválido.');
	}
	return { period: period as DemoPeriod, eventType, sort: sort as DemoSort };
}

/** Demo retention for the administrator ranking; anonymous sessions only, internal traffic out. */
export async function getDemoEngagement(query: DemoEngagementQuery): Promise<DemoEngagementReport> {
	const parsed = parseDemoEngagementQuery(query);
	const window = commercialPeriod(parsed.period);
	const [catalog, events] = await Promise.all([
		loadDemoCatalog(),
		loadCommercialRows<DemoTrackingEvent & { id: string }>(
			'tracking_events?select=id,session_id,event_name,event_properties' +
				`&route_class=eq.demo&is_internal=eq.false&occurred_at=gte.${window.start}&occurred_at=lt.${window.end}`,
		),
	]);
	return {
		period: parsed.period,
		eventType: parsed.eventType,
		sort: parsed.sort,
		minSessions: DEMO_MIN_SESSIONS,
		since: DEMO_TRACKING_SINCE,
		demos: summarizeDemoEngagement(events, catalog, parsed),
	};
}
