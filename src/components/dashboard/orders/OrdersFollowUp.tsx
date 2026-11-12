import { eventDateLabel } from '@/components/dashboard/orders/OrderCustomerDetail';
import {
	PENDING_LABELS,
	balanceOf,
	buildAgenda,
	daysUntil,
	groupOrdersByStage,
	pendingOf,
	URGENT_WINDOW_DAYS,
	type FollowUpOrder,
} from '@/lib/commercial/order-follow-up';

const money = (value: number) =>
	new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

function whenLabel(eventDate: string, today: string) {
	const days = daysUntil(eventDate, today);
	if (days < 0) return 'Evento pasado';
	if (days === 0) return 'Hoy';
	if (days === 1) return 'Mañana';
	return `En ${days} días`;
}

const isUrgent = (order: FollowUpOrder, today: string) =>
	Boolean(
		order.eventDate &&
		pendingOf(order).length > 0 &&
		daysUntil(order.eventDate, today) <= URGENT_WINDOW_DAYS,
	);

/** The seven stages as columns. A card that needs action this week says so in words. */
export function OrdersStageBoard({ orders, today }: { orders: FollowUpOrder[]; today: string }) {
	const columns = groupOrdersByStage(orders);
	return (
		<div className="orders-workspace__board" role="list" aria-label="Pedidos por etapa">
			{columns.map((column) => (
				<section
					key={column.key}
					className="orders-workspace__column"
					role="listitem"
					aria-label={`${column.label}: ${column.orders.length}`}
				>
					<h3>
						{column.label} <span>({column.orders.length})</span>
					</h3>
					{column.orders.map((order) => (
						<article
							key={order.id}
							className="orders-workspace__card"
							data-urgent={isUrgent(order, today)}
						>
							<strong>{order.orderNumber}</strong>
							{order.eventDate && (
								<p>
									{eventDateLabel(order.eventDate)} ·{' '}
									{whenLabel(order.eventDate, today)}
								</p>
							)}
							{balanceOf(order) > 0 && <p>Saldo: {money(balanceOf(order))}</p>}
							{isUrgent(order, today) && (
								<p className="orders-workspace__flag">
									Requiere acción esta semana
								</p>
							)}
						</article>
					))}
				</section>
			))}
		</div>
	);
}

/** Upcoming events by date with what each order still lacks. */
export function OrdersAgenda({ orders, today }: { orders: FollowUpOrder[]; today: string }) {
	const agenda = buildAgenda(orders, today);
	if (!agenda.length) return <p>No hay eventos próximos con fecha en estos pedidos.</p>;
	return (
		<ol className="orders-workspace__agenda" aria-label="Próximos eventos">
			{agenda.map((entry) => (
				<li
					key={entry.order.id}
					className="orders-workspace__card"
					data-urgent={entry.urgent}
				>
					<strong>
						{eventDateLabel(entry.eventDate)} · {whenLabel(entry.eventDate, today)}
					</strong>
					<p>{entry.order.orderNumber}</p>
					{entry.urgent && (
						<p className="orders-workspace__flag">Requiere acción esta semana</p>
					)}
					<p>
						{entry.pending.length
							? entry.pending
									.map((kind) =>
										kind === 'balance'
											? `${PENDING_LABELS.balance}: ${money(balanceOf(entry.order))}`
											: PENDING_LABELS[kind],
									)
									.join(' · ')
							: 'Sin pendientes'}
					</p>
				</li>
			))}
		</ol>
	);
}
