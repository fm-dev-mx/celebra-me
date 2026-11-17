import React from 'react';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: string;
}

interface GuestDashboardHeaderProps {
	eventId: string;
	hostEvents: HostEventItem[];
	onEventChange: (eventId: string) => void;
}

const GuestDashboardHeader: React.FC<GuestDashboardHeaderProps> = ({
	eventId,
	hostEvents,
	onEventChange,
}) => {
	// One event needs no picker: show its name instead.
	const singleEvent =
		hostEvents.length === 1 && hostEvents[0].id === eventId ? hostEvents[0] : null;
	return (
		<>
			<div className="dashboard-guests__toolbar">
				<div className="dashboard-guests__title-area">
					{singleEvent ? (
						<p className="header-event-selector__single">{singleEvent.title}</p>
					) : (
						<div className="header-event-selector">
							<label htmlFor="active-event">Evento</label>
							<select
								id="active-event"
								value={eventId}
								onChange={(event) => onEventChange(event.target.value)}
							>
								<option value="">Seleccione un evento</option>
								{hostEvents.map((event) => (
									<option key={event.id} value={event.id}>
										{event.title}
									</option>
								))}
							</select>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default GuestDashboardHeader;
