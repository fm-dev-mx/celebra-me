import React from 'react';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

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
	onEventChange: (eventId: string) => void;
	filteredItems?: DashboardGuestItem[];
}

const GuestDashboardHeader: React.FC<GuestDashboardHeaderProps> = ({
	eventId,
	hostEvents,
	items,
	filteredItems,
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
									{event.title}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			<GuestGroupMetrics items={filteredItems ?? items} />
		</>
	);
};

export default GuestDashboardHeader;
