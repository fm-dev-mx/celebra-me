import { useEffect, useRef, useState } from 'react';
import type { SalesOrder, SalesOrderListItem } from '@/lib/commercial/orders.repository';
import { OrdersAgenda, OrdersStageBoard } from '@/components/dashboard/orders/OrdersFollowUp';
import type { Customer, LeadCandidate } from '@/components/dashboard/commercial/LeadCandidatesList';
import InvitationDataPanel from '@/components/dashboard/commercial/InvitationDataPanel';
import OrderDetailPanel from '@/components/dashboard/orders/OrderDetailPanel';
import OrderCustomerDetail, {
	eventDateLabel,
} from '@/components/dashboard/orders/OrderCustomerDetail';
import {
	API,
	OrdersMutationError,
	getData,
	postData,
} from '@/components/dashboard/orders/orders-api';
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

import {
	EMPTY_ORDER_REFERRAL,
	OrderReferralFields,
	buildOrderReferralPayload,
} from '@/components/dashboard/commercial/ReferralFields';
import { ORDER_STAGE_LABELS, getOrderPaymentStatus } from '@/lib/commercial/order-payment-status';

interface OrderPage {
	items: SalesOrderListItem[];
	nextOffset: number | null;
}

const money = (value: number) =>
	new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const statusLabel = (order: SalesOrder) =>
	({ quoted: 'Cotizado', partial: 'Pagado parcial', paid: 'Pagado', lost: 'Perdido' })[
		getOrderPaymentStatus(order)
	];
