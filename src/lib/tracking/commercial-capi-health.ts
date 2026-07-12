import type {
	CommercialDashboardSummary,
	CommercialHealthCheck,
	HealthSeverity,
} from '@/lib/tracking/commercial-dashboard';

function count(value: number): string {
	return new Intl.NumberFormat('es-MX').format(value);
}

function dateTime(value: string | null): string {
	if (!value) return 'Sin datos';
	return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(
		new Date(value),
	);
}

export function buildCapiHealthChecks(
	summary: CommercialDashboardSummary,
	capiStatus: HealthSeverity,
	capiModeLabel: string,
): CommercialHealthCheck[] {
	const counts = summary.conversionStatusCounts;
	return [
		{ label: 'Modo actual', status: capiStatus, value: capiModeLabel },
		{
			label: 'Pendientes',
			status: counts.pending === 0 ? 'correct' : 'attention',
			value: count(counts.pending),
		},
		{ label: 'Ignorados', status: 'safe-disabled', value: count(counts.skipped) },
		{
			label: 'Por confirmar',
			status: counts.ambiguous > 0 ? 'error' : 'correct',
			value: count(counts.ambiguous),
		},
		{
			label: 'Fallidos',
			status: counts.failed > 0 ? 'error' : 'correct',
			value: count(counts.failed),
		},
		{
			label: 'Órdenes sin fila de conversión',
			status: summary.ordersWithDepositMissingCapi > 0 ? 'attention' : 'correct',
			value: count(summary.ordersWithDepositMissingCapi),
			helper: 'Diagnóstico técnico; no forma parte de las alertas comerciales.',
		},
		{
			label: 'Pagos históricos sin Purchase',
			status:
				(summary.historicalPaidOrdersWithoutPurchase?.length ?? 0) > 0
					? 'attention'
					: 'correct',
			value: count(summary.historicalPaidOrdersWithoutPurchase?.length ?? 0),
			helper: 'Diagnóstico técnico para revisión del propietario; no repara ni reenvía eventos.',
		},
		{
			label: 'Reclamos vencidos',
			status: summary.staleSendingEvents > 0 ? 'error' : 'correct',
			value: count(summary.staleSendingEvents),
		},
		{
			label: 'Reintentos futuros',
			status: summary.futureRetryEvents > 0 ? 'attention' : 'correct',
			value: count(summary.futureRetryEvents),
		},
		{
			label: 'Conversiones sin orden',
			status: summary.outboxRowsMissingOrder > 0 ? 'error' : 'correct',
			value: count(summary.outboxRowsMissingOrder),
		},
		{
			label: 'Terminales con estado activo',
			status: summary.terminalEventsWithActiveDeliveryState > 0 ? 'error' : 'correct',
			value: count(summary.terminalEventsWithActiveDeliveryState),
		},
		{ label: 'Enviados', status: 'correct', value: count(counts.sent) },
		{
			label: 'Último intento',
			status: capiStatus,
			value: dateTime(summary.lastConversionAttemptAt),
		},
	];
}
