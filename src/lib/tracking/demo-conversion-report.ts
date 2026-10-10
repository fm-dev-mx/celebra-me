import type { DemoFollowupRow } from '@/lib/commercial/demo-followup';

export interface DemoMetricEvent {
	id: string;
	session_id: string | null;
	event_name: string;
	route_class: string;
	event_properties: Record<string, unknown>;
}
export interface DemoInventoryItem {
	slug: string;
	title: string;
	eventType: string;
}

/** A repository demo with its public route, for the dashboard demo catalog. */
export interface DemoLinkItem extends DemoInventoryItem {
	invitationTitle: string;
	href: string;
	inShowroom: boolean;
}

export interface DemoPayment {
	lead_id?: string | null;
	deposit_paid_at?: string | null;
}

/** Attribution requires a recorded share before payment, with no competing style. */
export function paymentDemo(payment: DemoPayment, activities: DemoFollowupRow[]): string | null {
	if (!payment.lead_id || !payment.deposit_paid_at) return null;
	const styles = new Set(
		activities
			.filter(
				(a) =>
					a.lead_id === payment.lead_id &&
					a.action === 'demo_shared' &&
					Date.parse(a.occurred_at) <= Date.parse(payment.deposit_paid_at!),
			)
			.map((a) => a.demo_slug),
	);
	return styles.size === 1 ? [...styles][0] : null;
}

export function summarizeDemoConversions(
	inventory: DemoInventoryItem[],
	events: DemoMetricEvent[],
	activities: DemoFollowupRow[] | null,
	payments: DemoPayment[],
) {
	return inventory.map((demo) => {
		const own = events.filter((e) => e.event_properties.demo_slug === demo.slug);
		const views = own.filter((e) => e.event_name === 'demo_viewed');
		const sessions = new Set(views.map((e) => e.session_id).filter(Boolean));
		const clicks = own.filter((e) => e.event_name === 'whatsapp_contact_clicked');
		const clickedSessions = new Set(
			clicks
				.filter((e) => e.route_class === 'demo' && sessions.has(e.session_id))
				.map((e) => e.session_id),
		);
		const count = (action: DemoFollowupRow['action']) =>
			activities === null
				? null
				: new Set(
						activities
							.filter((a) => a.demo_slug === demo.slug && a.action === action)
							.map((a) => a.lead_id),
					).size;
		return {
			...demo,
			views: views.length || null,
			clicks: views.length || clicks.length ? clicks.length : null,
			sessions: sessions.size || null,
			ctr: sessions.size ? clickedSessions.size / sessions.size : null,
			shared: count('demo_shared'),
			contacted: count('contact_received'),
			quoted: count('quote_sent'),
			lost: count('lost'),
			paid:
				activities === null
					? null
					: new Set(
							payments
								.filter((p) => paymentDemo(p, activities) === demo.slug)
								.map((p) => p.lead_id),
						).size,
		};
	});
}
