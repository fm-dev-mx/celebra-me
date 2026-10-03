import React from 'react';
import type { GuestReviewFilter } from '@/components/dashboard/guests/GuestReviewBlock';
import {
	getGuestSummaryMessage,
	type GuestStatusCounts,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestStatusOverviewProps {
	counts: GuestStatusCounts;
	activeFilter: GuestReviewFilter;
	onFilterChange: (filter: GuestReviewFilter) => void;
}

interface StatusSegment {
	filter: GuestReviewFilter;
	label: string;
	count: number;
}

/**
 * Compact-screen overview: one plain-language sentence plus three status
 * segments that double as the list filter.
 */
const GuestStatusOverview: React.FC<GuestStatusOverviewProps> = ({
	counts,
	activeFilter,
	onFilterChange,
}) => {
	const message = getGuestSummaryMessage(counts);
	const segments: StatusSegment[] = [
		{ filter: 'delivery-pending', label: 'Por enviar', count: counts.toSend },
		{ filter: 'confirmation-pending', label: 'Esperando', count: counts.waiting },
		{ filter: 'confirmed', label: 'Vienen', count: counts.confirmed },
	];
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
						className="guest-overview__segments"
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
