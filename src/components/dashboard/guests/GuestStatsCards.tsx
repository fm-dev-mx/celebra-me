import React from 'react';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface GuestStatsCardsProps {
	totals: DashboardGuestListResponse['totals'];
}

const GuestStatsCards: React.FC<GuestStatsCardsProps> = ({ totals }) => {
	const cards = [
		{
			label: 'Invitaciones',
			value: totals.totalInvitations,
			helper: `${totals.totalPeople} personas contempladas`,
		},
		{
			label: 'Entregadas',
			value: totals.sharedInvitations,
			helper: `${totals.generatedInvitations} por enviar`,
		},
		{
			label: 'Confirmadas',
			value: totals.confirmedInvitations,
			helper: `${totals.confirmedPeople} asistentes`,
		},
		{
			label: 'Pendientes',
			value: totals.pendingInvitations,
			helper: `${totals.pendingPeople} cupos por resolver`,
		},
		{
			label: 'Vistas',
			value: totals.viewed,
			helper: `de ${totals.sharedInvitations} entregadas`,
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
