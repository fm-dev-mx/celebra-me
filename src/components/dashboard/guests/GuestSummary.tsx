import React from 'react';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface GuestSummaryProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestSummary: React.FC<GuestSummaryProps> = ({ totals }) => {
	const deliveryPercentage =
		totals.totalInvitations > 0
			? Math.round((totals.sharedInvitations / totals.totalInvitations) * 100)
			: 0;
	const isDeliveryComplete =
		totals.totalInvitations > 0 && totals.sharedInvitations === totals.totalInvitations;

	return (
		<section className="guest-summary" aria-label="Resumen de invitados">
			<div className="guest-summary__grid">
				<div className="guest-summary__row">
					<div className="guest-summary__metric">
						<span className="guest-summary__label">Enviadas</span>
						<span className="guest-summary__value">
							{totals.sharedInvitations}/{totals.totalInvitations}
							<span className="guest-summary__pct"> · {deliveryPercentage}%</span>
						</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__label">Vistas</span>
						<span className="guest-summary__value">
							{totals.viewed}
							{totals.sharedInvitations > 0 && (
								<span className="guest-summary__pct">
									{' '}
									· {Math.round((totals.viewed / totals.sharedInvitations) * 100)}
									%
								</span>
							)}
						</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__label">Confirmadas</span>
						<span className="guest-summary__value">{totals.confirmedInvitations}</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__label">Denegadas</span>
						<span className="guest-summary__value">{totals.declinedInvitations}</span>
					</div>

					<div className="guest-summary__divider" aria-hidden="true" />

					<div className="guest-summary__metric">
						<span className="guest-summary__label">Asistentes</span>
						<span className="guest-summary__value">
							{totals.confirmedPeople}/{totals.totalPeople}
						</span>
					</div>

					{isDeliveryComplete && (
						<>
							<div className="guest-summary__divider" aria-hidden="true" />
							<div className="guest-summary__metric guest-summary__metric--badge">
								<span className="guest-summary__badge">Entrega completa</span>
							</div>
						</>
					)}
				</div>
			</div>
		</section>
	);
};

export default GuestSummary;
