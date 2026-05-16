import React from 'react';
import GuestSummary from '@/components/dashboard/guests/GuestSummary';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: string;
}

interface GuestDashboardHeaderProps {
	eventId: string;
	hostEvents: HostEventItem[];
	totals: DashboardGuestListResponse['totals'];
	onEventChange: (eventId: string) => void;
}

const GuestDashboardHeader: React.FC<GuestDashboardHeaderProps> = ({
	eventId,
	hostEvents,
	totals,
	onEventChange,
}) => {
	return (
		<>
			<div className="dashboard-guests__toolbar">
				<div className="dashboard-guests__title-area">
					<div className="header-event-selector">
						<label htmlFor="active-event">Evento</label>
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

			<GuestSummary totals={totals} />
		</>
	);
};

export default GuestDashboardHeader;
