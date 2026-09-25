import { loadDemoInventory } from '@/lib/commercial/demo-inventory.server';
import type { DemoFollowupRow } from '@/lib/commercial/demo-followup';
import { loadCommercialRows } from './commercial-pagination.server';
import { commercialPeriod } from './commercial-period';
import {
	summarizeDemoConversions,
	paymentDemo,
	type DemoMetricEvent,
} from './demo-conversion-report';
import type { CommercialRecordClassification } from './commercial-classification';

export async function loadDemoConversionReport(days: 30 | 60 = 30) {
	const period = commercialPeriod(days);
	const dateFilter = `occurred_at=gte.${period.start}&occurred_at=lt.${period.end}`;
	const [inventory, events, classifications, leads, payments] = await Promise.all([
		loadDemoInventory(),
		loadCommercialRows<DemoMetricEvent>(
			`tracking_events?select=id,session_id,event_name,event_properties,route_class&is_internal=eq.false&${dateFilter}`,
		),
		loadCommercialRows<CommercialRecordClassification & { id: string }>(
			'commercial_record_classifications?select=id,record_type,record_id&classification=eq.test_qa&revoked_at=is.null',
		),
		loadCommercialRows<{ id: string; customer_id: string | null }>(
			'leads?select=id,customer_id',
		),
		loadCommercialRows<{
			id: string;
			lead_id: string | null;
			customer_id: string | null;
			deposit_paid_at: string;
		}>(
			`sales_orders?select=id,lead_id,customer_id,deposit_paid_at&status=in.(deposit_paid,paid)&deposit_paid_at=gte.${period.start}&deposit_paid_at=lt.${period.end}`,
		),
	]);
	const test = new Set(classifications.map((c) => `${c.record_type}:${c.record_id}`));
	const testLeads = new Set(
		leads
			.filter((l) => test.has(`lead:${l.id}`) || test.has(`customer:${l.customer_id}`))
			.map((l) => l.id),
	);
	let activities: DemoFollowupRow[] | null = null;
	try {
		activities = (
			await loadCommercialRows<DemoFollowupRow>(
				'commercial_demo_followups?select=id,lead_id,demo_slug,action,loss_reason,occurred_at',
			)
		).filter((a) => !testLeads.has(a.lead_id));
	} catch {
		/* Missing migration or query failure is unknown, never an empty funnel. */
	}
	const periodActivities =
		activities?.filter(
			(a) =>
				Date.parse(a.occurred_at) >= Date.parse(period.start) &&
				Date.parse(a.occurred_at) < Date.parse(period.end),
		) ?? null;
	const validPayments = payments.filter(
		(p) =>
			!test.has(`sales_order:${p.id}`) &&
			!test.has(`customer:${p.customer_id}`) &&
			!testLeads.has(p.lead_id ?? ''),
	);
	const metrics = summarizeDemoConversions(inventory, events, periodActivities, []);
	const paymentMetrics = summarizeDemoConversions(inventory, [], activities, validPayments);
	return {
		period,
		inventory,
		followupsAvailable: activities !== null,
		metrics: metrics.map((m, i) => ({ ...m, paid: paymentMetrics[i].paid })),
		unattributedPayments:
			activities === null
				? null
				: validPayments.filter((p) => !paymentDemo(p, activities!)).length,
	};
}
