import React from 'react';
import GuestProgressCard from '@/components/dashboard/guests/GuestProgressCard';
import GuestStatsCards from '@/components/dashboard/guests/GuestStatsCards';
import type {
	DashboardGuestItem,
	DashboardGuestListResponse,
} from '@/interfaces/dashboard/guest.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import type { RealtimeState } from '@/components/dashboard/guests/use-guest-dashboard-realtime';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
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
	const realtimeLabel =
		realtimeState === 'connected'
			? 'Conexión estable'
			: realtimeState === 'reconnecting'
				? 'Reconectando'
				: 'Modo de respaldo';

	return (
		<>
			<div className="dashboard-guests__toolbar">
				<div className="dashboard-guests__title-area">
					<h1>Panel de invitados</h1>
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

			<GuestProgressCard
				totalInvitations={totals.totalInvitations}
				sharedInvitations={totals.sharedInvitations}
				confirmedInvitations={totals.confirmedInvitations}
				declinedInvitations={totals.declinedInvitations}
				sessionSharedCount={shareSessionCount}
			/>

			<GuestStatsCards totals={totals} />

			<div className="dashboard-guests__quick-actions">
				{pendingGeneratedCount > 0 && (
					<button
						type="button"
						className="btn-primary"
						disabled={loading}
						onClick={onOpenNextAction}
					>
						Continuar entrega ({pendingGeneratedCount} pendientes)
					</button>
				)}
			</div>
		</>
	);
};

export default GuestDashboardHeader;
