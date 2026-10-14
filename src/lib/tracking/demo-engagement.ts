/**
 * Demo design retention (pure). Sessions come from `demo_viewed` with a `demo_slug`; scroll depth
 * and contacts carry no slug, so they are attributed through the session that viewed the demo.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Demo engagement").
 */
import {
	DEMO_DEPTH_BUCKETS,
	type DemoEngagementRow,
	type DemoSort,
} from '@/interfaces/dashboard/demo-engagement.interface';

export interface DemoTrackingEvent {
	session_id: string | null;
	event_name: string;
	event_properties: Record<string, unknown>;
}

export interface DemoCatalogItem {
	slug: string;
	title: string;
	eventType: string;
	themePreset: string | null;
}

/** A demo enters the ranking with at least this many sessions in the period. */
export const DEMO_MIN_SESSIONS = 100;

const CONTACT_EVENTS: ReadonlySet<string> = new Set(['cta_clicked', 'whatsapp_contact_clicked']);

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function depthOf(value: unknown): number | null {
	const depth = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(depth) ? depth : null;
}

interface DemoSessions {
	eventType: string | null;
	sessions: Set<string>;
}

function sessionsByDemo(events: readonly DemoTrackingEvent[]): Map<string, DemoSessions> {
	const byDemo = new Map<string, DemoSessions>();
	for (const event of events) {
		if (event.event_name !== 'demo_viewed' || !event.session_id) continue;
		const slug = asString(event.event_properties.demo_slug);
		if (!slug) continue;
		const entry = byDemo.get(slug) ?? {
			eventType: asString(event.event_properties.event_type),
			sessions: new Set<string>(),
		};
		entry.sessions.add(event.session_id);
		byDemo.set(slug, entry);
	}
	return byDemo;
}

function deepestBySession(events: readonly DemoTrackingEvent[]): Map<string, number> {
	const deepest = new Map<string, number>();
	for (const event of events) {
		if (event.event_name !== 'scroll_depth_reached' || !event.session_id) continue;
		const depth = depthOf(event.event_properties.depth_bucket);
		if (depth === null) continue;
		deepest.set(event.session_id, Math.max(depth, deepest.get(event.session_id) ?? 0));
	}
	return deepest;
}

function contactSessionsOf(events: readonly DemoTrackingEvent[]): Set<string> {
	return new Set(
		events
			.filter((event) => CONTACT_EVENTS.has(event.event_name) && event.session_id)
			.map((event) => event.session_id as string),
	);
}

function share(part: number, whole: number): number | null {
	return whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : null;
}

/**
 * Transition between consecutive depth buckets after 25 % that loses the largest share of
 * sessions. Leaving before 25 % is reported separately as bounce, which would otherwise hide it.
 */
function largestDrop(reached: (bucket: number) => number, sessions: number) {
	if (sessions === 0) return null;
	const steps = DEMO_DEPTH_BUCKETS;
	let best: DemoEngagementRow['largestDrop'] = null;
	for (let index = 1; index < steps.length; index += 1) {
		const from = steps[index - 1]!;
		const to = steps[index]!;
		const before = reached(from);
		const lost = (before - reached(to)) / sessions;
		if (lost > 0 && (!best || lost > best.share)) {
			best = { from, to, share: Math.round(lost * 10_000) / 10_000 };
		}
	}
	return best;
}

const SORT_VALUE: Record<DemoSort, (row: DemoEngagementRow) => number | null> = {
	reach100: (row) => row.reach100,
	reach75: (row) => row.reach75,
	contactsPer100: (row) => row.contactsPer100,
	sessions: (row) => row.sessions,
};

/** Builds one row per demo with sessions or in the catalog, ranked within its event type. */
export function summarizeDemoEngagement(
	events: readonly DemoTrackingEvent[],
	catalog: readonly DemoCatalogItem[],
	options: { sort: DemoSort; eventType: string },
): DemoEngagementRow[] {
	const byDemo = sessionsByDemo(events);
	const deepest = deepestBySession(events);
	const contacts = contactSessionsOf(events);
	const slugs = new Set([...catalog.map((item) => item.slug), ...byDemo.keys()]);

	const rows = [...slugs].map((slug): DemoEngagementRow => {
		const item = catalog.find((entry) => entry.slug === slug);
		const sessions = [...(byDemo.get(slug)?.sessions ?? [])];
		const total = sessions.length;
		const reached = (bucket: number) =>
			sessions.filter((session) => (deepest.get(session) ?? 0) >= bucket).length;
		const contactSessions = sessions.filter((session) => contacts.has(session)).length;
		return {
			slug,
			title: item?.title ?? slug,
			eventType: item?.eventType ?? byDemo.get(slug)?.eventType ?? null,
			themePreset: item?.themePreset ?? null,
			listed: Boolean(item),
			sessions: total,
			bounce: share(total - reached(25), total),
			reach50: share(reached(50), total),
			reach75: share(reached(75), total),
			reach100: share(reached(100), total),
			largestDrop: largestDrop(reached, total),
			contactSessions,
			contactsPer100: total > 0 ? Math.round((contactSessions / total) * 10_000) / 100 : null,
			sampleState: total >= DEMO_MIN_SESSIONS ? 'eligible' : 'insufficient',
			rank: null,
		};
	});

	const valueOf = SORT_VALUE[options.sort];
	const filtered = rows.filter(
		(row) => options.eventType === 'all' || row.eventType === options.eventType,
	);
	filtered.sort(
		(a, b) =>
			(a.eventType ?? '').localeCompare(b.eventType ?? '') ||
			Number(b.sampleState === 'eligible') - Number(a.sampleState === 'eligible') ||
			(valueOf(b) ?? -1) - (valueOf(a) ?? -1) ||
			a.slug.localeCompare(b.slug),
	);

	let currentType: string | null | undefined;
	let rank = 0;
	let previous: number | null = null;
	return filtered.map((row) => {
		if (row.eventType !== currentType) {
			currentType = row.eventType;
			rank = 0;
			previous = null;
		}
		const value = valueOf(row);
		if (row.sampleState !== 'eligible' || value === null) return row;
		if (value !== previous) {
			rank += 1;
			previous = value;
		}
		return { ...row, rank };
	});
}
