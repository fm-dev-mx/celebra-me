import React from 'react';

export interface ConversionEvent {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
	attempt_count: number;
	last_error_message?: string | null;
	created_at: string;
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
					conversions.map((conv) => (
						<div key={conv.id} className="outbox-item">
							<div className="outbox-item-row">
								<strong>{conv.event_name}</strong>
								<span className={`status-badge-custom status-${conv.status}`}>
									{STATUS_LABELS[conv.status] || conv.status}
								</span>
							</div>
							<p className="outbox-item-meta">
								ID: {conv.event_id} | Valor: ${conv.value} {conv.currency}
							</p>
							<p className="outbox-item-meta">
								Fecha: {new Date(conv.created_at).toLocaleString('es-MX')} | Intentos: {conv.attempt_count}
							</p>
							{conv.last_error_message && (
								<p className="outbox-item-error">
									<strong>{conv.status === 'skipped' ? 'Detalle:' : 'Error:'}</strong> {conv.last_error_message}
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
					))
				)}
			</div>
		</div>
	);
};
export default OutboxLogList;
