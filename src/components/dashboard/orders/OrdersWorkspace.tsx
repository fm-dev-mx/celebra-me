import { useEffect, useRef, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { SalesOrder } from '@/lib/commercial/orders.repository';
import type { Customer, LeadCandidate } from '@/components/dashboard/commercial/LeadCandidatesList';
import InvitationDataPanel from '@/components/dashboard/commercial/InvitationDataPanel';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';
import {
	PACKAGE_CATALOG,
	getActiveCampaign,
	getPackagePrice,
	type PromoPackageId,
} from '@/data/promo-campaign.data';
import {
	EVENT_TYPE_LABELS,
	labelCommercialEventType,
} from '@/lib/tracking/commercial-presentation';

import { getOrderPaymentStatus } from '@/lib/commercial/order-payment-status';

interface OrderPage {
	items: SalesOrder[];
	nextOffset: number | null;
}

const API = '/api/dashboard/commercial';
const money = (value: number) =>
	new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const statusLabel = (order: SalesOrder) =>
	({ quoted: 'Cotizado', partial: 'Pagado parcial', paid: 'Pagado', lost: 'Perdido' })[
		getOrderPaymentStatus(order)
	];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });

async function getData<T>(path: string): Promise<T> {
	const result = await dashboardApi.get<{ data: T }>(path);
	if (!result.ok) throw new Error(result.message || 'No se pudo cargar la información.');
	return result.data.data;
}
async function postData<T>(path: string, body: unknown): Promise<T> {
	const result = await dashboardApi.post<{ data: T }>(path, body);
	if (!result.ok) throw new Error(result.message || 'No se pudo guardar. Intente de nuevo.');
	return result.data.data;
}

