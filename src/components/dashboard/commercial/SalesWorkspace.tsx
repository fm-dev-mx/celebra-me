import React, { useEffect, useRef, useState } from 'react';

import CrmTimeline from '@/components/dashboard/commercial/CrmTimeline';
import CustomerOrdersBox, {
	type SalesOrder,
} from '@/components/dashboard/commercial/CustomerOrdersBox';
import {
	LeadCandidatesList,
	buildSyntheticCustomer,
	type Customer,
	type LeadCandidate,
} from '@/components/dashboard/commercial/LeadCandidatesList';
import type { ConversionEvent } from '@/components/dashboard/commercial/OutboxLogList';
import {
	CustomerCommercialSummary,
	EmptyCommercialDetail,
	ProspectCommercialDetail,
} from '@/components/dashboard/commercial/SalesWorkspaceDetails';
import type { CrmTimelineEntry } from '@/lib/commercial/crm-timeline.service';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { labelLeadChannel, labelLeadStatus } from '@/lib/tracking/commercial-dashboard';
import {
	labelCommercialEventType,
	EVENT_TYPE_LABELS,
} from '@/lib/tracking/commercial-presentation';

interface ReconciliationResult {
	byLeadCode?: LeadCandidate | null;
	byPhone: LeadCandidate[];
	byEmail: LeadCandidate[];
	recentContext: LeadCandidate[];
}

interface SalesWorkspaceProps {
	initialLeads: LeadCandidate[];
}

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
	value,
	label,
}));

function getSuggestedAction(lead: LeadCandidate): string {
	if (!lead.customerId) return 'Vincular o crear cliente';
	if (lead.status === 'new') return 'Contactar y calificar';
	if (lead.status === 'contacted') return 'Preparar cotización';
	if (lead.status === 'quoted') return 'Dar seguimiento a cotización';
	return 'Revisar historial comercial';
}

function getCustomerSuggestedAction(orders: SalesOrder[]): string {
	if (orders.length === 0) return 'Crear la primera orden';
	if (orders.some((order) => order.status === 'quoted' || order.status === 'confirmed')) {
		return 'Registrar anticipo o actualizar la cotización';
	}
	if (orders.some((order) => order.totalAmount > order.amountPaid)) {
		return 'Dar seguimiento al saldo pendiente';
	}
	return 'Revisar la actividad comercial';
}

