import React from 'react';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface GuestSummaryProps {
	totals: DashboardGuestListResponse['totals'];
	variant?: 'full' | 'compact';
}

const GuestSummary: React.FC<GuestSummaryProps> = ({ totals, variant = 'full' }) => {
	const isDeliveryComplete =
		totals.totalInvitations > 0 && totals.sharedInvitations === totals.totalInvitations;

	if (variant === 'compact') {
		return (
			<section
				className="guest-summary guest-summary--compact"
				aria-label="Resumen de invitados"
			>
				<span className="guest-summary__compact-item">
					<span className="guest-summary__compact-label">Enviadas</span>
					<span className="guest-summary__compact-value">
						{totals.sharedInvitations}
						<span className="guest-summary__value-separator">/</span>
						{totals.totalInvitations}
					</span>
				</span>
				<span className="guest-summary__compact-dot" aria-hidden="true">
					·
				</span>
				<span className="guest-summary__compact-item">
					<span className="guest-summary__compact-label">Confirmadas</span>
					<span className="guest-summary__compact-value">
						{totals.confirmedInvitations}
					</span>
				</span>
				<span className="guest-summary__compact-dot" aria-hidden="true">
					·
				</span>
				<span className="guest-summary__compact-item">
					<span className="guest-summary__compact-label">Asistentes</span>
					<span className="guest-summary__compact-value">
						{totals.confirmedPeople}
						<span className="guest-summary__value-small">/</span>
						{totals.totalPeople}
					</span>
				</span>
			</section>
		);
	}

	return (
		<section className="guest-summary" aria-label="Resumen de invitados">
			<div className="guest-summary__inner">
				<div className="guest-summary__primary">
					<div className="guest-summary__metric guest-summary__metric--large">
						<span className="guest-summary__value">
							{totals.sharedInvitations}
							<span className="guest-summary__value-separator">/</span>
							{totals.totalInvitations}
						</span>
						<span className="guest-summary__label">Invitaciones enviadas</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__value">{totals.confirmedInvitations}</span>
						<span className="guest-summary__label">Confirmadas</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__value">
							{totals.confirmedPeople}
							<span className="guest-summary__value-small">/</span>
							{totals.totalPeople}
						</span>
						<span className="guest-summary__label">Asistentes</span>
					</div>
				</div>

				<div className="guest-summary__secondary">
					<div className="guest-summary__metric guest-summary__metric--compact">
						<span className="guest-summary__value">{totals.unconfirmedShared}</span>
						<span className="guest-summary__label">Por confirmar</span>
					</div>

					<div className="guest-summary__metric guest-summary__metric--compact">
						<span className="guest-summary__value">{totals.viewed}</span>
						<span className="guest-summary__label">Vistas</span>
					</div>

					<div className="guest-summary__metric guest-summary__metric--compact">
						<span className="guest-summary__value">{totals.declinedInvitations}</span>
						<span className="guest-summary__label">Denegadas</span>
					</div>

					{isDeliveryComplete && (
						<div className="dashboard-badge dashboard-badge--active guest-summary__badge">
							<span className="guest-summary__badge-dot" aria-hidden="true" />
							<span>Entrega completa</span>
						</div>
					)}
				</div>
			</div>
		</section>
	);
};

export default GuestSummary;
