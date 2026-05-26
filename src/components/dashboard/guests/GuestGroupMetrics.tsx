import React from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	computeGroupMetrics,
	type GroupMetric,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestGroupMetricsProps {
	items: DashboardGuestItem[];
}

const GuestGroupMetrics: React.FC<GuestGroupMetricsProps> = ({ items }) => {
	const metrics = computeGroupMetrics(items);

	if (metrics.length === 0) return null;

	return (
		<section className="guest-group-metrics" aria-label="Métricas por grupo">
			<div className="guest-group-metrics__items">
				{metrics.map((m: GroupMetric) => (
					<div key={m.tag} className="guest-group-metrics__pill">
						<span className="guest-group-metrics__tag">{m.tag}</span>
						<span className="guest-group-metrics__count">
							{m.total}
							<span className="guest-group-metrics__count-label">
								{m.total !== 1 ? ' invitaciones' : ' invitación'}
							</span>
						</span>
						{m.pending > 0 && (
							<span className="guest-group-metrics__pending">
								{m.pending} {m.pending !== 1 ? 'pendientes' : 'pendiente'}
							</span>
						)}
					</div>
				))}
			</div>
		</section>
	);
};

export default GuestGroupMetrics;
