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

export const CrmTimeline: React.FC<CrmTimelineProps> = ({ entries, loading }) => {
	if (loading) {
		return <p className="dashboard-form-help">Cargando línea de tiempo...</p>;
	}

	if (entries.length === 0) {
		return <p className="dashboard-form-help">Sin actividad registrada para este cliente todavía.</p>;
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
			<style>{`
				.crm-timeline {
					display: grid;
					gap: 0.75rem;
					max-height: 400px;
					overflow-y: auto;
					padding: 0.25rem 0;
				}
				.crm-timeline__item {
					display: flex;
					gap: 0.75rem;
					padding: 0.5rem 0.75rem;
					background: rgba(255,255,255,0.01);
					border: 1px solid var(--dashboard-card-border);
					border-radius: 0.5rem;
				}
				.crm-timeline__dot {
					flex-shrink: 0;
					font-size: 1.2rem;
					line-height: 1.5;
				}
				.crm-timeline__content {
					flex: 1;
					min-width: 0;
				}
				.crm-timeline__header {
					display: flex;
					justify-content: space-between;
					align-items: baseline;
					gap: 0.75rem;
				}
				.crm-timeline__label {
					color: var(--color-text-primary);
					font-size: 0.9rem;
				}
				.crm-timeline__time {
					color: var(--color-text-muted);
					font-size: 0.75rem;
					flex-shrink: 0;
				}
				.crm-timeline__desc {
					margin: 0.25rem 0 0;
					color: var(--color-text-secondary);
					font-size: 0.82rem;
					line-height: 1.4;
				}
			`}</style>
		</div>
	);
};

export default CrmTimeline;