interface OrderFilters {
	stage: string;
	eventFrom: string;
	eventTo: string;
	balance: string;
}
const NO_FILTERS: OrderFilters = { stage: '', eventFrom: '', eventTo: '', balance: '' };
const filterQuery = (filters: OrderFilters) =>
	Object.entries(filters)
		.filter(([, value]) => value)
		.map(([key, value]) => `&${key}=${encodeURIComponent(value)}`)
		.join('');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });

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
	const [eventDate, setEventDate] = useState('');
	const [order, setOrder] = useState<SalesOrder | null>(null);
	const [paidOrder, setPaidOrder] = useState<SalesOrder | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [orders, setOrders] = useState<SalesOrderListItem[]>([]);
	const [filters, setFilters] = useState<OrderFilters>(NO_FILTERS);
	const [orderReferral, setOrderReferral] = useState(EMPTY_ORDER_REFERRAL);
	const [listError, setListError] = useState('');
	const [loading, setLoading] = useState(false);
	const [nextOffset, setNextOffset] = useState<number | null>(null);
	const [refresh, setRefresh] = useState(0);
	const keys = useRef({ order: '', payment: '' });
	const paymentAttempt = useRef<{ amountPaid: number; paidAt: string } | null>(null);
	const orderAttempt = useRef<Record<string, unknown> | null>(null);
	const listGeneration = useRef(0);
	const presetLeadId = useRef<string | undefined>(undefined);
	const heading = useRef<HTMLHeadingElement>(null);
	const previousNavigation = useRef({ step, paidOrder });
	const orderLocked = busy || Boolean(orderAttempt.current);
	const paymentLocked = busy || Boolean(paymentAttempt.current);

	useEffect(() => {
		if (
			previousNavigation.current.step === step &&
			previousNavigation.current.paidOrder === paidOrder
		)
			return;
		previousNavigation.current = { step, paidOrder };
		heading.current?.focus();
	}, [step, paidOrder]);
	// Comercial links here with ?cliente=<id>[&lead=<id>] to start «Crear pedido» for that customer.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const customerId = params.get('cliente');
		if (!customerId) return;
		presetLeadId.current = params.get('lead') || undefined;
		getData<Customer>(`${API}/customers?id=${encodeURIComponent(customerId)}`)
			.then((found) => {
				setCustomer(found);
				setStep(2);
			})
			.catch(() => setError('No se pudo cargar el cliente. Búsquelo por teléfono o correo.'));
	}, []);
	useEffect(() => {
		const generation = ++listGeneration.current;
		setOrders([]);
		setNextOffset(null);
		setLoading(true);
		setListError('');
		getData<OrderPage>(`${API}/orders?view=orders${filterQuery(filters)}`)
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
	}, [filters, refresh]);

	async function run(action: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setError('');
		try {
			await action();
		} catch (failure) {
			if (
				failure instanceof OrdersMutationError &&
				failure.status >= 400 &&
				failure.status < 500
			) {
				orderAttempt.current = null;
				paymentAttempt.current = null;
			}
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
		// A customer picked by hand drops the lead preset from the ?lead= link.
		if (value.id !== customer?.id) presetLeadId.current = undefined;
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
		if (orderReferral.isPastSale && !orderReferral.soldAt)
			throw new Error('Indique la fecha real de la venta anterior.');
		keys.current.order ||= crypto.randomUUID();
		orderAttempt.current ||= {
			customerId: customer.id,
			leadId: lead?.id ?? presetLeadId.current,
			eventType,
			packageId,
			packageName: PACKAGE_CATALOG.find((pkg) => pkg.id === packageId)?.name,
			totalAmount: Number(total),
			...buildOrderReferralPayload(orderReferral),
			status: 'quoted',
			eventDate: eventDate || undefined,
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
		presetLeadId.current = undefined;
		setTotal(String(getPackagePrice(packageId, getActiveCampaign())));
		setDate(today());
		setEventDate('');
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
		setOrderReferral(EMPTY_ORDER_REFERRAL);
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
				`${API}/orders?view=orders${filterQuery(filters)}&offset=${nextOffset}`,
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
								<label htmlFor="order-event-date">
									Fecha del evento (opcional)
								</label>
								<input
									disabled={orderLocked}
									id="order-event-date"
									type="date"
									value={eventDate}
									onChange={(event) => setEventDate(event.target.value)}
								/>
								<label htmlFor="order-package">Paquete</label>
								<select
									disabled={orderLocked}
									id="order-package"
									value={packageId}
									onChange={(event) => {
										const id = event.target.value as PromoPackageId;
										setPackageId(id);
										setTotal(String(getPackagePrice(id, getActiveCampaign())));
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
								<OrderReferralFields
									value={orderReferral}
									onChange={setOrderReferral}
									referralCreditMxn={customer?.referralCreditMxn ?? 0}
								/>
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
									{busy ? 'Guardando…' : 'Registrar anticipo'}
								</button>
							</form>
						)}
					</>
				)}
			</section>
			<OrdersList
				orders={orders}
				filters={filters}
				setFilters={setFilters}
				onChanged={() => setRefresh((value) => value + 1)}
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
	filters,
	setFilters,
	onChanged,
	listError,
	loading,
	nextOffset,
	busy,
	onRetry,
	onMore,
	onPayment,
}: {
	orders: SalesOrderListItem[];
	filters: OrderFilters;
	setFilters: (value: OrderFilters) => void;
	onChanged: () => void;
	listError: string;
	loading: boolean;
	nextOffset: number | null;
	busy: boolean;
	onRetry: () => void;
	onMore: () => void;
	onPayment: (order: SalesOrder) => void;
}) {
	const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
	const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
	const [view, setView] = useState<'list' | 'stages' | 'agenda'>('list');
	const views = [
		['list', 'Lista'],
		['stages', 'Por etapa'],
		['agenda', 'Próximos eventos'],
	] as const;
	return (
		<section className="orders-workspace__list" aria-labelledby="orders-list-title">
			<h2 id="orders-list-title">Lista de pedidos</h2>
			<div className="orders-workspace__views" role="group" aria-label="Vista de pedidos">
				{views.map(([value, label]) => (
					<button
						key={value}
						type="button"
						className="btn-secondary"
						aria-pressed={view === value}
						onClick={() => setView(value)}
					>
						{label}
					</button>
				))}
			</div>
			<div className="orders-workspace__filters">
				<label htmlFor="orders-filter">Etapa del pedido</label>
				<select
					id="orders-filter"
					value={filters.stage}
					onChange={(event) => setFilters({ ...filters, stage: event.target.value })}
				>
					<option value="">Todas</option>
					{Object.entries(ORDER_STAGE_LABELS).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
				<label htmlFor="orders-filter-balance">Saldo</label>
				<select
					id="orders-filter-balance"
					value={filters.balance}
					onChange={(event) => setFilters({ ...filters, balance: event.target.value })}
				>
					<option value="">Todos</option>
					<option value="pending">Con saldo pendiente</option>
					<option value="settled">Sin saldo</option>
				</select>
				<label htmlFor="orders-filter-from">Evento desde</label>
				<input
					id="orders-filter-from"
					type="date"
					value={filters.eventFrom}
					onChange={(event) => setFilters({ ...filters, eventFrom: event.target.value })}
				/>
				<label htmlFor="orders-filter-to">Evento hasta</label>
				<input
					id="orders-filter-to"
					type="date"
					value={filters.eventTo}
					onChange={(event) => setFilters({ ...filters, eventTo: event.target.value })}
				/>
			</div>
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
			{view === 'stages' && !loading && <OrdersStageBoard orders={orders} today={today()} />}
			{view === 'agenda' && !loading && <OrdersAgenda orders={orders} today={today()} />}
			{view === 'list' &&
				orders.map((item) => (
					<article className="orders-workspace__row" key={item.id}>
						<h3>{item.orderNumber}</h3>
						<p>
							{labelCommercialEventType(item.eventType ?? '')} · {item.packageName} ·{' '}
							{ORDER_STAGE_LABELS[item.status]} · {statusLabel(item)}
						</p>
						<p>
							Total: {money(item.totalAmount)} · Pagado: {money(item.amountPaid)}
						</p>
						<strong>
							Saldo pendiente:{' '}
							{money(Math.max(0, item.totalAmount - item.amountPaid))}
						</strong>
						{item.totalAmount < item.amountPaid && (
							<p role="alert">Montos por conciliar.</p>
						)}
						{item.eventDate && (
							<p>Fecha del evento: {eventDateLabel(item.eventDate)}</p>
						)}
						<button
							className="btn-secondary"
							type="button"
							aria-expanded={detailOrderId === item.id}
							onClick={() =>
								setDetailOrderId((current) =>
									current === item.id ? null : item.id,
								)
							}
						>
							{detailOrderId === item.id ? 'Ocultar detalle' : 'Ver detalle y pagos'}
						</button>
						{detailOrderId === item.id && (
							<>
								<OrderCustomerDetail order={item} onChanged={onChanged} />
								<OrderDetailPanel orderId={item.id} onChanged={onChanged} />
							</>
						)}
						{['deposit_paid', 'paid'].includes(item.status) && (
							<>
								<button
									className="btn-secondary"
									type="button"
									aria-expanded={expandedOrderId === item.id}
									onClick={() =>
										setExpandedOrderId((current) =>
											current === item.id ? null : item.id,
										)
									}
								>
									{expandedOrderId === item.id
										? 'Ocultar datos de invitación'
										: 'Ver datos de invitación'}
								</button>
								{expandedOrderId === item.id && (
									<InvitationDataPanel orderId={item.id} />
								)}
							</>
						)}
						{['quoted', 'confirmed'].includes(item.status) && !item.amountPaid && (
							<button
								className="btn-secondary"
								type="button"
								disabled={busy}
								onClick={() => onPayment(item)}
							>
								Registrar anticipo
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
