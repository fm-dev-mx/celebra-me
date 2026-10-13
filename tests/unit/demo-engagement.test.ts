import {
	DEMO_MIN_SESSIONS,
	summarizeDemoEngagement,
	type DemoCatalogItem,
	type DemoTrackingEvent,
} from '@/lib/tracking/demo-engagement';

const catalog: DemoCatalogItem[] = [
	{ slug: 'demo-a', title: 'Demo A', eventType: 'xv', themePreset: 'celestial-blue' },
	{ slug: 'demo-b', title: 'Demo B', eventType: 'xv', themePreset: 'editorial' },
	{ slug: 'demo-boda', title: 'Boda', eventType: 'boda', themePreset: 'jewelry-box-wedding' },
];

/** Builds sessions for a demo: each entry is the deepest bucket reached (0 = none). */
function sessions(
	slug: string,
	depths: number[],
	contacts = 0,
	eventType = 'xv',
): DemoTrackingEvent[] {
	return depths.flatMap((depth, index) => {
		const session = `${slug}-s${index}`;
		const events: DemoTrackingEvent[] = [
			{
				session_id: session,
				event_name: 'demo_viewed',
				event_properties: { demo_slug: slug, event_type: eventType },
			},
		];
		for (const bucket of [25, 50, 75, 90, 100]) {
			if (bucket <= depth) {
				events.push({
					session_id: session,
					event_name: 'scroll_depth_reached',
					event_properties: { depth_bucket: bucket },
				});
			}
		}
		if (index < contacts) {
			events.push({
				session_id: session,
				event_name: 'whatsapp_contact_clicked',
				event_properties: {},
			});
		}
		return events;
	});
}

const repeat = (depth: number, count: number) => Array.from({ length: count }, () => depth);

describe('summarizeDemoEngagement', () => {
	it('attributes depth and contacts through the viewing session', () => {
		const events = sessions(
			'demo-a',
			[...repeat(100, 50), ...repeat(75, 30), ...repeat(25, 20)],
			5,
		);
		const [row] = summarizeDemoEngagement(events, catalog, {
			sort: 'reach100',
			eventType: 'xv',
		});
		expect(row).toMatchObject({
			slug: 'demo-a',
			sessions: 100,
			reach50: 0.8,
			reach75: 0.8,
			reach100: 0.5,
			contactSessions: 5,
			contactsPer100: 5,
			sampleState: 'eligible',
			rank: 1,
		});
		// 30 sessions stop at 75 % (lost before 90 %); 20 stop at 25 % (lost before 50 %).
		expect(row?.largestDrop).toEqual({ from: 75, to: 90, share: 0.3 });
		expect(row?.bounce).toBe(0);
	});

	it('reports leaving before 25 % as bounce, outside the largest drop', () => {
		const events = sessions('demo-a', [
			...repeat(0, 40),
			...repeat(100, 50),
			...repeat(50, 10),
		]);
		const [row] = summarizeDemoEngagement(events, catalog, {
			sort: 'reach100',
			eventType: 'xv',
		});
		expect(row?.bounce).toBe(0.4);
		expect(row?.largestDrop).toEqual({ from: 50, to: 75, share: 0.1 });
	});

	it('greys demos under the session threshold and never ranks them', () => {
		const events = [
			...sessions('demo-a', repeat(50, DEMO_MIN_SESSIONS)),
			...sessions('demo-b', repeat(100, 10)),
		];
		const rows = summarizeDemoEngagement(events, catalog, {
			sort: 'reach100',
			eventType: 'xv',
		});
		const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
		expect(bySlug['demo-b']).toMatchObject({
			sampleState: 'insufficient',
			rank: null,
			reach100: 1,
		});
		expect(bySlug['demo-a']).toMatchObject({ sampleState: 'eligible', rank: 1 });
		expect(rows[0]?.slug).toBe('demo-a');
	});

	it('ranks within each event type and keeps demos without sessions listed', () => {
		const events = [
			...sessions('demo-a', repeat(100, 120)),
			...sessions('demo-boda', repeat(50, 120), 0, 'boda'),
		];
		const rows = summarizeDemoEngagement(events, catalog, {
			sort: 'reach100',
			eventType: 'all',
		});
		expect(
			rows
				.filter((row) => row.rank === 1)
				.map((row) => row.slug)
				.sort(),
		).toEqual(['demo-a', 'demo-boda']);
		expect(rows.find((row) => row.slug === 'demo-b')).toMatchObject({
			sessions: 0,
			reach100: null,
			rank: null,
		});
	});

	it('marks demos with sessions that left the catalog as retired', () => {
		const rows = summarizeDemoEngagement(sessions('demo-old', repeat(90, 3)), catalog, {
			sort: 'sessions',
			eventType: 'all',
		});
		expect(rows.find((row) => row.slug === 'demo-old')).toMatchObject({
			listed: false,
			eventType: 'xv',
		});
	});

	it('sorts by contacts per 100 sessions when asked', () => {
		const events = [
			...sessions('demo-a', repeat(100, 100), 1),
			...sessions('demo-b', repeat(25, 100), 9),
		];
		const rows = summarizeDemoEngagement(events, catalog, {
			sort: 'contactsPer100',
			eventType: 'xv',
		});
		expect(rows.map((row) => row.slug)).toEqual(['demo-b', 'demo-a']);
	});
});
