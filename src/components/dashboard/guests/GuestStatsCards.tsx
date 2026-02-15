import React from 'react';
import type { DashboardGuestListResponse } from './types';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	return (
		<div className="dashboard-guests__stats">
			<div className="dashboard-guests__stat">
				<strong>{totals.total}</strong>
				<span>Total</span>
			</div>
			<div className="dashboard-guests__stat">
				<strong>{totals.pending}</strong>
				<span>Pendientes</span>
			</div>
			<div className="dashboard-guests__stat">
				<strong>{totals.confirmed}</strong>
				<span>Confirmados</span>
			</div>
			<div className="dashboard-guests__stat">
				<strong>{totals.declined}</strong>
				<span>Declinados</span>
			</div>
			<div className="dashboard-guests__stat">
				<strong>{totals.viewed}</strong>
				<span>Vistos</span>
			</div>
		</div>
	);
};

export default GuestStatsCards;
