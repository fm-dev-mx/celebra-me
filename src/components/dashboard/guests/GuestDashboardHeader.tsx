import React from 'react';
import GuestProgressCard from './GuestProgressCard';
import GuestStatsCards from './GuestStatsCards';
import type { DashboardGuestItem, DashboardGuestListResponse } from './types';
import type { RealtimeState } from './use-guest-dashboard-realtime';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: string;
}

interface GuestDashboardHeaderProps {
	eventId: string;
	hostEvents: HostEventItem[];
	items: DashboardGuestItem[];
	loading: boolean;
	realtimeState: RealtimeState;
	shareSessionCount: number;
	totals: DashboardGuestListResponse['totals'];
	updatedAt: string;
	onEventChange: (eventId: string) => void;
	onOpenNextAction: () => void;
}

const GuestDashboardHeader: React.FC<GuestDashboardHeaderProps> = ({
	eventId,
	hostEvents,
	items,
	loading,
	realtimeState,
	shareSessionCount,
	totals,
	updatedAt,
	onEventChange,
	onOpenNextAction,
}) => {
	const pendingGeneratedCount = items.filter(
		(item) => item.deliveryStatus === 'generated',
	).length;

	return (
		<>
			<div className="dashboard-guests__toolbar">
				<div className="dashboard-guests__title-area">
					<h1>Dashboard de invitados</h1>
					<div className="header-event-selector">
						<label htmlFor="active-event">Evento activo</label>
						<select
							id="active-event"
							value={eventId}
							onChange={(event) => onEventChange(event.target.value)}
						>
							<option value="">Selecciona un evento</option>
							{hostEvents.map((event) => (
								<option key={event.id} value={event.id}>
									{event.title} ({event.slug})
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			<div className="dashboard-guests__meta-bar">
				{updatedAt && (
					<span className="dashboard-status">
						<span>🕒</span> Actualizado: {new Date(updatedAt).toLocaleString('es-MX')}
					</span>
				)}
				<span className="dashboard-status">
					<span>📡</span> Streaming:{' '}
					{realtimeState === 'connected' ? '✅ Conectado' : '🔄 Reconectando'}
				</span>
			</div>

			<GuestProgressCard
				totalPeople={totals.totalPeople}
				confirmedPeople={totals.confirmedPeople}
				sessionCount={shareSessionCount}
			/>

			<GuestStatsCards totals={totals} />

			<div className="dashboard-guests__quick-actions">
				{pendingGeneratedCount > 0 && (
					<button
						className="btn-primary btn--shiny"
						disabled={loading}
						onClick={onOpenNextAction}
					>
						🚀 Enviar Siguiente ({pendingGeneratedCount} pendientes)
					</button>
				)}
			</div>
		</>
	);
};

export default GuestDashboardHeader;
