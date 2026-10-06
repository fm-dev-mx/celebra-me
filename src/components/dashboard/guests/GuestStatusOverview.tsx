import React from 'react';
import {
	getGuestSummaryMessage,
	type GuestReviewFilterValue,
	type GuestStatusCounts,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestStatusOverviewProps {
	counts: GuestStatusCounts;
	activeFilter: GuestReviewFilterValue;
	onFilterChange: (filter: GuestReviewFilterValue) => void;
	/** Guests eligible for a reminder; adds the "Por recordar" segment when above zero. */
	reminderCount?: number;
	/** Guests who left a message; adds the "Con mensaje" segment when above zero. */
	withMessageCount?: number;
	/** Context for the reminder segment, e.g. days left before the event. */
	reminderHint?: string | null;
}

interface StatusSegment {
	filter: GuestReviewFilterValue;
	label: string;
	count: number;
}

/**
 * Guest overview for every width: one plain-language sentence plus the status
 * segments that double as the single review filter of the list.
 */
const GuestStatusOverview: React.FC<GuestStatusOverviewProps> = ({
	counts,
	activeFilter,
	onFilterChange,
	reminderCount = 0,
	withMessageCount = 0,
	reminderHint = null,
}) => {
	const message = getGuestSummaryMessage(counts);
	const segments: StatusSegment[] = [
		{ filter: 'delivery-pending', label: 'Por enviar', count: counts.toSend },
		{ filter: 'confirmation-pending', label: 'Esperando', count: counts.waiting },
		{ filter: 'confirmed', label: 'Vienen', count: counts.confirmed },
	];
	if (reminderCount > 0) {
		segments.push({ filter: 'reminder-pending', label: 'Por recordar', count: reminderCount });
	}
	if (withMessageCount > 0) {
		segments.push({ filter: 'with-message', label: 'Con mensaje', count: withMessageCount });
	}
	const isSegmentFilter = segments.some((segment) => segment.filter === activeFilter);

	return (
		<section className="guest-overview" aria-label="Resumen de invitados">
			<div className={`guest-overview__summary guest-overview__summary--${message.tone}`}>
				{message.count !== null && (
					<span className="guest-overview__count">{message.count}</span>
				)}
				<div className="guest-overview__text">
					<p className="guest-overview__title">{message.title}</p>
					<p className="guest-overview__detail">{message.detail}</p>
				</div>
			</div>

			{counts.total > 0 && (
				<div className="guest-overview__filters">
					<h2 id="guest-overview-show" className="guest-overview__label">
						Mostrar
					</h2>
					<div
						className={`guest-overview__segments${segments.length > 3 ? ' guest-overview__segments--many' : ''}`}
						role="group"
						aria-labelledby="guest-overview-show"
					>
						{segments.map((segment) => {
							const active = activeFilter === segment.filter;
							return (
								<button
									key={segment.filter}
									type="button"
									className={`guest-overview__segment${active ? ' guest-overview__segment--active' : ''}`}
									aria-label={`${segment.label}, ${segment.count}`}
									aria-pressed={active}
									onClick={() => onFilterChange(active ? 'all' : segment.filter)}
								>
									<span className="guest-overview__segment-count">
										{segment.count}
									</span>
									<span className="guest-overview__segment-label">
										{segment.label}
									</span>
								</button>
							);
						})}
					</div>
					{reminderCount > 0 && reminderHint && (
						<p className="guest-overview__hint">{reminderHint}</p>
					)}
					{activeFilter !== 'all' && (
						<button
							type="button"
							className="guest-overview__clear"
							onClick={() => onFilterChange('all')}
						>
							{isSegmentFilter
								? `Ver todos los invitados (${counts.total})`
								: 'Quitar filtro'}
						</button>
					)}
				</div>
			)}
		</section>
	);
};

export default GuestStatusOverview;
