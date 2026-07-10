import React, { useState } from 'react';

import CrmTimeline from '@/components/dashboard/commercial/CrmTimeline';
import CustomerOrdersBox, {
	type SalesOrder,
} from '@/components/dashboard/commercial/CustomerOrdersBox';
import LeadCandidatesList, {
	type Customer,
	type LeadCandidate,
} from '@/components/dashboard/commercial/LeadCandidatesList';
import type { ConversionEvent } from '@/components/dashboard/commercial/OutboxLogList';
import type { CrmTimelineEntry } from '@/lib/commercial/crm-timeline.service';
import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	labelLeadChannel,
	labelLeadStatus,
} from '@/lib/tracking/commercial-dashboard';

interface ReconciliationResult {
	byLeadCode?: LeadCandidate | null;
	byPhone: LeadCandidate[];
	byEmail: LeadCandidate[];
	recentContext: LeadCandidate[];
}

interface SalesWorkspaceProps {
	initialLeads: LeadCandidate[];
}

const EVENT_TYPE_OPTIONS = [
	{ value: 'xv', label: 'XV años' },
	{ value: 'boda', label: 'Boda' },
	{ value: 'bautizo', label: 'Bautizo' },
	{ value: 'cumple', label: 'Cumpleaños' },
	{ value: 'baby-shower', label: 'Baby shower' },
	{ value: 'primera-comunion', label: 'Primera comunión' },
];



