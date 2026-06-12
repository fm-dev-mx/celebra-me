import React from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { getReminderEligibleGuests } from '@/components/dashboard/guests/reminder-eligibility';
import { isUnconfirmedSharedGuest } from '@/lib/guests/reminder-eligibility';
import type { ReminderAudience } from '@/lib/rsvp/services/shared/share-message-defaults';

export type GuestReviewFilter =
	| 'all'
	| 'reminder-pending'
	| 'delivery-pending'
	| 'rsvp-pending'
	| 'confirmation-pending'
	| 'with-message';

interface GuestReviewBlockProps {
	items: DashboardGuestItem[];
	activeFilter: GuestReviewFilter;
	onFilterChange: (filter: GuestReviewFilter) => void;
	reminderAudience?: ReminderAudience;
}

const GuestReviewBlock: React.FC<GuestReviewBlockProps> = ({
	items,
	activeFilter,
	onFilterChange,
	reminderAudience,
}) => {
	let deliveryPending = 0;
	let confirmationPending = 0;
	let rsvpPending = 0;
	let withMessage = 0;
	for (const item of items) {
		if (item.deliveryStatus === 'generated') deliveryPending++;
		if (isUnconfirmedSharedGuest(item)) confirmationPending++;
		if (item.attendanceStatus === 'pending') rsvpPending++;
		if ((item.guestComment ?? '').trim().length > 0) withMessage++;
	}
	const reminderPending = reminderAudience
		? getReminderEligibleGuests(items, reminderAudience).length
		: 0;
	const reviewItems: { filter: GuestReviewFilter; count: number; label: string }[] = [];
	if (deliveryPending > 0)
		reviewItems.push({
			filter: 'delivery-pending',
			count: deliveryPending,
			label: 'Por enviar',
		});
	if (reminderPending > 0)
		reviewItems.push({
			filter: 'reminder-pending',
			count: reminderPending,
			label: 'Por recordar',
		});
	if (confirmationPending > 0)
		reviewItems.push({
			filter: 'confirmation-pending',
			count: confirmationPending,
			label: 'Por confirmar',
		});
	if (rsvpPending > 0)
		reviewItems.push({ filter: 'rsvp-pending', count: rsvpPending, label: 'Sin respuesta' });
	if (withMessage > 0)
		reviewItems.push({ filter: 'with-message', count: withMessage, label: 'Con mensaje' });

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
