import React from 'react';

import { type CrmTimelineEntry } from '@/lib/commercial/crm-timeline.service';
interface CrmTimelineProps {
	entries: CrmTimelineEntry[];
	loading: boolean;
}

const TIMELINE_ICONS: Record<string, string> = {
	lead_created: '📋',
	order_created: '📦',
	deposit_paid: '💰',
	capi_event_created: '📤',
	capi_event_sent: '✅',
	capi_event_failed: '❌',
	order_status_changed: '🔄',
	customer_created: '👤',
};

const CrmTimeline: React.FC<CrmTimelineProps> = ({ entries, loading }) => {
	if (loading) {
		return <p className="dashboard-form-help">Cargando línea de tiempo...</p>;
	}

	if (entries.length === 0) {
		return (
			<p className="dashboard-form-help">
				Sin actividad registrada para este cliente todavía.
			</p>
		);
	}

	return (
		<div className="crm-timeline">
			{entries.map((entry) => {
				const icon = TIMELINE_ICONS[entry.eventType] || '📌';
				return (
					<div key={entry.id} className="crm-timeline__item">
						<div className="crm-timeline__dot">{icon}</div>
						<div className="crm-timeline__content">
							<div className="crm-timeline__header">
								<strong className="crm-timeline__label">{entry.label}</strong>
								<span className="crm-timeline__time">
									{new Date(entry.occurredAt).toLocaleString('es-MX', {
										dateStyle: 'short',
										timeStyle: 'short',
									})}
								</span>
							</div>
							<p className="crm-timeline__desc">{entry.description}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default CrmTimeline;
