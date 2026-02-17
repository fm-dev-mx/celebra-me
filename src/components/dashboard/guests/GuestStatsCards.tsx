import React from 'react';
import type { DashboardGuestListResponse } from './types';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	return (
		<div className="dashboard-guests__stats">
			<article className="dashboard-guests__stat">
				<div className="stat-content">
					<strong>{totals.totalPeople}</strong>
					<small>/ {totals.totalInvitations}</small>
				</div>
				<span>Total (Personas / Inv)</span>
			</article>
			<article className="dashboard-guests__stat">
				<div className="stat-content">
					<strong>{totals.pendingPeople}</strong>
					<small>/ {totals.pendingInvitations}</small>
				</div>
				<span>Pendientes</span>
			</article>
			<article className="dashboard-guests__stat">
				<div className="stat-content">
					<strong>{totals.confirmedPeople}</strong>
					<small>/ {totals.confirmedInvitations}</small>
				</div>
				<span>Confirmados</span>
			</article>
			<article className="dashboard-guests__stat">
				<div className="stat-content">
					<strong>{totals.declinedPeople}</strong>
					<small>/ {totals.declinedInvitations}</small>
				</div>
				<span>Declinados</span>
			</article>
			<article className="dashboard-guests__stat">
				<strong>{totals.viewed}</strong>
				<span>Vistos</span>
			</article>
		</div>
	);
};

export default GuestStatsCards;
