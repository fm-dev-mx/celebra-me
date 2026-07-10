import React from 'react';

import type { SalesOrder } from '@/components/dashboard/commercial/CustomerOrdersBox';
import type { Customer, LeadCandidate } from '@/components/dashboard/commercial/LeadCandidatesList';
import { getUsableWhatsAppE164 } from '@/lib/commercial/phone';
import { labelLeadChannel, labelLeadStatus } from '@/lib/tracking/commercial-dashboard';
import { labelCommercialEventType } from '@/lib/tracking/commercial-presentation';

function formatMoney(amount: number): string {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN',
		maximumFractionDigits: 0,
	}).format(amount);
}

interface CustomerCommercialSummaryProps {
	customer: Customer;
	lead: LeadCandidate | null;
	orders: SalesOrder[];
	totalPaid: number;
	pendingBalance: number;
	suggestedAction: string;
	onClear: () => void;
	onOpenOrderTool: () => void;
}

export const CustomerCommercialSummary: React.FC<CustomerCommercialSummaryProps> = ({
	customer,
	lead,
	orders,
	totalPaid,
	pendingBalance,
	suggestedAction,
	onClear,
	onOpenOrderTool,
}) => {
	const whatsappDigits = getUsableWhatsAppE164(customer.phoneE164);
	return (
		<>
		<div className="customer-details sales-customer-header">
			<div>
				<p className="sales-workspace__eyebrow">Ficha comercial</p>
				<h3>{customer.displayName}</h3>
				<p>{customer.email || 'Sin correo registrado'}</p>
			</div>
			<div className="sales-customer-actions">
					{whatsappDigits && (
						<a
							className="btn-secondary"
							href={`https://wa.me/${whatsappDigits}`}
							target="_blank"
							rel="noreferrer"
						>
							Abrir WhatsApp
						</a>
					)}
				<button type="button" className="btn-ghost" onClick={onClear}>
					Cambiar
				</button>
			</div>
		</div>

		<div className="sales-customer-summary" aria-label="Contexto comercial del cliente">
			<div>
				<span>Estado</span>
				<strong>{labelLeadStatus(lead?.status)}</strong>
			</div>
			<div>
				<span>Contacto</span>
				<strong>{customer.phoneE164 || 'Sin teléfono'}</strong>
			</div>
			<div>
				<span>Evento</span>
				<strong>{labelCommercialEventType(lead?.eventType)}</strong>
			</div>
			<div>
				<span>Canal</span>
				<strong>{labelLeadChannel(lead?.channel)}</strong>
			</div>
		</div>

		<div className="crm-customer-money">
			<div>
				<span>Pagado</span>
				<strong>{formatMoney(totalPaid)}</strong>
			</div>
			<div>
				<span>Saldo pendiente</span>
				<strong className={pendingBalance > 0 ? 'has-balance' : ''}>
					{formatMoney(pendingBalance)}
				</strong>
			</div>
			<div className="crm-customer-next-action">
				<span>Siguiente acción</span>
				<strong>{suggestedAction}</strong>
				{orders.length === 0 && (
					<button type="button" className="btn-primary" onClick={onOpenOrderTool}>
						Crear orden
					</button>
				)}
			</div>
		</div>
	</>
	);
};

interface ProspectCommercialDetailProps {
	lead: LeadCandidate;
	suggestedAction: string;
	onOpenCustomerTool: () => void;
}

export const ProspectCommercialDetail: React.FC<ProspectCommercialDetailProps> = ({
	lead,
	suggestedAction,
	onOpenCustomerTool,
}) => {
	const contact = lead.phone || lead.email;
	const whatsappDigits = getUsableWhatsAppE164(lead.phoneE164, lead.phone);

	return (
		<div className="crm-prospect-detail">
			<header className="crm-prospect-header">
				<div>
					<p className="sales-workspace__eyebrow">Ficha de prospecto</p>
					<h3>{lead.name || 'Prospecto sin nombre'}</h3>
					<span>{lead.leadCode}</span>
				</div>
				<span className="crm-prospect-status">{labelLeadStatus(lead.status)}</span>
			</header>
			<div className="crm-prospect-contact">
				<div>
					<span>Contacto disponible</span>
					<strong>{contact || 'Sin contacto registrado'}</strong>
				</div>
				{whatsappDigits && (
					<a
						className="btn-secondary"
						href={`https://wa.me/${whatsappDigits}`}
						target="_blank"
						rel="noreferrer"
					>
						Abrir WhatsApp
					</a>
				)}
			</div>
			<dl>
				<div>
					<dt>Estado</dt>
					<dd>{labelLeadStatus(lead.status)}</dd>
				</div>
				<div>
					<dt>Evento</dt>
					<dd>{labelCommercialEventType(lead.eventType)}</dd>
				</div>
				<div>
					<dt>Canal</dt>
					<dd>{labelLeadChannel(lead.channel)}</dd>
				</div>
				<div>
					<dt>Paquete</dt>
					<dd>{lead.packageInterest || 'Por definir'}</dd>
				</div>
			</dl>
			<div className="crm-next-action">
				<span>Siguiente acción</span>
				<strong>{suggestedAction}</strong>
				<button type="button" className="btn-primary" onClick={onOpenCustomerTool}>
					Crear ficha de cliente
				</button>
				<small>La ficha habilita órdenes, cobros e historial comercial.</small>
			</div>
		</div>
	);
};

export const EmptyCommercialDetail: React.FC = () => (
	<div className="sales-empty-state sales-empty-state--detail">
		<strong>Selecciona una persona u oportunidad</strong>
		<p>Aquí verás su estado, órdenes, saldo, actividad y la acción recomendada.</p>
		<ul aria-label="Información disponible en la ficha">
			<li>Contacto y contexto</li>
			<li>Órdenes y cobros</li>
			<li>Siguiente acción</li>
		</ul>
	</div>
);
