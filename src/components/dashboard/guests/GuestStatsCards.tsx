import React from 'react';
import type { DashboardGuestListResponse } from './types';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	return (
		<div className="dashboard-guests__stats">
			<article className="dashboard-guests__stat">
				<strong>{totals.total}</strong>
				<span>Total</span>
			</article>
			<article className="dashboard-guests__stat">
				<strong>{totals.pending}</strong>
				<span>Pendientes</span>
			</article>
			<article className="dashboard-guests__stat">
				<strong>{totals.confirmed}</strong>
				<span>Confirmados</span>
			</article>
			<article className="dashboard-guests__stat">
				<strong>{totals.declined}</strong>
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
