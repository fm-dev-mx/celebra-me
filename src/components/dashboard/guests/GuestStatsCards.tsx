import React from 'react';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	const cards = [
		{
			label: 'Total',
			value: totals.totalInvitations,
		},
		{
			label: 'Enviadas',
			value: totals.sharedInvitations,
			helper: `${totals.generatedInvitations} por enviar`,
		},
		{
			label: 'Asistentes',
			value: totals.confirmedInvitations,
			helper: `${totals.confirmedPeople} confirmados`,
		},
		{
			label: 'En espera',
			value: totals.pendingInvitations,
			helper: `${totals.pendingPeople} sin respuesta`,
		},
		{
			label: 'Vistos',
			value: totals.viewed,
			helper:
				totals.sharedInvitations > 0
					? `${Math.round((totals.viewed / totals.sharedInvitations) * 100)}% de entregas`
					: null,
		},
		{
			label: 'Denegadas',
			value: totals.declinedInvitations,
			helper: null,
		},
	];

	return (
		<div className="dashboard-guests__stats">
			{cards.map((card) => (
				<article key={card.label} className="dashboard-guests__stat">
					<strong>{card.value}</strong>
					<span>{card.label}</span>
					<small>{card.helper}</small>
				</article>
			))}
		</div>
	);
};

export default GuestStatsCards;
