import React from 'react';

export interface LeadCandidate {
	id: string;
	leadCode: string;
	channel: string;
	status: string;
	customerId?: string | null;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	phoneE164?: string | null;
	eventType?: string | null;
	packageInterest?: string | null;
	utmSource?: string | null;
	utmMedium?: string | null;
	utmCampaign?: string | null;
	createdAt?: string | null;
}

export interface Customer {
	id: string;
	displayName: string;
	email?: string | null;
	phoneE164?: string | null;
}

interface LeadCandidatesListProps {
	candidates: {
		byLeadCode?: LeadCandidate | null;
		byPhone: LeadCandidate[];
		byEmail: LeadCandidate[];
		recentContext: LeadCandidate[];
	} | null;
	onSelectCustomer: (customer: Customer, associatedLead?: LeadCandidate) => void;
	onReconcileLead: (lead: LeadCandidate) => void;
}

const displayChannel = (channel: string) => {
	if (channel === 'contact_form') return 'Formulario';
	if (channel === 'whatsapp') return 'WhatsApp';
	return 'Manual';
};

export function buildSyntheticCustomer(lead: LeadCandidate): Customer {
	return {
		id: lead.customerId!,
		displayName: lead.name || 'Cliente',
		email: lead.email,
		phoneE164: lead.phoneE164,
	};
}

export const LeadCandidatesList: React.FC<LeadCandidatesListProps> = ({
	candidates,
	onSelectCustomer,
	onReconcileLead,
}) => {
	if (!candidates) return null;

	const hasAnyCandidates =
		candidates.byLeadCode ||
		candidates.byPhone.length > 0 ||
		candidates.byEmail.length > 0 ||
		candidates.recentContext.length > 0;

	return (
		<div className="crm-search-results">
			<h3>Resultados de búsqueda</h3>
			<div className="candidates-list">
				{/* Direct Match by Lead Code */}
				{candidates.byLeadCode && (
					<div className="candidate-group">
						<h4>Coincidencia por código</h4>
						<div className="candidate-item">
							<p>
								<strong>{candidates.byLeadCode.leadCode}</strong> —{' '}
								{candidates.byLeadCode.name || 'Sin nombre'}
							</p>
							<p className="candidate-meta">
								{candidates.byLeadCode.phone &&
									`Tel: ${candidates.byLeadCode.phone} | `}
								{candidates.byLeadCode.email &&
									`Email: ${candidates.byLeadCode.email} | `}
								Canal: {displayChannel(candidates.byLeadCode.channel)}
							</p>
							<div className="candidate-actions">
								{candidates.byLeadCode.customerId ? (
									<button
										type="button"
										className="btn-secondary"
										onClick={() =>
											onSelectCustomer(
																buildSyntheticCustomer(candidates.byLeadCode!),
																candidates.byLeadCode!,
															)
										}
									>
										Seleccionar cliente
									</button>
								) : (
									<button
										type="button"
										className="btn-primary"
										onClick={() => onReconcileLead(candidates.byLeadCode!)}
									>
										Vincular o crear cliente
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Matches by Phone */}
				{candidates.byPhone.length > 0 && (
					<div className="candidate-group">
						<h4>Coincidencias por teléfono</h4>
						{candidates.byPhone.map((lead) => (
							<div key={lead.id} className="candidate-item">
								<p>
									<strong>{lead.leadCode}</strong> — {lead.name || 'Sin nombre'}
								</p>
								<p className="candidate-meta">
									{lead.phone} | {displayChannel(lead.channel)}
								</p>
								<div className="candidate-actions">
									{lead.customerId ? (
										<button
											type="button"
											className="btn-secondary"
											onClick={() =>
												onSelectCustomer(
																		buildSyntheticCustomer(lead),
																		lead,
																	)
											}
										>
											Seleccionar cliente
										</button>
									) : (
										<button
											type="button"
											className="btn-primary"
											onClick={() => onReconcileLead(lead)}
										>
											Vincular o crear cliente
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Matches by Email */}
				{candidates.byEmail.length > 0 && (
					<div className="candidate-group">
						<h4>Coincidencias por correo</h4>
						{candidates.byEmail.map((lead) => (
							<div key={lead.id} className="candidate-item">
								<p>
									<strong>{lead.leadCode}</strong> — {lead.name || 'Sin nombre'}
								</p>
								<p className="candidate-meta">
									{lead.email} | {displayChannel(lead.channel)}
								</p>
								<div className="candidate-actions">
									{lead.customerId ? (
										<button
											type="button"
											className="btn-secondary"
											onClick={() =>
												onSelectCustomer(
																		buildSyntheticCustomer(lead),
																		lead,
																	)
											}
										>
											Seleccionar cliente
										</button>
									) : (
										<button
											type="button"
											className="btn-primary"
											onClick={() => onReconcileLead(lead)}
										>
											Vincular o crear cliente
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Recent context Proposals */}
				{candidates.recentContext.length > 0 && (
					<div className="candidate-group">
						<h4>Contexto reciente</h4>
						{candidates.recentContext.map((lead) => (
							<div key={lead.id} className="candidate-item">
								<p>
									<strong>{lead.leadCode}</strong> — {lead.name || 'Sin nombre'}
								</p>
								<p className="candidate-meta">
									{lead.eventType && `Evento: ${lead.eventType} | `}
									{lead.packageInterest && `Paquete: ${lead.packageInterest} | `}
									{displayChannel(lead.channel)}
								</p>
								<div className="candidate-actions">
									{lead.customerId ? (
										<button
											type="button"
											className="btn-secondary"
											onClick={() =>
												onSelectCustomer(
																		buildSyntheticCustomer(lead),
																		lead,
																	)
											}
										>
											Seleccionar cliente
										</button>
									) : (
										<button
											type="button"
											className="btn-primary"
											onClick={() => onReconcileLead(lead)}
										>
											Vincular o crear cliente
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Empty state */}
				{!hasAnyCandidates && (
					<p className="dashboard-form-help">
						No se encontraron prospectos coincidentes.
					</p>
				)}
			</div>
		</div>
	);
};
