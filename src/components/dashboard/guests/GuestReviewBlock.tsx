import React from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

export type GuestReviewFilter = 'all' | 'delivery-pending' | 'rsvp-pending' | 'with-message';

interface GuestReviewBlockProps {
	items: DashboardGuestItem[];
	activeFilter: GuestReviewFilter;
	onFilterChange: (filter: GuestReviewFilter) => void;
}

const GuestReviewBlock: React.FC<GuestReviewBlockProps> = ({
	items,
	activeFilter,
	onFilterChange,
}) => {
	const reviewItems = [
		{
			filter: 'delivery-pending' as GuestReviewFilter,
			count: items.filter((item) => item.deliveryStatus === 'generated').length,
			label: 'Por enviar',
		},
		{
			filter: 'rsvp-pending' as GuestReviewFilter,
			count: items.filter((item) => item.attendanceStatus === 'pending').length,
			label: 'Sin respuesta',
		},
		{
			filter: 'with-message' as GuestReviewFilter,
			count: items.filter((item) => item.guestComment.trim().length > 0).length,
			label: 'Con mensaje',
		},
	].filter((item) => item.count > 0);

	if (reviewItems.length === 0) return null;

	return (
		<section className="guest-review" aria-label="Revisar invitados">
			<div className="guest-review__title">Revisar</div>
			<div className="guest-review__items">
				<button
					type="button"
					className={`guest-review__chip ${activeFilter === 'all' ? 'guest-review__chip--active' : ''}`}
					aria-pressed={activeFilter === 'all'}
					onClick={() => onFilterChange('all')}
				>
					Todos
				</button>
				{reviewItems.map((item) => (
					<button
						key={item.filter}
						type="button"
						className={`guest-review__chip ${activeFilter === item.filter ? 'guest-review__chip--active' : ''}`}
						aria-label={`${item.label}, ${item.count}`}
						aria-pressed={activeFilter === item.filter}
						onClick={() =>
							onFilterChange(activeFilter === item.filter ? 'all' : item.filter)
						}
					>
						<span className="guest-review__count">{item.count}</span>
						<span className="guest-review__label">{item.label}</span>
					</button>
				))}
			</div>
		</section>
	);
};

export default GuestReviewBlock;
