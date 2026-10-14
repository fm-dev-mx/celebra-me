/**
 * Demo design retention for the administrator ranking (phase 2.1, Demos tab).
 * Aggregates over anonymous commercial sessions; no visitor data ever travels here.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Demo engagement").
 */

export const DEMO_PERIODS = [30, 60] as const;
export type DemoPeriod = (typeof DEMO_PERIODS)[number];

export const DEMO_SORTS = ['reach100', 'reach75', 'contactsPer100', 'sessions'] as const;
export type DemoSort = (typeof DEMO_SORTS)[number];

/** Depth buckets recorded by the commercial tracker. */
export const DEMO_DEPTH_BUCKETS = [25, 50, 75, 90, 100] as const;

export interface DemoEngagementRow {
	slug: string;
	title: string;
	eventType: string | null;
	themePreset: string | null;
	/** False when the demo no longer exists in the repository but still has sessions. */
	listed: boolean;
	sessions: number;
	reach50: number | null;
	reach75: number | null;
	reach100: number | null;
	/** Share of sessions that never reached the 25 % bucket (left without scrolling). */
	bounce: number | null;
	/** Bucket transition after 25 % with the largest share of sessions lost, e.g. `50-75`. */
	largestDrop: { from: number; to: number; share: number } | null;
	contactSessions: number;
	contactsPer100: number | null;
	sampleState: 'eligible' | 'insufficient';
	/** Dense rank within the event type among eligible demos; null otherwise. */
	rank: number | null;
}

export interface DemoEngagementReport {
	period: DemoPeriod;
	eventType: string;
	sort: DemoSort;
	/** Sessions a demo needs in the period before it is ranked. */
	minSessions: number;
	since: string;
	demos: DemoEngagementRow[];
}