const SalesWorkspace: React.FC<SalesWorkspaceProps> = ({ initialLeads }) => {
	const [searchLeadCode, setSearchLeadCode] = useState('');
	const [searchPhone, setSearchPhone] = useState('');
	const [searchEmail, setSearchEmail] = useState('');
	const [searching, setSearching] = useState(false);
	const [candidates, setCandidates] = useState<ReconciliationResult | null>(null);
	const [selectedLead, setSelectedLead] = useState<LeadCandidate | null>(null);
	const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
	const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);
	const [custName, setCustName] = useState('');
	const [custEmail, setCustEmail] = useState('');
	const [custPhone, setCustPhone] = useState('');
	const [creatingCustomer, setCreatingCustomer] = useState(false);
	const [customerToolOpen, setCustomerToolOpen] = useState(false);
	const [orderToolOpen, setOrderToolOpen] = useState(false);
	const [orderEventType, setOrderEventType] = useState('xv');
	const [orderPackageName, setOrderPackageName] = useState('');
	const [orderTotalAmount, setOrderTotalAmount] = useState('');
	const [orderDepositAmount, setOrderDepositAmount] = useState('');
	const [creatingOrder, setCreatingOrder] = useState(false);
	const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
	const [markingDepositPaid, setMarkingDepositPaid] = useState<Record<string, boolean>>({});
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [customerLookupError, setCustomerLookupError] = useState('');
	const [timelineEntries, setTimelineEntries] = useState<CrmTimelineEntry[]>([]);
	const [loadingTimeline, setLoadingTimeline] = useState(false);
	const [loadingOrders, setLoadingOrders] = useState(false);
	const [ordersError, setOrdersError] = useState('');
	const [orderIdempotencyKey, setOrderIdempotencyKey] = useState(() => crypto.randomUUID());
	const [depositIdempotencyKeys, setDepositIdempotencyKeys] = useState<Record<string, string>>(
		{},
	);
	const customerToolRef = useRef<HTMLDetailsElement>(null);
	const orderToolRef = useRef<HTMLDetailsElement>(null);
	const feedbackRef = useRef<HTMLDivElement>(null);
	const pollGenerationRef = useRef(0);

	useEffect(() => {
		if (!customerToolOpen) return;
		customerToolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		customerToolRef.current?.querySelector<HTMLInputElement>('input')?.focus();
	}, [customerToolOpen]);

	useEffect(() => {
		if (!orderToolOpen) return;
		orderToolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		orderToolRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
	}, [orderToolOpen]);

	useEffect(() => {
		if (!errorMessage && !successMessage) return;
		feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}, [errorMessage, successMessage]);

	// Cleanup polling on unmount
	useEffect(() => {
		return () => {
			pollGenerationRef.current = -1;
		};
	}, []);

	const fetchCustomerOrders = async (customerId: string) => {
		setLoadingOrders(true);
		setOrdersError('');
		try {
			const response = await dashboardApi.get<{ data: SalesOrder[] }>(
				`/api/dashboard/commercial/orders?customerId=${encodeURIComponent(customerId)}`,
			);
			if (response.ok) setCustomerOrders(response.data.data);
			else {
				setCustomerOrders([]);
				setOrdersError(response.message || 'No se pudieron cargar las órdenes.');
			}
		} catch (error) {
			console.error('Error fetching orders:', error);
			setCustomerOrders([]);
			setOrdersError('No se pudieron cargar las órdenes. Intenta de nuevo.');
		} finally {
			setLoadingOrders(false);
		}
	};

	const fetchTimeline = async (customerId: string) => {
		setLoadingTimeline(true);
		try {
			const response = await dashboardApi.get<{ data: CrmTimelineEntry[] }>(
				`/api/dashboard/commercial/timeline?customerId=${encodeURIComponent(customerId)}`,
			);
			setTimelineEntries(response.ok ? response.data.data : []);
		} catch (error) {
			console.error('Error fetching timeline:', error);
			setTimelineEntries([]);
		} finally {
			setLoadingTimeline(false);
		}
	};

	const fetchRealCustomer = async (customerId: string) => {
		try {
			const response = await dashboardApi.get<{ data: Customer }>(
				`/api/dashboard/commercial/customers?id=${encodeURIComponent(customerId)}`,
			);
			if (response.ok) {
				setActiveCustomer(response.data.data);
				setCustomerLookupError('');
			} else {
				// Clear the synthetic customer — do not display lead data as authoritative
				setActiveCustomer(null);
				setCustomerLookupError(
					'No se pudo cargar la ficha del cliente. Los datos mostrados pueden estar incompletos.',
				);
			}
		} catch {
			setActiveCustomer(null);
			setCustomerLookupError(
				'No se pudo cargar la ficha del cliente. Los datos mostrados pueden estar incompletos.',
			);
		}
	};

	const pollConversionStatus = async (
		conversionEventId: string,
		formatConversion: (status: string) => string,
	) => {
		const generation = pollGenerationRef.current;
		const maxAttempts = 5;
		const intervalMs = 1000;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
			// Abort if unmounted or a newer poll started
			if (pollGenerationRef.current !== generation) return;
			try {
				const response = await dashboardApi.get<{
					data: { status: string };
				}>(
					`/api/dashboard/commercial/meta-conversions/status?id=${encodeURIComponent(conversionEventId)}`,
				);
				// Re-check after await
				if (pollGenerationRef.current !== generation) return;
				if (response.ok) {
					const latestStatus = response.data.data.status;
					if (latestStatus !== 'pending') {
						setSuccessMessage(`Anticipo registrado. ${formatConversion(latestStatus)}`);
						return;
					}
				}
			} catch {
				// Silently continue polling on transient network errors.
			}
		}
		// All attempts exhausted — keep the original pending message.
	};

	const handleSelectCustomer = (customer: Customer, associatedLead?: LeadCandidate) => {
		setActiveCustomer(customer);
		setCustomerOrders([]);
		setTimelineEntries([]);
		setOrderToolOpen(false);
		setErrorMessage('');
		setSuccessMessage('');
		setCustomerLookupError('');
		if (associatedLead) setSelectedLead(associatedLead);
		void fetchCustomerOrders(customer.id);
		void fetchTimeline(customer.id);
		// When the customer was constructed from lead data, fetch the real
		// record so the workspace shows authoritative email / phone values.
		void fetchRealCustomer(customer.id);
	};

	const handleReconcileLead = (lead: LeadCandidate) => {
		setActiveCustomer(null);
		setSelectedLead(lead);
		setCustName(lead.name || '');
		setCustEmail(lead.email || '');
		setCustPhone(lead.phone || '');
		setCustomerToolOpen(true);
	};

	const handleQueueSelect = (lead: LeadCandidate) => {
		setSelectedLead(lead);
		setErrorMessage('');
		setSuccessMessage('');
		if (lead.customerId) {
			handleSelectCustomer(
				buildSyntheticCustomer(lead),
				lead,
			);
		} else {
			handleReconcileLead(lead);
		}
	};

	const handleSearch: React.SubmitEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault();
		const queryParts: string[] = [];
		if (searchLeadCode.trim())
			queryParts.push(`leadCode=${encodeURIComponent(searchLeadCode.trim())}`);
		if (searchPhone.trim()) queryParts.push(`phone=${encodeURIComponent(searchPhone.trim())}`);
		if (searchEmail.trim()) queryParts.push(`email=${encodeURIComponent(searchEmail.trim())}`);
		if (queryParts.length === 0) {
			setErrorMessage('Especifica al menos un código, teléfono o correo.');
			return;
		}
		setSearching(true);
		setErrorMessage('');
		setSuccessMessage('');
		setCandidates(null);
		try {
			const response = await dashboardApi.get<{ data: ReconciliationResult }>(
				`/api/dashboard/commercial/reconciliation?${queryParts.join('&')}`,
			);
			if (response.ok) setCandidates(response.data.data);
			else setErrorMessage(response.message || 'Error al buscar prospectos.');
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : 'Error en la conexión al buscar.',
			);
		} finally {
			setSearching(false);
		}
	};

	const handleCreateCustomer: React.SubmitEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault();
		if (!custName.trim()) {
			setErrorMessage('El nombre del cliente es obligatorio.');
			return;
		}
		setCreatingCustomer(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const response = await dashboardApi.post<{
				data:
					| { outcome: 'created' | 'matched'; customer: Customer }
					| { outcome: 'conflict'; matches: Customer[] };
			}>('/api/dashboard/commercial/customers', {
				displayName: custName.trim(),
				email: custEmail.trim() || undefined,
				phone: custPhone.trim() || undefined,
				createdFromLeadId: selectedLead?.id || undefined,
			});
			if (response.ok) {
				const result = response.data.data;
				if (result.outcome === 'conflict') {
					setErrorMessage(
						'La identidad coincide con clientes diferentes. Revisa correo y teléfono antes de continuar.',
					);
					return;
				}
				const customer = result.customer;
				setSuccessMessage(
					result.outcome === 'created'
						? `Cliente "${customer.displayName}" creado con éxito.`
						: `Cliente existente "${customer.displayName}" vinculado con éxito.`,
				);
				handleSelectCustomer(customer, selectedLead || undefined);
				setCustomerToolOpen(false);
				setCustName('');
				setCustEmail('');
				setCustPhone('');
			} else setErrorMessage(response.message || 'Error al crear cliente.');
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : 'Error en la conexión al crear cliente.',
			);
		} finally {
			setCreatingCustomer(false);
		}
	};

	const handleCreateOrder: React.SubmitEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault();
		if (!activeCustomer?.id) {
			setErrorMessage('Selecciona un cliente antes de crear una orden.');
			return;
		}
		const total = Number.parseFloat(orderTotalAmount);
		if (!Number.isFinite(total) || total <= 0) {
			setErrorMessage('El monto total debe ser un número positivo.');
			return;
		}
		const deposit = Number.parseFloat(orderDepositAmount);
		setCreatingOrder(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const response = await dashboardApi.post<{ data: SalesOrder }>(
				'/api/dashboard/commercial/orders',
				{
					customerId: activeCustomer.id,
					leadId: selectedLead?.id || undefined,
					eventType: orderEventType,
					packageName: orderPackageName.trim() || undefined,
					totalAmount: total,
					depositAmount: Number.isFinite(deposit) && deposit >= 0 ? deposit : undefined,
					idempotencyKey: orderIdempotencyKey,
				},
			);
			if (response.ok) {
				setSuccessMessage(
					`Orden "${response.data.data.orderNumber}" registrada con éxito.`,
				);
				void fetchCustomerOrders(activeCustomer.id);
				void fetchTimeline(activeCustomer.id);
				setOrderPackageName('');
				setOrderTotalAmount('');
				setOrderDepositAmount('');
				setOrderIdempotencyKey(crypto.randomUUID());
			} else setErrorMessage(response.message || 'Error al crear la orden.');
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : 'Error de red al crear la orden.',
			);
		} finally {
			setCreatingOrder(false);
		}
	};

	const handleMarkDepositPaid = async (orderId: string) => {
		const order = customerOrders.find((item) => item.id === orderId);
		const rawAmount =
			depositAmounts[orderId] ?? (order?.depositAmount ? String(order.depositAmount) : '');
		const amount = Number.parseFloat(rawAmount);
		if (!Number.isFinite(amount) || amount <= 0) {
			setErrorMessage('El monto del anticipo debe ser mayor a cero.');
			return;
		}
		setMarkingDepositPaid((current) => ({ ...current, [orderId]: true }));
		const idempotencyKey = depositIdempotencyKeys[orderId] ?? crypto.randomUUID();
		if (!depositIdempotencyKeys[orderId]) {
			setDepositIdempotencyKeys((current) => ({ ...current, [orderId]: idempotencyKey }));
		}
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const response = await dashboardApi.post<{
				data: { order: SalesOrder; conversionEvent: ConversionEvent };
			}>(`/api/dashboard/commercial/orders/${orderId}/deposit-paid`, {
				amountPaid: amount,
				idempotencyKey,
			});
			if (response.ok) {
				setDepositIdempotencyKeys((current) => ({
					...current,
					[orderId]: crypto.randomUUID(),
				}));
				const conversionEvent = response.data.data.conversionEvent;
				const formatConversion = (status: string) =>
					status === 'sent'
						? 'Conversión enviada.'
						: status === 'failed' || status === 'skipped' || status === 'ambiguous'
							? 'Conversión requiere atención.'
							: 'Conversión pendiente.';
				setSuccessMessage(`Anticipo registrado. ${formatConversion(conversionEvent.status)}`);
				if (activeCustomer) {
					void fetchCustomerOrders(activeCustomer.id);
					void fetchTimeline(activeCustomer.id);
				}
				// Poll the conversion status for a short bounded period so the UI
				// can truthfully reflect the async delivery outcome.
				if (conversionEvent.status === 'pending' && conversionEvent.id) {
					pollGenerationRef.current += 1;
					void pollConversionStatus(conversionEvent.id, formatConversion);
				}
			} else setErrorMessage(response.message || 'Error al registrar el pago.');
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : 'Error de red al registrar el pago.',
			);
		} finally {
			setMarkingDepositPaid((current) => ({ ...current, [orderId]: false }));
		}
	};

	const commercialTimeline = timelineEntries.filter(
		(entry) => !entry.eventType.startsWith('capi_'),
	);
	const totalPaid = customerOrders.reduce((sum, order) => sum + order.amountPaid, 0);
	const pendingBalance = customerOrders.reduce(
		(sum, order) => sum + Math.max(0, order.totalAmount - order.amountPaid),
		0,
	);

	return (
		<div className="sales-workspace">
			<header className="sales-workspace__intro">
				<div>
					<p className="sales-workspace__eyebrow">CRM comercial</p>
					<h3>Personas y oportunidades que necesitan atención</h3>
					<p>
						Elige un registro para revisar su contexto, dinero pendiente y siguiente
						acción.
					</p>
				</div>
				<span className="sales-workspace__step">
					{initialLeads.length} registros recientes
				</span>
			</header>

			<div ref={feedbackRef}>
				{errorMessage && (
					<div className="dashboard-error" role="alert">
						{errorMessage}
					</div>
				)}
				{customerLookupError && (
					<div className="dashboard-error" role="alert">
						{customerLookupError}
					</div>
				)}
				{successMessage && (
					<div className="dashboard-status sales-success-full" role="status">
						{successMessage}
					</div>
				)}
			</div>

			<div className="sales-workspace-grid">
				<aside className="crm-work-queue" aria-labelledby="crm-queue-title">
					<header className="crm-work-queue__header">
						<div>
							<p className="sales-workspace__eyebrow">Cola de trabajo</p>
							<h4 id="crm-queue-title">Seguimientos recientes</h4>
						</div>
						<span>{initialLeads.length}</span>
					</header>
					<div className="crm-record-list">
						{initialLeads.length === 0 ? (
							<div className="sales-empty-state">
								<strong>No hay leads recientes</strong>
								<p>
									Usa la búsqueda para localizar un cliente o crear una nueva
									ficha.
								</p>
							</div>
						) : (
							initialLeads.map((lead) => (
								<button
									key={lead.id}
									type="button"
									className="crm-record"
									aria-pressed={selectedLead?.id === lead.id}
									onClick={() => handleQueueSelect(lead)}
								>
									<span className="crm-record__topline">
										<span className="crm-record__identity">
											<strong>{lead.name || 'Prospecto sin nombre'}</strong>
											<small>{lead.leadCode}</small>
										</span>
										<small className="crm-record__status">
											{labelLeadStatus(lead.status)}
										</small>
									</span>
									<span className="crm-record__context">
										{lead.eventType
											? labelCommercialEventType(lead.eventType)
											: 'Evento por definir'}
										{lead.packageInterest ? ` · ${lead.packageInterest}` : ''}
									</span>
									<span className="crm-record__contact">
										{lead.phone || lead.email || 'Sin contacto disponible'} ·{' '}
										{labelLeadChannel(lead.channel)}
									</span>
									<span className="crm-record__action">
										Siguiente: {getSuggestedAction(lead)}
									</span>
								</button>
							))
						)}
					</div>

					<details className="crm-supporting-tool">
						<summary>Buscar prospecto o cliente</summary>
						<form
							className="dashboard-form-grid crm-search-form"
							onSubmit={handleSearch}
						>
							<div className="dashboard-form-field">
								<label htmlFor="search-code">Código de lead</label>
								<input
									id="search-code"
									value={searchLeadCode}
									onChange={(event) => setSearchLeadCode(event.target.value)}
									placeholder="CM-ABC123"
								/>
							</div>
							<div className="dashboard-form-field">
								<label htmlFor="search-phone">Teléfono</label>
								<input
									id="search-phone"
									value={searchPhone}
									onChange={(event) => setSearchPhone(event.target.value)}
									placeholder="6141234567"
								/>
							</div>
							<div className="dashboard-form-field">
								<label htmlFor="search-email">Correo</label>
								<input
									id="search-email"
									value={searchEmail}
									type="email"
									onChange={(event) => setSearchEmail(event.target.value)}
									placeholder="cliente@ejemplo.com"
								/>
							</div>
							<div className="dashboard-actions dashboard-actions--full">
								<button type="submit" className="btn-primary" disabled={searching}>
									{searching ? 'Buscando...' : 'Buscar prospecto o cliente'}
								</button>
							</div>
						</form>
					</details>

					<LeadCandidatesList
						candidates={candidates}
						onSelectCustomer={handleSelectCustomer}
						onReconcileLead={handleReconcileLead}
					/>

					<details
						ref={customerToolRef}
						className="crm-supporting-tool"
						id="customer-form-section"
						open={customerToolOpen}
						onToggle={(event) => setCustomerToolOpen(event.currentTarget.open)}
					>
						<summary>Vincular o crear cliente</summary>
						{selectedLead && (
							<div className="linked-lead-badge">
								<span>
									Vinculando a{' '}
									<strong>{selectedLead.name || selectedLead.leadCode}</strong>
								</span>
								<button
									type="button"
									className="btn-text-clear"
									onClick={() => setSelectedLead(null)}
								>
									Desvincular
								</button>
							</div>
						)}
						<form className="dashboard-form-grid" onSubmit={handleCreateCustomer}>
							<div className="dashboard-form-field">
								<label htmlFor="cust-name">Nombre completo *</label>
								<input
									id="cust-name"
									required
									value={custName}
									onChange={(event) => setCustName(event.target.value)}
								/>
							</div>
							<div className="dashboard-form-field">
								<label htmlFor="cust-email">Correo</label>
								<input
									id="cust-email"
									type="email"
									value={custEmail}
									onChange={(event) => setCustEmail(event.target.value)}
								/>
							</div>
							<div className="dashboard-form-field">
								<label htmlFor="cust-phone">Teléfono</label>
								<input
									id="cust-phone"
									value={custPhone}
									onChange={(event) => setCustPhone(event.target.value)}
								/>
							</div>
							<div className="dashboard-actions dashboard-actions--full">
								<button
									type="submit"
									className="btn-primary"
									disabled={creatingCustomer}
								>
									{creatingCustomer ? 'Guardando...' : 'Vincular o crear cliente'}
								</button>
							</div>
						</form>
					</details>
				</aside>

				<section className="crm-detail" aria-live="polite">
					{activeCustomer ? (
						<div>
							<CustomerCommercialSummary
								customer={activeCustomer}
								lead={selectedLead}
								orders={customerOrders}
								totalPaid={totalPaid}
								pendingBalance={pendingBalance}
								suggestedAction={getCustomerSuggestedAction(customerOrders)}
								onClear={() => {
									setActiveCustomer(null);
									setCustomerOrders([]);
									setTimelineEntries([]);
								}}
								onOpenOrderTool={() => setOrderToolOpen(true)}
							/>

							<section
								className="crm-detail__section"
								aria-labelledby="customer-orders-title"
							>
								<div className="crm-detail__section-heading">
									<div>
										<p className="sales-workspace__eyebrow">Dinero y avance</p>
										<h4 id="customer-orders-title">Órdenes y cobros</h4>
									</div>
									<span>
										{customerOrders.length}{' '}
										{customerOrders.length === 1 ? 'orden' : 'órdenes'}
									</span>
								</div>
								{ordersError && (
									<p className="crm-inline-error" role="alert">
										{ordersError}
									</p>
								)}
								{loadingOrders ? (
									<p className="dashboard-form-help" role="status">
										Cargando órdenes...
									</p>
								) : (
									<CustomerOrdersBox
										customerOrders={customerOrders}
										depositAmounts={depositAmounts}
										onAmountChange={(orderId, value) =>
											setDepositAmounts((current) => ({
												...current,
												[orderId]: value,
											}))
										}
										markingDepositPaid={markingDepositPaid}
										onMarkDepositPaid={handleMarkDepositPaid}
									/>
								)}
							</section>

							<details
								ref={orderToolRef}
								className="crm-supporting-tool"
								open={orderToolOpen}
								onToggle={(event) => setOrderToolOpen(event.currentTarget.open)}
							>
								<summary>Crear una nueva orden</summary>
								<form className="dashboard-form-grid" onSubmit={handleCreateOrder}>
									<div className="dashboard-form-field">
										<label htmlFor="order-event">Tipo de evento</label>
										<select
											id="order-event"
											value={orderEventType}
											onChange={(event) =>
												setOrderEventType(event.target.value)
											}
										>
											{EVENT_TYPE_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor="order-package">Paquete</label>
										<input
											id="order-package"
											value={orderPackageName}
											onChange={(event) =>
												setOrderPackageName(event.target.value)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor="order-total">Monto total ($ MXN) *</label>
										<input
											id="order-total"
											type="number"
											required
											min="1"
											value={orderTotalAmount}
											onChange={(event) =>
												setOrderTotalAmount(event.target.value)
											}
										/>
									</div>
									<div className="dashboard-form-field">
										<label htmlFor="order-deposit">
											Anticipo sugerido ($ MXN)
										</label>
										<input
											id="order-deposit"
											type="number"
											min="0"
											value={orderDepositAmount}
											onChange={(event) =>
												setOrderDepositAmount(event.target.value)
											}
										/>
									</div>
									<div className="dashboard-actions dashboard-actions--full">
										<button
											type="submit"
											className="btn-primary"
											disabled={creatingOrder}
										>
											{creatingOrder ? 'Creando orden...' : 'Crear orden'}
										</button>
									</div>
								</form>
							</details>

							<section
								className="crm-detail__section"
								aria-labelledby="customer-activity-title"
							>
								<p className="sales-workspace__eyebrow">Historial</p>
								<h4 id="customer-activity-title">Actividad comercial</h4>
								<CrmTimeline
									entries={commercialTimeline}
									loading={loadingTimeline}
								/>
							</section>
						</div>
					) : selectedLead ? (
						<ProspectCommercialDetail
							lead={selectedLead}
							suggestedAction={getSuggestedAction(selectedLead)}
							onOpenCustomerTool={() => setCustomerToolOpen(true)}
						/>
					) : (
						<EmptyCommercialDetail />
					)}
				</section>
			</div>
		</div>
	);
};
export default SalesWorkspace;
