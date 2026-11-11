import { useEffect, useRef, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { SalesOrder, SalesOrderPayment } from '@/lib/commercial/orders.repository';
import type { OrderStageProgress } from '@/lib/commercial/order-stages';

interface OrderDetail {
	order: SalesOrder;
	payments: SalesOrderPayment[];
	stages: OrderStageProgress;
}

const API = '/api/dashboard/commercial/orders';
const money = (value: number) =>
	new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });
const dayLabel = (iso: string) =>
	new Date(iso).toLocaleDateString('es-MX', {
		timeZone: 'America/Mazatlan',
		dateStyle: 'medium',
	});
const PAYMENT_LABELS = { deposit: 'Anticipo', installment: 'Abono', settlement: 'Liquidación' };

/** Line of the seven order stages. The current one is announced, not only coloured. */
export function OrderStageLine({ stages }: { stages: OrderStageProgress }) {
	return (
		<ol className="orders-workspace__stages" aria-label="Etapas del pedido">
			{stages.steps.map((step) => (
				<li
					key={step.key}
					data-done={step.done}
					aria-current={stages.current === step.key ? 'step' : undefined}
				>
					{step.label}
					<span className="sr-only">
						{step.done
							? stages.current === step.key
								? ' (etapa actual)'
								: ' (lista)'
							: ' (pendiente)'}
					</span>
				</li>
			))}
		</ol>
	);
}

/** Detail of one order: stage line, event date, payment history and the next payment. */
export default function OrderDetailPanel({
	orderId,
	onChanged,
}: {
	orderId: string;
	onChanged?: () => void;
}) {
	const [detail, setDetail] = useState<OrderDetail | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [eventDate, setEventDate] = useState('');
	const [amount, setAmount] = useState('');
	const [paidOn, setPaidOn] = useState(today);
	const attempt = useRef<{ key: string; amount: number; paidAt: string } | null>(null);

	async function load() {
		const result = await dashboardApi.get<{ data: OrderDetail }>(`${API}/${orderId}/detail`);
		if (!result.ok) {
			setError(result.message || 'No se pudo cargar el pedido.');
			return;
		}
		setDetail(result.data.data);
		setEventDate(result.data.data.order.eventDate ?? '');
		setAmount(
			String(
				Math.max(0, result.data.data.order.totalAmount - result.data.data.order.amountPaid),
			),
		);
	}
	useEffect(() => {
		void load();
	}, [orderId]);

	async function saveEventDate() {
		setBusy(true);
		setError('');
		const result = await dashboardApi.patch<{ data: SalesOrder }>(`${API}/${orderId}/detail`, {
			eventDate: eventDate || null,
		});
		setBusy(false);
		if (!result.ok) return setError(result.message || 'No se pudo guardar la fecha.');
		await load();
		onChanged?.();
	}

	async function registerPayment() {
		if (!detail) return;
		const balance = detail.order.totalAmount - detail.order.amountPaid;
		const value = Number(amount);
		if (!(value > 0 && value <= balance))
			return setError('El pago debe ser mayor a cero y no superar el saldo pendiente.');
		// Keep the exact request on an uncertain response so a retry cannot record a different payment.
		if (!attempt.current || attempt.current.amount !== value)
			attempt.current = {
				key: crypto.randomUUID(),
				amount: value,
				paidAt: new Date(`${paidOn}T12:00:00-07:00`).toISOString(),
			};
		setBusy(true);
		setError('');
		const result = await dashboardApi.post(`${API}/${orderId}/payments`, {
			amount: attempt.current.amount,
			paidAt: attempt.current.paidAt,
			idempotencyKey: attempt.current.key,
		});
		setBusy(false);
		if (!result.ok) {
			if (result.status >= 400 && result.status < 500) attempt.current = null;
			return setError(result.message || 'No se pudo guardar el pago. Intente de nuevo.');
		}
		attempt.current = null;
		await load();
		onChanged?.();
	}

	if (!detail) return error ? <p role="alert">{error}</p> : <p role="status">Cargando…</p>;
	const { order, payments, stages } = detail;
	const balance = Math.max(0, order.totalAmount - order.amountPaid);
	const canPay = order.status === 'deposit_paid' && balance > 0;

	return (
		<div className="orders-workspace__detail">
			<OrderStageLine stages={stages} />
			{error && (
				<p role="alert" className="dashboard-error">
					{error}
				</p>
			)}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void saveEventDate();
				}}
			>
				<label htmlFor={`event-date-${order.id}`}>Fecha del evento</label>
				<input
					id={`event-date-${order.id}`}
					type="date"
					value={eventDate}
					onChange={(event) => setEventDate(event.target.value)}
				/>
				<button className="btn-secondary" type="submit" disabled={busy}>
					Guardar fecha
				</button>
			</form>
			<h4>Historial de pagos</h4>
			{payments.length ? (
				<ul>
					{payments.map((payment) => (
						<li key={payment.id}>
							{PAYMENT_LABELS[payment.kind]} · {money(payment.amount)} ·{' '}
							{dayLabel(payment.paidAt)}
						</li>
					))}
				</ul>
			) : (
				<p>Sin pagos registrados.</p>
			)}
			<p>
				Pagado {money(order.amountPaid)} de {money(order.totalAmount)} · Saldo pendiente:{' '}
				{money(balance)}
			</p>
			{canPay && (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void registerPayment();
					}}
				>
					<label htmlFor={`pay-amount-${order.id}`}>Monto recibido (MXN)</label>
					<input
						id={`pay-amount-${order.id}`}
						type="number"
						min="0.01"
						step="0.01"
						max={balance}
						required
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
					/>
					<label htmlFor={`pay-date-${order.id}`}>Fecha del pago</label>
					<input
						id={`pay-date-${order.id}`}
						type="date"
						required
						max={today()}
						value={paidOn}
						onChange={(event) => setPaidOn(event.target.value)}
					/>
					<button className="btn-primary" type="submit" disabled={busy}>
						{busy
							? 'Guardando…'
							: Number(amount) >= balance
								? 'Registrar liquidación'
								: 'Registrar abono'}
					</button>
				</form>
			)}
		</div>
	);
}
