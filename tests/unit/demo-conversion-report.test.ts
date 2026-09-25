import { commercialPeriod } from '@/lib/tracking/commercial-period';
import {
	summarizeDemoConversions,
	type DemoMetricEvent,
} from '@/lib/tracking/demo-conversion-report';
import type { DemoFollowupRow } from '@/lib/commercial/demo-followup';

const inventory = Array.from({ length: 13 }, (_, i) => ({
	slug: `demo-${i}`,
	title: `Demo ${i}`,
	eventType: 'xv',
}));
const event = (id: string, name: string, session = 'session', route = 'demo'): DemoMetricEvent => ({
	id,
	event_name: name,
	session_id: session,
	route_class: route,
	event_properties: { demo_slug: 'demo-0' },
});
const shared = (slug: string): DemoFollowupRow => ({
	id: slug,
	lead_id: 'lead',
	demo_slug: slug,
	action: 'demo_shared',
	loss_reason: 'not_reported',
	occurred_at: '2026-09-01T00:00:00Z',
});

describe('complete-day demo conversion report', () => {
	it('excludes today in the declared business timezone for 30 and 60 days', () => {
		expect(commercialPeriod(30, new Date('2026-09-25T18:00:00Z'))).toMatchObject({
			startDate: '2026-08-26',
			endDate: '2026-09-24',
			start: '2026-08-26T06:00:00.000Z',
			end: '2026-09-25T06:00:00.000Z',
		});
		expect(commercialPeriod(60, new Date('2026-09-25T03:00:00Z'))).toMatchObject({
			startDate: '2026-07-26',
			endDate: '2026-09-23',
		});
	});
	it('keeps all demos and unavailable measurement distinct from measured zero clicks', () => {
		const report = summarizeDemoConversions(inventory, [event('1', 'demo_viewed')], null, []);
		expect(report).toHaveLength(13);
		expect(report[0]).toMatchObject({
			views: 1,
			clicks: 0,
			ctr: 0,
			contacted: null,
			paid: null,
		});
		expect(report[1]).toMatchObject({ views: null, clicks: null, ctr: null });
	});
	it('uses same-source measured sessions, not showroom clicks or view counts, for CTR', () => {
		const report = summarizeDemoConversions(
			inventory,
			[
				event('1', 'demo_viewed'),
				event('2', 'demo_viewed'),
				event('3', 'whatsapp_contact_clicked'),
				event('4', 'whatsapp_contact_clicked'),
				event('5', 'whatsapp_contact_clicked', 'showroom', 'commercial'),
			],
			[],
			[],
		);
		expect(report[0]).toMatchObject({ views: 2, clicks: 3, ctr: 1, contacted: 0 });
	});
	it('does not arbitrarily assign multi-style opportunities to one demo', () => {
		expect(
			summarizeDemoConversions(
				inventory,
				[],
				[shared('demo-0'), shared('demo-1')],
				[{ lead_id: 'lead', deposit_paid_at: '2026-09-20T00:00:00Z' }],
			)[0].paid,
		).toBe(0);
		expect(
			summarizeDemoConversions(
				inventory,
				[],
				[shared('demo-0')],
				[
					{ lead_id: 'lead', deposit_paid_at: '2026-09-20T00:00:00Z' },
					{ lead_id: 'lead', deposit_paid_at: '2026-09-20T00:00:00Z' },
				],
			)[0].paid,
		).toBe(1);
	});
});
