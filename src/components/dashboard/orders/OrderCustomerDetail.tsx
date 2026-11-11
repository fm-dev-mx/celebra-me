import { useEffect, useRef, useState } from 'react';
import type { SalesOrder } from '@/lib/commercial/orders.repository';
import type { Customer } from '@/components/dashboard/commercial/LeadCandidatesList';
import CustomerOrdersBox from '@/components/dashboard/commercial/CustomerOrdersBox';
import { CustomerReferralPanel } from '@/components/dashboard/commercial/ReferralFields';
import { API, getData, postData } from '@/components/dashboard/orders/orders-api';

export const eventDateLabel = (value: string) =>
	new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { dateStyle: 'long' });

/** Order detail: customer, payments, invitation data (stage) and referrals in one place. */
export default function OrderCustomerDetail({
	order,
	onChanged,
}: {
	order: SalesOrder;
	onChanged: () => void;
}) {
	const [customer, setCustomer] = useState<Customer | null>(null);
	const [amounts, setAmounts] = useState<Record<string, string>>({});
	const [marking, setMarking] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const depositKey = useRef('');
	useEffect(() => {
		let active = true;
		getData<Customer>(`${API}/customers?id=${encodeURIComponent(order.customerId)}`)
			.then((found) => active && setCustomer(found))
			.catch(() => active && setError('No se pudo cargar el cliente.'));
		return () => {
			active = false;
		};
	}, [order.customerId]);
	async function markDepositPaid(orderId: string) {
		const value = Number(amounts[orderId] ?? order.depositAmount ?? '');
		if (!(value > 0)) return setError('El anticipo debe ser mayor a cero.');
		depositKey.current ||= crypto.randomUUID();
		setMarking(true);
		setError('');
		try {
			await postData(`${API}/orders/${orderId}/deposit-paid`, {
				amountPaid: value,
				idempotencyKey: depositKey.current,
			});
			depositKey.current = '';
			setMessage('Anticipo registrado.');
			onChanged();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : 'No se pudo guardar.');
		} finally {
			setMarking(false);
		}
	}
	return (
		<section
			className="orders-workspace__detail"
			aria-label={`Detalle de ${order.orderNumber}`}
		>
			{customer && (
				<p>
					Cliente: {customer.displayName}
					{customer.phoneE164 ? ` · ${customer.phoneE164}` : ''}
					{customer.email ? ` · ${customer.email}` : ''}
				</p>
			)}
			{order.eventDate && <p>Fecha del evento: {eventDateLabel(order.eventDate)}</p>}
			{error && <p role="alert">{error}</p>}
			{message && <p role="status">{message}</p>}
			<CustomerOrdersBox
				customerOrders={[{ ...order, eventType: order.eventType ?? '' }]}
				depositAmounts={amounts}
				onAmountChange={(id, value) =>
					setAmounts((current) => ({ ...current, [id]: value }))
				}
				markingDepositPaid={{ [order.id]: marking }}
				onMarkDepositPaid={(id) => void markDepositPaid(id)}
			/>
			{customer && (
				<CustomerReferralPanel
					customer={customer}
					onSuccess={setMessage}
					onError={setError}
				/>
			)}
		</section>
	);
}
