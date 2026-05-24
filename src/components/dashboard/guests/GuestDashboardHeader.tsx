import React from 'react';
import GuestReviewBlock, {
	type GuestReviewFilter,
} from '@/components/dashboard/guests/GuestReviewBlock';
import GuestSummary from '@/components/dashboard/guests/GuestSummary';
import type {
	DashboardGuestItem,
	DashboardGuestListResponse,
} from '@/interfaces/dashboard/guest.interface';

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
	activeReviewFilter: GuestReviewFilter;
	totals: DashboardGuestListResponse['totals'];
	onEventChange: (eventId: string) => void;
	onReviewFilterChange: (filter: GuestReviewFilter) => void;
}

const GuestDashboardHeader: React.FC<GuestDashboardHeaderProps> = ({
	eventId,
	hostEvents,
	items,
	activeReviewFilter,
	totals,
	onEventChange,
	onReviewFilterChange,
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

			<GuestSummary totals={totals} />
			<GuestReviewBlock
				items={items}
				activeFilter={activeReviewFilter}
				onFilterChange={onReviewFilterChange}
			/>
		</>
	);
};

export default GuestDashboardHeader;
