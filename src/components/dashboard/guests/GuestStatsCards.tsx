import React from 'react';
import type { DashboardGuestListResponse } from './types';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	return (
		<div className="dashboard-guests__stats">
			<article className="dashboard-guests__stat">
				<span>Total</span>
				<strong>{totals.total}</strong>
			</article>
			<article className="dashboard-guests__stat">
				<span>Pendientes</span>
				<strong>{totals.pending}</strong>
			</article>
			<article className="dashboard-guests__stat">
				<span>Confirmados</span>
				<strong>{totals.confirmed}</strong>
			</article>
			<article className="dashboard-guests__stat">
				<span>Declinados</span>
				<strong>{totals.declined}</strong>
			</article>
			<article className="dashboard-guests__stat">
				<span>Vistos</span>
				<strong>{totals.viewed}</strong>
			</article>
		</div>
	);
};

export default GuestStatsCards;
