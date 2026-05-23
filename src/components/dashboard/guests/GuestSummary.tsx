import React from 'react';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface GuestSummaryProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestSummary: React.FC<GuestSummaryProps> = ({ totals }) => {
	const isDeliveryComplete =
		totals.totalInvitations > 0 && totals.sharedInvitations === totals.totalInvitations;

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
						<span className="guest-summary__value">{totals.viewed}</span>
						<span className="guest-summary__label">Vistas</span>
					</div>

					<div className="guest-summary__metric guest-summary__metric--compact">
						<span className="guest-summary__value">{totals.declinedInvitations}</span>
						<span className="guest-summary__label">Denegadas</span>
					</div>

					{isDeliveryComplete && (
						<div className="guest-summary__badge">
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
