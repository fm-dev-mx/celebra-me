import React from 'react';

export interface ConversionEvent {
	id: string;
	event_name: string;
	event_id: string;
	eventName?: string;
	eventId?: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'ambiguous';
	attempt_count: number;
	attemptCount?: number;
	last_error_message?: string | null;
	lastErrorMessage?: string | null;
	created_at: string;
	createdAt?: string;
	next_attempt_at?: string | null;
	claimed_at?: string | null;
	claim_expires_at?: string | null;
	sent_at?: string | null;
	last_error_code?: string | null;
	provider_events_received?: number | null;
	provider_trace_id?: string | null;
	attempt_history?: Array<{
		attempt_number: number;
		started_at: string;
		completed_at: string | null;
		outcome: string | null;
		error_code: string | null;
		error_message: string | null;
	}>;
	recovery_history?: Array<{
		reason: string;
		source_status: string;
		destination_status: string;
		created_at: string;
	}>;
}

interface OutboxLogListProps {
	conversions: ConversionEvent[];
	deliveryDisabled: boolean;
	processingConversions: boolean;
	onProcessConversions: () => void;
	onRequeueEvent: (eventId: string, reason: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
	pending: 'Pendiente',
	sending: 'Enviando...',
	sent: 'Enviado',
	failed: 'Error de envío',
	skipped: 'Omitido · entrega desactivada',
	ambiguous: 'Entrega por confirmar',
};

const STATUS_ERROR_LABELS: Record<string, string> = {
	failed: 'Error:',
	skipped: 'Detalle:',
	ambiguous: 'Atención:',
};

const OutboxLogList: React.FC<OutboxLogListProps> = ({
	conversions,
	deliveryDisabled,
	processingConversions,
	onProcessConversions,
	onRequeueEvent,
}) => {
	return (
		<div className="outbox-console">
			<div className="outbox-header">
				<div>
					<p className="sales-workspace__eyebrow">Diagnóstico</p>
					<h3>Registro técnico de conversiones</h3>
				</div>
				{!deliveryDisabled && (
					<button
						type="button"
						className="btn-secondary btn-small"
						disabled={processingConversions}
						onClick={onProcessConversions}
					>
						{processingConversions ? 'Procesando...' : 'Procesar cola'}
					</button>
				)}
			</div>
			{deliveryDisabled ? (
				<div className="outbox-safe-notice" role="status">
					<strong>CAPI está desactivado; no se envían eventos reales a Meta.</strong>
					<span>Estos registros son solo diagnósticos y no requieren una acción.</span>
				</div>
			) : (
				<p className="dashboard-form-help">
					Eventos de conversión de compras encolados para revisión técnica.
				</p>
			)}

			<div className="outbox-list">
				{conversions.length === 0 ? (
					<p className="dashboard-form-help">No hay eventos en la cola todavía.</p>
				) : (
					conversions.map(
						// eslint-disable-next-line complexity -- each optional diagnostic reflects independent persisted state.
						(conv) => {
							const eventLabel = conv.event_name || conv.eventName || 'Purchase';
							const eventKey = conv.event_id || conv.eventId || '';
							const errMsg =
								conv.last_error_message || conv.lastErrorMessage || undefined;
							const created = conv.created_at || conv.createdAt || '';
							return (
								<div key={conv.id} className="outbox-item">
									<div className="outbox-item-row">
										<strong>{eventLabel}</strong>
										<span
											className={`status-badge-custom status-${conv.status}`}
										>
											{STATUS_LABELS[conv.status] || conv.status}
										</span>
									</div>
									<p className="outbox-item-meta">
										{created
											? new Date(created).toLocaleString('es-MX')
											: 'Sin fecha'}{' '}
										· ${conv.value} {conv.currency}
									</p>
									<details className="outbox-item-details">
										<summary>Ver detalle técnico</summary>
										<p>ID: {eventKey || 'Sin identificador'}</p>
										<p>
											Intentos: {conv.attempt_count || conv.attemptCount || 0}
										</p>
										{conv.next_attempt_at && (
											<p>
												Próximo intento:{' '}
												{new Date(conv.next_attempt_at).toLocaleString(
													'es-MX',
												)}
											</p>
										)}
										{conv.claimed_at && (
											<p>
												Reclamado:{' '}
												{new Date(conv.claimed_at).toLocaleString('es-MX')}
											</p>
										)}
										{conv.claim_expires_at && (
											<p>
												Vence el reclamo:{' '}
												{new Date(conv.claim_expires_at).toLocaleString(
													'es-MX',
												)}
											</p>
										)}
										{conv.sent_at && (
											<p>
												Enviado:{' '}
												{new Date(conv.sent_at).toLocaleString('es-MX')}
											</p>
										)}
										{conv.last_error_code && (
											<p>Código: {conv.last_error_code}</p>
										)}
										{conv.provider_events_received != null && (
											<p>
												Eventos recibidos por Meta:{' '}
												{conv.provider_events_received}
											</p>
										)}
										{conv.provider_trace_id && (
											<p>Referencia Meta: {conv.provider_trace_id}</p>
										)}
										{(conv.attempt_history?.length ?? 0) > 0 && (
											<div>
												<strong>Historial de intentos</strong>
												{conv.attempt_history?.map((attempt) => (
													<p
														key={`${conv.id}:attempt:${attempt.attempt_number}`}
													>
														#{attempt.attempt_number} ·{' '}
														{attempt.outcome || 'En curso'} ·{' '}
														{new Date(
															attempt.started_at,
														).toLocaleString('es-MX')}
													</p>
												))}
											</div>
										)}
										{(conv.recovery_history?.length ?? 0) > 0 && (
											<div>
												<strong>Historial de recuperación</strong>
												{conv.recovery_history?.map((recovery) => (
													<p
														key={`${conv.id}:recovery:${recovery.created_at}`}
													>
														{recovery.source_status} →{' '}
														{recovery.destination_status} ·{' '}
														{recovery.reason}
													</p>
												))}
											</div>
										)}
										{errMsg && (
											<p className="outbox-item-error">
												<strong>
													{STATUS_ERROR_LABELS[conv.status] || 'Detalle:'}
												</strong>{' '}
												{errMsg}
											</p>
										)}
									</details>
									{!deliveryDisabled &&
										(conv.status === 'failed' ||
											conv.status === 'skipped' ||
											conv.status === 'ambiguous') && (
											<div className="outbox-item-actions">
												<button
													type="button"
													className="btn-secondary btn-small btn-requeue"
													disabled={processingConversions}
													onClick={() => {
														const reason = window
															.prompt(
																'Explica por qué debe recuperarse este evento:',
															)
															?.trim();
														if (!reason) return;
														if (
															!window.confirm(
																'¿Confirmas la recuperación técnica de este evento?',
															)
														)
															return;
														onRequeueEvent(conv.id, reason);
													}}
												>
													Recuperar evento
												</button>
											</div>
										)}
								</div>
							);
						},
					)
				)}
			</div>
		</div>
	);
};
export default OutboxLogList;