export default function OrdersWorkspace() {
	const [step, setStep] = useState(1);
	const [ready, setReady] = useState(false);
	useEffect(() => setReady(true), []);
	const [customer, setCustomer] = useState<Customer | null>(null);
	const [lead, setLead] = useState<LeadCandidate | null>(null);
	const [search, setSearch] = useState('');
	const [matches, setMatches] = useState<Customer[]>([]);
	const [leads, setLeads] = useState<LeadCandidate[]>([]);
	const [searched, setSearched] = useState(false);
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [eventType, setEventType] = useState('xv');
	const [packageId, setPackageId] = useState<PromoPackageId>('esencial');
	const [total, setTotal] = useState(() =>
		String(getPackagePrice('esencial', getActiveCampaign())),
	);
	const [amount, setAmount] = useState('');
	const [date, setDate] = useState(today);
	const [order, setOrder] = useState<SalesOrder | null>(null);
	const [paidOrder, setPaidOrder] = useState<SalesOrder | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [orders, setOrders] = useState<SalesOrder[]>([]);
	const [filter, setFilter] = useState('');
	const [listError, setListError] = useState('');
	const [loading, setLoading] = useState(false);
	const [nextOffset, setNextOffset] = useState<number | null>(null);
	const [refresh, setRefresh] = useState(0);
	const keys = useRef({ order: '', payment: '' });
	const paymentAttempt = useRef<{ amountPaid: number; paidAt: string } | null>(null);
	const orderAttempt = useRef<Record<string, unknown> | null>(null);
	const listGeneration = useRef(0);
	const heading = useRef<HTMLHeadingElement>(null);
	const orderLocked = busy || Boolean(orderAttempt.current);
	const paymentLocked = busy || Boolean(paymentAttempt.current);

	useEffect(() => {
		heading.current?.focus();
	}, [step, paidOrder]);
	useEffect(() => {
		const generation = ++listGeneration.current;
		setOrders([]);
		setNextOffset(null);
		setLoading(true);
		setListError('');
		getData<OrderPage>(`${API}/orders?view=orders&status=${filter}`)
			.then((rows) => {
				if (listGeneration.current !== generation) return;
				setOrders(rows.items);
				setNextOffset(rows.nextOffset);
			})
			.catch(() => {
				if (listGeneration.current === generation)
					setListError('No se pudieron cargar los pedidos.');
			})
			.finally(() => {
				if (listGeneration.current === generation) setLoading(false);
			});
		return () => {
			listGeneration.current++;
		};
	}, [filter, refresh]);

	async function run(action: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setError('');
		try {
			await action();
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: 'No se pudo guardar. Intente de nuevo.',
			);
		} finally {
			setBusy(false);
		}
	}
	function chooseCustomer(value: Customer) {
		setCustomer(value);
		setStep(2);
	}
	async function searchCustomer() {
		setSearched(false);
		setMatches([]);
		setLeads([]);
		setLead(null);
		const value = search.trim();
		if (/^CM-/i.test(value)) {
			const found = await getData<{ byLeadCode?: LeadCandidate | null }>(
				`${API}/reconciliation?leadCode=${encodeURIComponent(value)}`,
			);
			if (found.byLeadCode) setLeads([found.byLeadCode]);
		} else {
			const key = value.includes('@') ? 'email' : 'phone';
			const query = `${key}=${encodeURIComponent(value)}`;
			const [customers, candidates] = await Promise.all([
				getData<Customer[]>(`${API}/customers?${query}`),
				getData<{ byPhone: LeadCandidate[]; byEmail: LeadCandidate[] }>(
					`${API}/reconciliation?${query}`,
				),
			]);
			setMatches(customers);
			const unique = new Map(
				[...candidates.byPhone, ...candidates.byEmail].map((item) => [item.id, item]),
			);
			setLeads(
				[...unique.values()].filter(
					(item) => !customers.some((customer) => customer.id === item.customerId),
				),
			);
		}
		setSearched(true);
	}
	async function selectLead(value: LeadCandidate) {
		setLead(value);
		if (value.customerId)
			chooseCustomer(
				await getData<Customer>(
					`${API}/customers?id=${encodeURIComponent(value.customerId)}`,
				),
			);
		else {
			setName(value.name ?? '');
			setPhone(value.phoneE164 ?? value.phone ?? '');
		}
	}
	async function createCustomer() {
		if (!normalizeCommercialPhone(phone))
			throw new Error(
				'Revise el teléfono: incluya 10 dígitos y, si corresponde, el código de país.',
			);
		const result = await postData<{
			outcome: 'created' | 'matched' | 'conflict';
			customer?: Customer;
			matches?: Customer[];
		}>(`${API}/customers`, { displayName: name.trim(), phone, createdFromLeadId: lead?.id });
		if (result.outcome === 'conflict' || !result.customer) {
			setMatches(result.matches ?? []);
			throw new Error('Seleccione el cliente correcto entre las coincidencias.');
		}
		chooseCustomer(result.customer);
	}
	async function createOrder() {
		if (!customer) return;
		keys.current.order ||= crypto.randomUUID();
		orderAttempt.current ||= {
			customerId: customer.id,
			leadId: lead?.id,
			eventType,
			packageId,
			packageName: PACKAGE_CATALOG.find((pkg) => pkg.id === packageId)?.name,
			totalAmount: Number(total),
			status: 'quoted',
			idempotencyKey: keys.current.order,
		};
		const created = await postData<SalesOrder>(`${API}/orders`, orderAttempt.current);
		setOrder(created);
		setAmount(String(created.totalAmount));
		setStep(3);
		setRefresh((value) => value + 1);
	}
	async function recordPayment() {
		if (!order) return;
		if (!(Number(amount) > 0 && Number(amount) <= order.totalAmount))
			throw new Error('El pago debe ser mayor a cero y no superar el total.');
		keys.current.payment ||= crypto.randomUUID();
		// Keep the exact request on an uncertain response so retrying cannot record a different payment.
		paymentAttempt.current ||= {
			amountPaid: Number(amount),
			paidAt: new Date(`${date}T12:00:00-07:00`).toISOString(),
		};
		const result = await postData<{ order: SalesOrder }>(
			`${API}/orders/${order.id}/deposit-paid`,
			{ ...paymentAttempt.current, idempotencyKey: keys.current.payment },
		);
		setPaidOrder(result.order);
		setRefresh((value) => value + 1);
	}
	function startNew() {
		setTotal(String(getPackagePrice(packageId, getActiveCampaign())));
		setDate(today());
		setCustomer(null);
		setLead(null);
		setOrder(null);
		setPaidOrder(null);
		setName('');
		setPhone('');
		setSearch('');
		setMatches([]);
		setLeads([]);
		setSearched(false);
		setError('');
		setStep(1);
		keys.current = { order: '', payment: '' };
		paymentAttempt.current = null;
		orderAttempt.current = null;
	}
	async function loadMore() {
		const generation = listGeneration.current;
		setLoading(true);
		setListError('');
		try {
			const rows = await getData<OrderPage>(
				`${API}/orders?view=orders&status=${filter}&offset=${nextOffset}`,
			);
			if (generation !== listGeneration.current) return;
			setOrders((current) => [...current, ...rows.items]);
			setNextOffset(rows.nextOffset);
		} catch {
			if (generation === listGeneration.current)
				setListError('No se pudieron cargar los pedidos.');
		} finally {
			if (generation === listGeneration.current) setLoading(false);
		}
	}

	async function resumePayment(item: SalesOrder) {
		const owner = await getData<Customer>(
			`${API}/customers?id=${encodeURIComponent(item.customerId)}`,
		);
		setCustomer(owner);
		setOrder(item);
		setPaidOrder(null);
		setAmount(String(item.totalAmount));
		setDate(today());
		keys.current.payment = '';
		paymentAttempt.current = null;
		setStep(3);
		heading.current?.focus();
	}
	return (
		<fieldset className="orders-workspace" aria-label="Pedidos" disabled={!ready}>
			<section className="dashboard-card orders-workspace__form" aria-labelledby="order-step">
				<p>1. Cliente · 2. Pedido · 3. Pago</p>
				<h2 id="order-step" ref={heading} tabIndex={-1}>
					{paidOrder
						? 'Pago registrado'
						: `Paso ${step}: ${['Cliente', 'Pedido', 'Pago por transferencia'][step - 1]}`}
				</h2>
				{error && (
					<p role="alert" className="dashboard-error">
						{error.replace(/anticipo/gi, 'pago')}
					</p>
				)}
				{paidOrder ? (
					<>
						<p>
							{paidOrder.orderNumber} · {statusLabel(paidOrder)} · Saldo pendiente:{' '}
							{money(Math.max(0, paidOrder.totalAmount - paidOrder.amountPaid))}
						</p>
						<h3>Datos de su invitación</h3>
						<InvitationDataPanel key={paidOrder.id} orderId={paidOrder.id} autoIssue />
						<button className="btn-secondary" type="button" onClick={startNew}>
							Crear otro pedido
						</button>
					</>
				) : (
					<>
						{step === 1 && (
							<>
								<form
									onSubmit={(event) => {
										event.preventDefault();
										void run(searchCustomer);
									}}
								>
									<label htmlFor="order-search">
										Teléfono, correo o código CM-
									</label>
									<input
										id="order-search"
										required
										maxLength={160}
										value={search}
										onChange={(event) => setSearch(event.target.value)}
									/>
									<button type="submit" className="btn-secondary" disabled={busy}>
										Buscar cliente
									</button>
								</form>
								{matches.map((item) => (
									<button
										type="button"
										className="btn-secondary"
										key={item.id}
										disabled={busy}
										onClick={() => {
											setLead(null);
											chooseCustomer(item);
										}}
									>
										{item.displayName} · {item.phoneE164 || item.email}
									</button>
								))}
								{leads.map((item) => (
									<button
										type="button"
										className="btn-secondary"
										key={item.id}
										disabled={busy}
										onClick={() => void run(() => selectLead(item))}
									>
										{item.leadCode} · {item.name || 'Cliente'}
									</button>
								))}
								{searched && !matches.length && !leads.length && (
									<p role="status">Sin coincidencias. Puede crear un cliente.</p>
								)}
								<form
									onSubmit={(event) => {
										event.preventDefault();
										void run(createCustomer);
									}}
								>
									<h3>Cliente nuevo</h3>
									<label htmlFor="order-name">Nombre</label>
									<input
										id="order-name"
										autoComplete="name"
										required
										maxLength={160}
										value={name}
										onChange={(event) => setName(event.target.value)}
									/>
									<label htmlFor="order-phone">Teléfono</label>
									<input
										id="order-phone"
										type="tel"
										autoComplete="tel"
										required
										maxLength={60}
										value={phone}
										onChange={(event) => setPhone(event.target.value)}
									/>
									<button
										type="submit"
										className="btn-primary"
										disabled={busy || !name.trim()}
									>
										Crear cliente y continuar
									</button>
								</form>
							</>
						)}
						{step === 2 && (
							<form
								onSubmit={(event) => {
									event.preventDefault();
									void run(createOrder);
								}}
							>
								<p>Cliente: {customer?.displayName}</p>
								<label htmlFor="order-event">Tipo de evento</label>
								<select
									disabled={orderLocked}
									id="order-event"
									value={eventType}
									onChange={(event) => setEventType(event.target.value)}
								>
									{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
								<label htmlFor="order-package">Paquete</label>
								<select
									disabled={orderLocked}
									id="order-package"
									value={packageId}
									onChange={(event) => {
										const id = event.target.value as PromoPackageId;
										setPackageId(id);
										setTotal(String(getPackagePrice(id, getActiveCampaign())));
										keys.current.order = '';
									}}
								>
									{PACKAGE_CATALOG.map((pkg) => (
										<option key={pkg.id} value={pkg.id}>
											{pkg.name}
										</option>
									))}
								</select>
								<label htmlFor="order-total">Total (MXN)</label>
								<input
									disabled={orderLocked}
									id="order-total"
									type="number"
									min="0.01"
									step="0.01"
									required
									value={total}
									onChange={(event) => setTotal(event.target.value)}
								/>
								<p>
									Precio vigente del catálogo o promoción. Revise el total antes
									de continuar.
								</p>
								<div className="dashboard-actions">
									<button
										className="btn-secondary"
										type="button"
										disabled={orderLocked}
										onClick={() => setStep(1)}
									>
										Volver
									</button>
									<button type="submit" className="btn-primary" disabled={busy}>
										Crear pedido y continuar
									</button>
								</div>
							</form>
						)}
						{step === 3 && order && (
							<form
								onSubmit={(event) => {
									event.preventDefault();
									void run(recordPayment);
								}}
							>
								<p>
									{customer?.displayName} · {order.orderNumber} · Total:{' '}
									{money(order.totalAmount)}
								</p>
								<p>
									Registre la transferencia que ya recibió. Puede ser el pago
									completo o parcial.
								</p>
								<label htmlFor="order-payment">Monto recibido (MXN)</label>
								<input
									id="order-payment"
									type="number"
									min="0.01"
									step="0.01"
									max={order.totalAmount}
									required
									disabled={paymentLocked}
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
								/>
								<label htmlFor="order-date">Fecha del pago</label>
								<input
									id="order-date"
									type="date"
									required
									max={today()}
									disabled={paymentLocked}
									value={date}
									onChange={(event) => setDate(event.target.value)}
								/>
								<button type="submit" className="btn-primary" disabled={busy}>
									{busy ? 'Guardando…' : 'Guardar pago por transferencia'}
								</button>
							</form>
						)}
					</>
				)}
			</section>
			<OrdersList
				orders={orders}
				filter={filter}
				setFilter={setFilter}
				listError={listError}
				loading={loading}
				nextOffset={nextOffset}
				busy={busy}
				onRetry={() => setRefresh((value) => value + 1)}
				onMore={() => void loadMore()}
				onPayment={(item) => void run(() => resumePayment(item))}
			/>
		</fieldset>
	);
}

