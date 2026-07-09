import React, { useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import LeadCandidatesList, { type LeadCandidate, type Customer } from '@/components/dashboard/commercial/LeadCandidatesList';
import CustomerOrdersBox, { type SalesOrder } from '@/components/dashboard/commercial/CustomerOrdersBox';
import OutboxLogList, { type ConversionEvent } from '@/components/dashboard/commercial/OutboxLogList';
import CrmTimeline from '@/components/dashboard/commercial/CrmTimeline';
import type { CrmTimelineEntry } from '@/lib/commercial/crm-timeline.service';

interface SalesWorkspaceProps {
	initialConversions: ConversionEvent[];
}

interface ReconciliationResult {
	byLeadCode?: LeadCandidate | null;
	byPhone: LeadCandidate[];
	byEmail: LeadCandidate[];
	recentContext: LeadCandidate[];
}

interface ProcessResult {
	processed: number;
	failed: number;
	skipped: number;
}

const EVENT_TYPE_OPTIONS = [
	{ value: 'xv', label: 'XV años' },
	{ value: 'boda', label: 'Boda' },
	{ value: 'bautizo', label: 'Bautizo' },
	{ value: 'cumple', label: 'Cumpleaños' },
	{ value: 'baby-shower', label: 'Baby shower' },
	{ value: 'primera-comunion', label: 'Primera comunión' },
];

export const SalesWorkspace: React.FC<SalesWorkspaceProps> = ({ initialConversions }) => {
	// Search states
	const [searchLeadCode, setSearchLeadCode] = useState('');
	const [searchPhone, setSearchPhone] = useState('');
	const [searchEmail, setSearchEmail] = useState('');
	const [searching, setSearching] = useState(false);
	const [candidates, setCandidates] = useState<ReconciliationResult | null>(null);

	// Selection states
	const [selectedLead, setSelectedLead] = useState<LeadCandidate | null>(null);
	const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
	const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);

	// Form states - Create Customer
	const [custName, setCustName] = useState('');
	const [custEmail, setCustEmail] = useState('');
	const [custPhone, setCustPhone] = useState('');
	const [creatingCustomer, setCreatingCustomer] = useState(false);

	// Form states - Create Order
	const [orderEventType, setOrderEventType] = useState('xv');
	const [orderPackageName, setOrderPackageName] = useState('');
	const [orderTotalAmount, setOrderTotalAmount] = useState('');
	const [orderDepositAmount, setOrderDepositAmount] = useState('');
	const [creatingOrder, setCreatingOrder] = useState(false);

	// Form states - Mark Deposit Paid (active order ID -> amount)
	const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
	const [markingDepositPaid, setMarkingDepositPaid] = useState<Record<string, boolean>>({});

	// Outbox & logs
	const [conversions, setConversions] = useState<ConversionEvent[]>(initialConversions);
	const [processingConversions, setProcessingConversions] = useState(false);

	// General feedback
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	// CRM Timeline
	const [timelineEntries, setTimelineEntries] = useState<CrmTimelineEntry[]>([]);
	const [loadingTimeline, setLoadingTimeline] = useState(false);

	// Fetch active customer's orders
	const fetchCustomerOrders = async (customerId: string) => {
		try {
			const res = await dashboardApi.get<{ data: SalesOrder[] }>(
				`/api/dashboard/commercial/orders?customerId=${encodeURIComponent(customerId)}`
			);
			if (res.ok) {
				setCustomerOrders(res.data.data);
			}
		} catch (err) {
			console.error('Error fetching orders:', err);
		}
	};

	// Fetch CRM timeline for a customer
	const fetchTimeline = async (customerId: string) => {
		setLoadingTimeline(true);
		try {
			const res = await dashboardApi.get<{ data: CrmTimelineEntry[] }>(
				`/api/dashboard/commercial/timeline?customerId=${encodeURIComponent(customerId)}`
			);
			if (res.ok) {
				setTimelineEntries(res.data.data);
			}
		} catch (err) {
			console.error('Error fetching timeline:', err);
			setTimelineEntries([]);
		} finally {
			setLoadingTimeline(false);
		}
	};

	// Perform lead/identity lookup
	const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSearching(true);
		setErrorMessage('');
		setSuccessMessage('');
		setCandidates(null);

		const queryParts: string[] = [];
		if (searchLeadCode.trim()) queryParts.push(`leadCode=${encodeURIComponent(searchLeadCode.trim())}`);
		if (searchPhone.trim()) queryParts.push(`phone=${encodeURIComponent(searchPhone.trim())}`);
		if (searchEmail.trim()) queryParts.push(`email=${encodeURIComponent(searchEmail.trim())}`);

		if (queryParts.length === 0) {
			setErrorMessage('Especifica al menos un criterio de búsqueda (código de lead, teléfono o email).');
			setSearching(false);
			return;
		}

		try {
			const res = await dashboardApi.get<{ data: ReconciliationResult }>(
				`/api/dashboard/commercial/reconciliation?${queryParts.join('&')}`
			);
			if (res.ok) {
				setCandidates(res.data.data);
			} else {
				setErrorMessage(res.message || 'Error al buscar prospectos.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error en la conexión al buscar.';
			setErrorMessage(errMsg);
		} finally {
			setSearching(false);
		}
	};

	// Select customer and fetch their orders
	const handleSelectCustomer = (customer: Customer, associatedLead?: LeadCandidate) => {
		setActiveCustomer(customer);
		setErrorMessage('');
		setSuccessMessage('');
		if (associatedLead) {
			setSelectedLead(associatedLead);
		}
		void fetchCustomerOrders(customer.id);
		void fetchTimeline(customer.id);
	};

	// Create a new customer record from a lead (Reconcile)
	const handleCreateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!custName.trim()) {
			setErrorMessage('El nombre del cliente es obligatorio.');
			return;
		}

		setCreatingCustomer(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: Customer }>(
				'/api/dashboard/commercial/customers',
				{
					displayName: custName.trim(),
					email: custEmail.trim() || undefined,
					phone: custPhone.trim() || undefined,
					createdFromLeadId: selectedLead?.id || undefined,
				}
			);

			if (res.ok) {
				const customer: Customer = res.data.data;
				setSuccessMessage(`Cliente "${customer.displayName}" creado y reconciliado con éxito.`);
				handleSelectCustomer(customer);
				setCustName('');
				setCustEmail('');
				setCustPhone('');
			} else {
				setErrorMessage(res.message || 'Error al crear cliente.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error en la conexión al crear cliente.';
			setErrorMessage(errMsg);
		} finally {
			setCreatingCustomer(false);
		}
	};

	// Pre-fill customer form from a candidate lead
	const handleReconcileLead = (lead: LeadCandidate) => {
		setSelectedLead(lead);
		setCustName(lead.name || '');
		setCustEmail(lead.email || '');
		setCustPhone(lead.phone || '');
		document.getElementById('customer-form-section')?.scrollIntoView({ behavior: 'smooth' });
	};

	// Create Sales Order for selected customer
	const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!activeCustomer || !activeCustomer.id) {
			setErrorMessage('Selecciona un cliente válido con un ID registrado antes de crear una orden.');
			return;
		}

		const total = parseFloat(orderTotalAmount);
		if (isNaN(total) || total <= 0) {
			setErrorMessage('El monto total debe ser un número positivo.');
			return;
		}

		setCreatingOrder(true);
		setErrorMessage('');
		setSuccessMessage('');

		const deposit = parseFloat(orderDepositAmount);

		try {
			const res = await dashboardApi.post<{ data: SalesOrder }>(
				'/api/dashboard/commercial/orders',
				{
					customerId: activeCustomer.id,
					leadId: selectedLead?.id || undefined,
					eventType: orderEventType,
					packageName: orderPackageName.trim() || undefined,
					totalAmount: total,
					depositAmount: !isNaN(deposit) && deposit >= 0 ? deposit : undefined,
				}
			);

			if (res.ok) {
				const order: SalesOrder = res.data.data;
				setSuccessMessage(`Orden "${order.orderNumber}" registrada con éxito.`);
				void fetchCustomerOrders(activeCustomer.id);
				void fetchTimeline(activeCustomer.id);
				setOrderPackageName('');
				setOrderTotalAmount('');
				setOrderDepositAmount('');
			} else {
				setErrorMessage(res.message || 'Error al crear la orden.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error de red al crear la orden.';
			setErrorMessage(errMsg);
		} finally {
			setCreatingOrder(false);
		}
	};

	// Transition order to deposit_paid
	const handleMarkDepositPaid = async (orderId: string) => {
		const order = customerOrders.find((o) => o.id === orderId);
		// If the operator hasn't typed in the input, use the order's
		// suggested deposit amount as the default effective value.
		const rawAmount = depositAmounts[orderId] ?? (order?.depositAmount ? String(order.depositAmount) : '');
		const amount = parseFloat(rawAmount);
		if (isNaN(amount) || amount <= 0) {
			setErrorMessage('El monto del anticipo debe ser un número válido mayor a cero.');
			return;
		}

		setMarkingDepositPaid((prev) => ({ ...prev, [orderId]: true }));
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: { order: SalesOrder; conversionEvent: ConversionEvent } }>(
				`/api/dashboard/commercial/orders/${orderId}/deposit-paid`,
				{
					amountPaid: amount,
				}
			);

			if (res.ok) {
				setSuccessMessage(`Orden registrada como pagada (Anticipo). Se encoló conversión CAPI.`);
				if (activeCustomer) {
					void fetchCustomerOrders(activeCustomer.id);
					void fetchTimeline(activeCustomer.id);
				}
				void refreshConversions();
			} else {
				setErrorMessage(res.message || 'Error al registrar el pago.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error de red al registrar el pago.';
			setErrorMessage(errMsg);
		} finally {
			setMarkingDepositPaid((prev) => ({ ...prev, [orderId]: false }));
		}
	};

	// Manually process conversions outbox
	const handleProcessConversions = async () => {
		setProcessingConversions(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: ProcessResult }>(
				'/api/dashboard/commercial/meta-conversions/process'
			);

			if (res.ok) {
				const { processed, failed, skipped } = res.data.data;
				setSuccessMessage(
					`Procesamiento completado. Enviados: ${processed}, Fallidos: ${failed}, Ignorados (skipped): ${skipped}.`
				);
				void refreshConversions();
			} else {
				setErrorMessage(res.message || 'Error al procesar las conversiones.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error de red al procesar conversiones.';
			setErrorMessage(errMsg);
		} finally {
			setProcessingConversions(false);
		}
	};

	// Manually requeue and retry a specific skipped/failed conversion
	const handleRequeueEvent = async (eventId: string) => {
		setProcessingConversions(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const res = await dashboardApi.post<{ data: { eventId: string; status: string } }>(
				'/api/dashboard/commercial/meta-conversions/process',
				{
					action: 'requeue',
					eventId,
				}
			);

			if (res.ok) {
				setSuccessMessage(`Evento ${res.data.data.eventId} reencolado con éxito. Estado: ${res.data.data.status}`);
				void refreshConversions();
			} else {
				setErrorMessage(res.message || 'Error al reencolar el evento.');
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error de red al reencolar el evento.';
			setErrorMessage(errMsg);
		} finally {
			setProcessingConversions(false);
		}
	};

	// Helper to load outbox conversions log
	const refreshConversions = async () => {
		try {
			const res = await dashboardApi.get<{ data: ConversionEvent[] }>(
				'/api/dashboard/commercial/meta-conversions/process'
			);
			if (res.ok) {
				setConversions(res.data.data);
			}
		} catch (err) {
			console.error('Error refreshing conversions outbox:', err);
		}
	};

	const handleDepositAmountChange = (orderId: string, val: string) => {
		setDepositAmounts((prev) => ({ ...prev, [orderId]: val }));
	};

	return (
		<div className="sales-workspace-grid">
			{/* Notifications */}
			{errorMessage && <div className="dashboard-error sales-full-width">{errorMessage}</div>}
			{successMessage && <div className="dashboard-status sales-success-full">{successMessage}</div>}

			{/* Left Column: Search and Forms */}
			<div className="sales-workspace-col">
				{/* 1. Search Box */}
				<div className="dashboard-card">
					<h3>1. Buscar Prospecto o Cliente</h3>
					<form className="dashboard-form-grid" onSubmit={handleSearch}>
						<div className="dashboard-form-field">
							<label htmlFor="search-code">Código de Lead (CM-XXXXXX)</label>
							<input
								id="search-code"
								type="text"
								placeholder="CM-ABC123"
								value={searchLeadCode}
								onChange={(e) => setSearchLeadCode(e.target.value)}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="search-phone">Teléfono (WhatsApp)</label>
							<input
								id="search-phone"
								type="text"
								placeholder="6141234567"
								value={searchPhone}
								onChange={(e) => setSearchPhone(e.target.value)}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="search-email">Email</label>
							<input
								id="search-email"
								type="text"
								placeholder="cliente@ejemplo.com"
								value={searchEmail}
								onChange={(e) => setSearchEmail(e.target.value)}
							/>
						</div>
						<div className="dashboard-actions dashboard-actions--full">
							<button type="submit" className="btn-primary" disabled={searching}>
								{searching ? 'Buscando...' : 'Buscar'}
							</button>
						</div>
					</form>
				</div>

				{/* Search Results / Candidates */}
				<LeadCandidatesList
					candidates={candidates}
					onSelectCustomer={handleSelectCustomer}
					onReconcileLead={handleReconcileLead}
				/>

				{/* 2. Customer Creation / Reconciliation Form */}
				<div className="dashboard-card" id="customer-form-section">
					<h3>2. Crear o Reconciliar Cliente</h3>
					{selectedLead && (
						<div className="linked-lead-badge">
							<span>Vinculando al lead <strong>{selectedLead.leadCode}</strong> ({selectedLead.name || 'Sin nombre'})</span>
							<button type="button" className="btn-text-clear" onClick={() => setSelectedLead(null)}>Desvincular</button>
						</div>
					)}
					<form className="dashboard-form-grid" onSubmit={handleCreateCustomer}>
						<div className="dashboard-form-field">
							<label htmlFor="cust-name">Nombre completo del cliente *</label>
							<input
								id="cust-name"
								type="text"
								required
								placeholder="Nombre del titular"
								value={custName}
								onChange={(e) => setCustName(e.target.value)}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="cust-email">Email</label>
							<input
								id="cust-email"
								type="email"
								placeholder="correo@ejemplo.com"
								value={custEmail}
								onChange={(e) => setCustEmail(e.target.value)}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="cust-phone">Teléfono (WhatsApp)</label>
							<input
								id="cust-phone"
								type="text"
								placeholder="6141234567"
								value={custPhone}
								onChange={(e) => setCustPhone(e.target.value)}
							/>
						</div>
						<div className="dashboard-actions dashboard-actions--full">
							<button type="submit" className="btn-primary" disabled={creatingCustomer}>
								{creatingCustomer ? 'Guardando...' : 'Crear y Guardar Cliente'}
							</button>
						</div>
					</form>
				</div>
			</div>

			{/* Right Column: Active State, Orders, and conversions */}
			<div className="sales-workspace-col">
				{/* 3. Selected Customer & Create Order */}
				<div className="dashboard-card">
					<h3>3. Cliente Seleccionado y Órdenes</h3>
					{activeCustomer ? (
						<div className="active-customer-info">
							<div className="customer-details">
								<p><strong>Titular:</strong> {activeCustomer.displayName}</p>
								<p><strong>Email:</strong> {activeCustomer.email || 'Sin registrar'}</p>
								<p><strong>Teléfono:</strong> {activeCustomer.phoneE164 || 'Sin registrar'}</p>
								<button type="button" className="btn-secondary sales-mt-2" onClick={() => { setActiveCustomer(null); setCustomerOrders([]); }}>
									Cambiar Cliente
								</button>
							</div>

							<hr className="sales-divider" />

							<h4>Nueva Orden para Cliente</h4>
							<form className="dashboard-form-grid" onSubmit={handleCreateOrder}>
								<div className="dashboard-form-field">
									<label htmlFor="order-event">Tipo de evento</label>
									<select
										id="order-event"
										value={orderEventType}
										onChange={(e) => setOrderEventType(e.target.value)}
									>
										{EVENT_TYPE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>{opt.label}</option>
										))}
									</select>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor="order-package">Nombre del paquete</label>
									<input
										id="order-package"
										type="text"
										placeholder="Premium"
										value={orderPackageName}
										onChange={(e) => setOrderPackageName(e.target.value)}
									/>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor="order-total">Monto Total ($ MXN) *</label>
									<input
										id="order-total"
										type="number"
										required
										min="1"
										placeholder="1699"
										value={orderTotalAmount}
										onChange={(e) => setOrderTotalAmount(e.target.value)}
									/>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor="order-deposit">Anticipo Sugerido (opcional, $ MXN)</label>
									<input
										id="order-deposit"
										type="number"
										min="0"
										placeholder="899"
										value={orderDepositAmount}
										onChange={(e) => setOrderDepositAmount(e.target.value)}
									/>
								</div>
								<div className="dashboard-actions dashboard-actions--full">
									<button type="submit" className="btn-primary" disabled={creatingOrder || !activeCustomer?.id}>
										{creatingOrder ? 'Creando Orden...' : 'Crear Orden'}
									</button>
								</div>
							</form>

							<hr className="sales-divider" />

							<h4>Órdenes Existentes</h4>
							<CustomerOrdersBox
								customerOrders={customerOrders}
								depositAmounts={depositAmounts}
								onAmountChange={handleDepositAmountChange}
								markingDepositPaid={markingDepositPaid}
								onMarkDepositPaid={handleMarkDepositPaid}
							/>
						</div>
					) : (
						<p className="dashboard-form-help">Selecciona o crea un cliente para gestionar sus órdenes.</p>
					)}

					{/* CRM Timeline */}
					{activeCustomer && (
						<>
							<hr className="sales-divider" />
							<h4>Línea de Tiempo</h4>
							<CrmTimeline entries={timelineEntries} loading={loadingTimeline} />
						</>
					)}
				</div>

				{/* 4. Meta conversions Outbox Logs */}
				<OutboxLogList
					conversions={conversions}
					processingConversions={processingConversions}
					onProcessConversions={handleProcessConversions}
					onRequeueEvent={handleRequeueEvent}
				/>
			</div>

			{/* CSS styling for layout inside this React island */}
			<style>{`
				.sales-workspace-grid {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 1.5rem;
					align-items: start;
				}
				@media (max-width: 992px) {
					.sales-workspace-grid {
						grid-template-columns: 1fr;
					}
				}
				.sales-workspace-col {
					display: grid;
					gap: 1.5rem;
				}
				.sales-full-width {
					grid-column: span 2;
				}
				.sales-success-full {
					grid-column: span 2;
					border-color: #22c55e !important;
					color: #22c55e !important;
				}
				.sales-divider {
						margin: 1.25rem 0;
						border: 0;
						border-top: 1px solid var(--dashboard-card-border);
					}
					.candidates-list {
						display: grid;
					gap: 1rem;
				}
				.candidate-group {
					border-bottom: 1px solid var(--dashboard-card-border);
					padding-bottom: 1rem;
				}
				.candidate-group:last-child {
					border-bottom: none;
					padding-bottom: 0;
				}
				.candidate-group h4 {
					margin: 0 0 0.5rem;
					font-size: 0.9rem;
					color: var(--color-text-muted);
					text-transform: uppercase;
					letter-spacing: 0.05em;
				}
				.candidate-item {
					background: rgba(255, 255, 255, 0.02);
					border: 1px solid var(--dashboard-card-border);
					padding: 0.75rem;
					border-radius: 0.5rem;
					margin-bottom: 0.5rem;
				}
				.candidate-meta {
					font-size: 0.82rem;
					color: var(--color-text-secondary);
					margin: 0.25rem 0;
				}
				.candidate-actions {
					margin-top: 0.5rem;
					display: flex;
					gap: 0.5rem;
				}
				.candidate-actions button {
					padding: 0.35rem 0.65rem;
					font-size: 0.8rem;
					border-radius: 0.25rem;
				}
				.active-customer-info {
					display: grid;
					gap: 1rem;
				}
				.customer-details p {
					margin: 0.25rem 0;
					color: var(--color-text-secondary);
				}
				.orders-list {
					display: grid;
					gap: 0.75rem;
				}
				.order-item-box {
					border: 1px solid var(--dashboard-card-border);
					border-radius: 0.5rem;
					padding: 0.75rem;
					background: rgba(255, 255, 255, 0.01);
				}
				.order-item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 0.35rem;
				}
				.order-number {
					font-family: monospace;
					font-weight: bold;
					color: var(--color-text-primary);
				}
				.order-desc {
					font-size: 0.82rem;
					color: var(--color-text-secondary);
					margin: 0.25rem 0;
				}
				.order-price {
					font-size: 0.86rem;
					color: var(--color-text-primary);
					margin: 0.25rem 0;
				}
				.order-price-row {
					display: flex;
					gap: 1.25rem;
					flex-wrap: wrap;
					margin: 0.35rem 0;
					font-size: 0.86rem;
					color: var(--color-text-primary);
				}
				.order-amount {
					display: flex;
					gap: 0.35rem;
					align-items: baseline;
				}
				.order-amount-label {
					color: var(--color-text-secondary);
					font-size: 0.82rem;
				}
				.order-balance-due {
					color: #f59e0b;
				}
				.order-balance-zero {
					color: #22c55e;
				}
				.order-meta {
					font-size: 0.78rem;
					color: var(--color-text-secondary);
					margin: 0.2rem 0 0;
				}
				.order-payment-input-wrap {
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: 0.2rem;
				}
				.order-payment-label {
					font-size: 0.78rem;
					color: var(--color-text-secondary);
				}
				.order-payment-trigger {
					display: flex;
					gap: 0.5rem;
					margin-top: 0.75rem;
				}
				.order-payment-trigger input {
					flex: 1;
					padding: 0.35rem;
					background: var(--dashboard-input-bg, rgba(0,0,0,0.2));
					border: 1px solid var(--dashboard-card-border);
					color: var(--color-text-primary);
					border-radius: 0.25rem;
					font-size: 0.86rem;
				}
				.order-payment-trigger button {
					padding: 0.35rem 0.75rem;
					font-size: 0.86rem;
					border-radius: 0.25rem;
				}
				.status-badge-custom {
					padding: 0.15rem 0.45rem;
					border-radius: 0.25rem;
					font-size: 0.75rem;
					text-transform: uppercase;
					font-weight: bold;
				}
				.status-quoted {
					background: #f59e0b;
					color: #fff;
				}
				.status-confirmed {
					background: #3b82f6;
					color: #fff;
				}
				.status-deposit_paid {
					background: #10b981;
					color: #fff;
				}
				.status-paid {
					background: #047857;
					color: #fff;
				}
				.status-pending {
					background: rgba(245, 158, 11, 0.2);
					color: #f59e0b;
					border: 1px solid #f59e0b;
				}
				.status-sending {
					background: rgba(59, 130, 246, 0.2);
					color: #3b82f6;
					border: 1px solid #3b82f6;
				}
				.status-sent {
					background: rgba(16, 185, 129, 0.2);
					color: #10b981;
					border: 1px solid #10b981;
				}
				.status-failed {
					background: rgba(239, 68, 68, 0.2);
					color: #ef4444;
					border: 1px solid #ef4444;
				}
				.status-skipped {
					background: rgba(107, 114, 128, 0.2);
					color: #6b7280;
					border: 1px solid #6b7280;
				}
				.outbox-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 0.5rem;
				}
				.btn-small {
					font-size: 0.8rem;
					padding: 0.25rem 0.5rem;
				}
				.outbox-list {
					max-height: 350px;
					overflow-y: auto;
					display: grid;
					gap: 0.75rem;
				}
				.outbox-item {
					background: rgba(255,255,255,0.01);
					border: 1px solid var(--dashboard-card-border);
					padding: 0.75rem;
					border-radius: 0.5rem;
				}
				.outbox-item-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
				.outbox-item-meta {
					font-size: 0.8rem;
					color: var(--color-text-secondary);
					margin: 0.15rem 0 0;
				}
				.outbox-item-error {
					font-size: 0.8rem;
					color: #ef4444;
					margin: 0.35rem 0 0;
					background: rgba(239, 68, 68, 0.05);
					padding: 0.35rem;
					border-radius: 0.25rem;
				}
				.outbox-item-actions {
					margin-top: 0.5rem;
					display: flex;
					justify-content: flex-end;
				}
				.btn-requeue {
					background: var(--color-action-primary) !important;
					color: #fff !important;
					border: none !important;
				}
				.btn-requeue:hover {
					opacity: 0.9;
				}
			`}</style>
		</div>
	);
};
export default SalesWorkspace;
