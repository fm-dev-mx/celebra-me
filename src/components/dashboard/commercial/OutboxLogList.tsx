import React from 'react';

export interface ConversionEvent {
	id: string;
	event_name: string;
	event_id: string;
	eventName?: string;
	eventId?: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
	attempt_count: number;
	attemptCount?: number;
	last_error_message?: string | null;
	lastErrorMessage?: string | null;
	created_at: string;
	createdAt?: string;
}

interface OutboxLogListProps {
	conversions: ConversionEvent[];
	processingConversions: boolean;
	onProcessConversions: () => void;
	onRequeueEvent: (eventId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
	pending: 'Pendiente',
	sending: 'Enviando...',
	sent: 'Enviado (CAPI)',
	failed: 'Error de Envío',
	skipped: 'Ignorado (CAPI Desactivado)',
};

const STATUS_ERROR_LABELS: Record<string, string> = {
	failed: 'Error:',
	skipped: 'Detalle:',
};

export const OutboxLogList: React.FC<OutboxLogListProps> = ({
	conversions,
	processingConversions,
	onProcessConversions,
	onRequeueEvent,
}) => {
	return (
		<div className="dashboard-card">
			<div className="outbox-header">
				<h3>Cola de Conversiones CAPI (Outbox)</h3>
				<button
					type="button"
					className="btn-secondary btn-small"
					disabled={processingConversions}
					onClick={onProcessConversions}
				>
					{processingConversions ? 'Procesando...' : 'Procesar Cola CAPI'}
				</button>
			</div>
			<p className="dashboard-form-help sales-mb-4">
				Aquí se registran los eventos de conversión de compras. Se envían al Conversions API en segundo plano.
			</p>

			<div className="outbox-list">
				{conversions.length === 0 ? (
					<p className="dashboard-form-help">No hay eventos en la cola todavía.</p>
				) : (
					conversions.map((conv) => {
						const eventLabel = conv.event_name || conv.eventName || 'Purchase';
						const eventKey = conv.event_id || conv.eventId || '';
						const errMsg = conv.last_error_message || conv.lastErrorMessage || undefined;
						const created = conv.created_at || conv.createdAt || '';
						return (
							<div key={conv.id} className="outbox-item">
								<div className="outbox-item-row">
									<strong>{eventLabel}</strong>
									<span className={`status-badge-custom status-${conv.status}`}>
										{STATUS_LABELS[conv.status] || conv.status}
									</span>
								</div>
								<p className="outbox-item-meta">
									ID: {eventKey} | Valor: ${conv.value} {conv.currency}
								</p>
								<p className="outbox-item-meta">
									Fecha: {created ? new Date(created).toLocaleString('es-MX') : '—'} | Intentos: {conv.attempt_count || conv.attemptCount || 0}
								</p>
								{errMsg && (
									<p className="outbox-item-error">
										<strong>{STATUS_ERROR_LABELS[conv.status] || 'Detalle:'}</strong> {errMsg}
									</p>
								)}
								{(conv.status === 'failed' || conv.status === 'skipped') && (
									<div className="outbox-item-actions">
										<button
											type="button"
											className="btn-secondary btn-small btn-requeue"
											disabled={processingConversions}
											onClick={() => onRequeueEvent(conv.id)}
										>
											Reintentar Envío
										</button>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};
export default OutboxLogList;