function OrdersList({
	orders,
	filter,
	setFilter,
	listError,
	loading,
	nextOffset,
	busy,
	onRetry,
	onMore,
	onPayment,
}: {
	orders: SalesOrder[];
	filter: string;
	setFilter: (value: string) => void;
	listError: string;
	loading: boolean;
	nextOffset: number | null;
	busy: boolean;
	onRetry: () => void;
	onMore: () => void;
	onPayment: (order: SalesOrder) => void;
}) {
	return (
		<section className="orders-workspace__list" aria-labelledby="orders-list-title">
			<h2 id="orders-list-title">Lista de pedidos</h2>
			<label htmlFor="orders-filter">Estado del pedido</label>
			<select
				id="orders-filter"
				value={filter}
				onChange={(event) => setFilter(event.target.value)}
			>
				<option value="">Todos</option>
				<option value="quoted">Cotizado</option>
				<option value="partial">Pagado parcial</option>
				<option value="paid">Pagado</option>
				<option value="lost">Perdido</option>
			</select>
			{listError && (
				<p role="alert">
					{listError}{' '}
					<button className="btn-secondary" type="button" onClick={onRetry}>
						Reintentar
					</button>
				</p>
			)}
			{loading && <p role="status">Cargando pedidos…</p>}
			{!loading && !listError && !orders.length && (
				<p>
					{nextOffset === null
						? 'No hay pedidos para este filtro.'
						: 'Sin coincidencias en esta página. Cargue más pedidos para continuar.'}
				</p>
			)}
			{orders.map((item) => (
				<article className="orders-workspace__row" key={item.id}>
					<h3>{item.orderNumber}</h3>
					<p>
						{labelCommercialEventType(item.eventType ?? '')} · {item.packageName} ·{' '}
						{statusLabel(item)}
					</p>
					<p>
						Total: {money(item.totalAmount)} · Pagado: {money(item.amountPaid)}
					</p>
					<strong>
						Saldo pendiente: {money(Math.max(0, item.totalAmount - item.amountPaid))}
					</strong>
					{item.totalAmount < item.amountPaid && (
						<p role="alert">Montos por conciliar.</p>
					)}
					{['quoted', 'confirmed'].includes(item.status) && !item.amountPaid && (
						<button
							className="btn-secondary"
							type="button"
							disabled={busy}
							onClick={() => onPayment(item)}
						>
							Registrar pago
						</button>
					)}
				</article>
			))}
			{nextOffset !== null && (
				<button className="btn-secondary" type="button" disabled={loading} onClick={onMore}>
					Cargar más pedidos
				</button>
			)}
		</section>
	);
}
