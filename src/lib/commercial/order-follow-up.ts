import {
	ORDER_STAGE_KEYS,
	ORDER_STAGE_LABELS,
	type OrderStageKey,
} from '@/lib/commercial/order-stages';

/** The slice of a listed order the follow-up views need. */
export interface FollowUpOrder {
	id: string;
	orderNumber: string;
	totalAmount: number;
	amountPaid: number;
	eventDate?: string | null;
	stage: OrderStageKey | null;
}

export type PendingKind = 'data' | 'design' | 'balance';

export const PENDING_LABELS: Record<PendingKind, string> = {
	data: 'Faltan datos',
	design: 'Diseño pendiente',
	balance: 'Saldo',
};

/** Days ahead that count as «this week» for the urgency mark. */
export const URGENT_WINDOW_DAYS = 7;

export interface StageColumn<T extends FollowUpOrder> {
	key: OrderStageKey;
	label: string;
	orders: T[];
}

/** Seven columns in funnel order; closed orders (no stage) have no column. */
export function groupOrdersByStage<T extends FollowUpOrder>(orders: T[]): StageColumn<T>[] {
	return ORDER_STAGE_KEYS.map((key) => ({
		key,
		label: ORDER_STAGE_LABELS[key],
		orders: orders.filter((order) => order.stage === key),
	}));
}

export const balanceOf = (order: Pick<FollowUpOrder, 'totalAmount' | 'amountPaid'>) =>
	Math.max(0, order.totalAmount - order.amountPaid);

/** What is still open on an order: its invitation data, its design and its balance. */
export function pendingOf(order: FollowUpOrder): PendingKind[] {
	if (!order.stage) return [];
	const reached = ORDER_STAGE_KEYS.indexOf(order.stage);
	const pending: PendingKind[] = [];
	if (reached < ORDER_STAGE_KEYS.indexOf('data_received')) pending.push('data');
	if (reached < ORDER_STAGE_KEYS.indexOf('published')) pending.push('design');
	if (balanceOf(order) > 0) pending.push('balance');
	return pending;
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Whole days from `today` to the event date (negative when it already passed). */
export function daysUntil(eventDate: string, today: string): number {
	return dayNumber(eventDate) - dayNumber(today);
}

export interface AgendaEntry<T extends FollowUpOrder> {
	order: T;
	eventDate: string;
	daysLeft: number;
	pending: PendingKind[];
	/** Needs action: the event is within the week (or already past) and something is open. */
	urgent: boolean;
}

/**
 * Upcoming events by date, soonest first, with what each order still lacks. Events already past
 * stay in while something is open so nothing is forgotten; settled-and-published ones drop out.
 */
export function buildAgenda<T extends FollowUpOrder>(orders: T[], today: string): AgendaEntry<T>[] {
	return orders
		.filter((order): order is T & { eventDate: string } =>
			Boolean(order.eventDate && order.stage),
		)
		.map((order) => {
			const pending = pendingOf(order);
			const daysLeft = daysUntil(order.eventDate, today);
			return {
				order,
				eventDate: order.eventDate,
				daysLeft,
				pending,
				urgent: pending.length > 0 && daysLeft <= URGENT_WINDOW_DAYS,
			};
		})
		.filter((entry) => entry.daysLeft >= 0 || entry.pending.length > 0)
		.sort(
			(a, b) =>
				a.eventDate.localeCompare(b.eventDate) ||
				a.order.orderNumber.localeCompare(b.order.orderNumber),
		);
}