function getSuggestedAction(lead: LeadCandidate): string {
	if (!lead.customerId) return 'Crear ficha de cliente';
	if (lead.status === 'new') return 'Contactar y calificar';
	if (lead.status === 'contacted') return 'Preparar cotización';
	if (lead.status === 'quoted') return 'Dar seguimiento a cotización';
	return 'Revisar historial comercial';
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
	const [orderEventType, setOrderEventType] = useState('xv');
	const [orderPackageName, setOrderPackageName] = useState('');
	const [orderTotalAmount, setOrderTotalAmount] = useState('');
	const [orderDepositAmount, setOrderDepositAmount] = useState('');
	const [creatingOrder, setCreatingOrder] = useState(false);
	const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
	const [markingDepositPaid, setMarkingDepositPaid] = useState<Record<string, boolean>>({});
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [timelineEntries, setTimelineEntries] = useState<CrmTimelineEntry[]>([]);
	const [loadingTimeline, setLoadingTimeline] = useState(false);

	const fetchCustomerOrders = async (customerId: string) => {
		try {
			const response = await dashboardApi.get<{ data: SalesOrder[] }>(
				`/api/dashboard/commercial/orders?customerId=${encodeURIComponent(customerId)}`,
			);
			if (response.ok) setCustomerOrders(response.data.data);
		} catch (error) {
			console.error('Error fetching orders:', error);
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

	const handleSelectCustomer = (customer: Customer, associatedLead?: LeadCandidate) => {
		setActiveCustomer(customer);
		setErrorMessage('');
		setSuccessMessage('');
		if (associatedLead) setSelectedLead(associatedLead);
		void fetchCustomerOrders(customer.id);
		void fetchTimeline(customer.id);
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
				{
					id: lead.customerId,
					displayName: lead.name || 'Cliente sin nombre',
					email: lead.email,
					phoneE164: lead.phoneE164,
				},
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
			const response = await dashboardApi.post<{ data: Customer }>(
				'/api/dashboard/commercial/customers',
				{
					displayName: custName.trim(),
					email: custEmail.trim() || undefined,
					phone: custPhone.trim() || undefined,
					createdFromLeadId: selectedLead?.id || undefined,
				},
			);
			if (response.ok) {
				const customer = response.data.data;
				setSuccessMessage(`Cliente "${customer.displayName}" creado con éxito.`);
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
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const response = await dashboardApi.post<{
				data: { order: SalesOrder; conversionEvent: ConversionEvent };
			}>(`/api/dashboard/commercial/orders/${orderId}/deposit-paid`, { amountPaid: amount });
			if (response.ok) {
				setSuccessMessage('Anticipo registrado. La actividad comercial se actualizó.');
				if (activeCustomer) {
					void fetchCustomerOrders(activeCustomer.id);
					void fetchTimeline(activeCustomer.id);
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

			{errorMessage && (
				<div className="dashboard-error" role="alert">
					{errorMessage}
				</div>
			)}
			{successMessage && (
				<div className="dashboard-status sales-success-full" role="status">
					{successMessage}
				</div>
			)}

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
										<strong>{lead.name || 'Prospecto sin nombre'}</strong>
										<small>{labelLeadStatus(lead.status)}</small>
									</span>
									<span className="crm-record__context">
										{lead.eventType || 'Evento por definir'}
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
						<summary>Buscar otro cliente o prospecto</summary>
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
									type="email"
									value={searchEmail}
									onChange={(event) => setSearchEmail(event.target.value)}
									placeholder="cliente@ejemplo.com"
								/>
							</div>
							<div className="dashboard-actions dashboard-actions--full">
								<button type="submit" className="btn-primary" disabled={searching}>
									{searching ? 'Buscando...' : 'Buscar cliente'}
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
						className="crm-supporting-tool"
						id="customer-form-section"
						open={customerToolOpen}
						onToggle={(event) => setCustomerToolOpen(event.currentTarget.open)}
					>
						<summary>Crear o reconciliar cliente</summary>
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
									{creatingCustomer ? 'Guardando...' : 'Crear y guardar cliente'}
								</button>
							</div>
						</form>
					</details>
				</aside>

				<section className="crm-detail" aria-live="polite">
					{activeCustomer ? (
						<div>
							<p className="sales-workspace__eyebrow">Cliente seleccionado</p>
							<div className="customer-details sales-customer-header">
								<div>
									<h3>{activeCustomer.displayName}</h3>
									<p>
										{activeCustomer.email || 'Sin correo registrado'} ·{' '}
										{activeCustomer.phoneE164 || 'Sin teléfono registrado'}
									</p>
								</div>
								<div className="sales-customer-actions">
									{activeCustomer.phoneE164 && (
										<a
											className="btn-secondary"
											href={`https://wa.me/${activeCustomer.phoneE164.replace(/\D/g, '')}`}
											target="_blank"
											rel="noreferrer"
										>
											Abrir WhatsApp
										</a>
									)}
									<button
										type="button"
										className="btn-ghost"
										onClick={() => {
											setActiveCustomer(null);
											setCustomerOrders([]);
											setTimelineEntries([]);
										}}
									>
										Cambiar
									</button>
								</div>
							</div>

							<section
								className="crm-detail__section"
								aria-labelledby="customer-orders-title"
							>
								<div className="crm-detail__section-heading">
									<div>
										<p className="sales-workspace__eyebrow">Dinero y avance</p>
										<h4 id="customer-orders-title">Órdenes y cobros</h4>
									</div>
									<span>{customerOrders.length} órdenes</span>
								</div>
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
							</section>

							<details className="crm-supporting-tool">
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
						<div className="crm-prospect-detail">
							<p className="sales-workspace__eyebrow">Prospecto seleccionado</p>
							<h3>{selectedLead.name || 'Prospecto sin nombre'}</h3>
							<p>
								{selectedLead.phone ||
									selectedLead.email ||
									'Sin contacto disponible'}
							</p>
							<dl>
								<div>
									<dt>Estado</dt>
									<dd>{labelLeadStatus(selectedLead.status)}</dd>
								</div>
								<div>
									<dt>Evento</dt>
									<dd>{selectedLead.eventType || 'Por definir'}</dd>
								</div>
								<div>
									<dt>Canal</dt>
									<dd>{labelLeadChannel(selectedLead.channel)}</dd>
								</div>
							</dl>
							<div className="crm-next-action">
								<span>Siguiente acción</span>
								<strong>{getSuggestedAction(selectedLead)}</strong>
								<button
									type="button"
									className="btn-primary"
									onClick={() => setCustomerToolOpen(true)}
								>
									Crear ficha de cliente
								</button>
							</div>
						</div>
					) : (
						<div className="sales-empty-state sales-empty-state--detail">
							<strong>Selecciona una persona u oportunidad</strong>
							<p>
								Aquí verás su estado, órdenes, saldo, actividad y la acción
								recomendada.
							</p>
						</div>
					)}
				</section>
			</div>
		</div>
	);
};

export default SalesWorkspace;
