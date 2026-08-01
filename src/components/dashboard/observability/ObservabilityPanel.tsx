import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type {
	DeliveryStatus,
	ObservabilityEnvironment,
	ObservabilityNextStep,
	ObservabilityReasonCode,
	ObservabilitySignal,
	ObservabilitySnapshot,
	ObservabilitySummaryPayload,
	OperationalStatus,
	SnapshotFreshness,
} from '@/lib/observability/types';

const OPERATIONAL_LABELS: Record<OperationalStatus, string> = {
	HEALTHY: 'Saludable',
	ATTENTION: 'Requiere atención',
	BLOCKED: 'Bloqueado',
	UNVERIFIED: 'Sin verificar',
};
const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
	ALIGNED: 'Alineada',
	IN_PROGRESS: 'En progreso',
	ACTION_REQUIRED: 'Requiere acción',
	UNVERIFIED: 'Sin verificar',
};
const FRESHNESS_LABELS: Record<SnapshotFreshness, string> = {
	FRESH: 'Snapshot vigente',
	STALE: 'Último snapshot válido',
	PARTIAL: 'Cobertura parcial',
};
const ENVIRONMENT_LABELS: Record<ObservabilityEnvironment, string> = {
	local: 'Local',
	preview: 'Preview',
	production: 'Producción',
};
const REASON_LABELS: Record<ObservabilityReasonCode, string> = {
	ENVIRONMENT_UNAVAILABLE: 'No se pudo verificar el entorno',
	ENVIRONMENT_IDENTITY_CONFLICT: 'La identidad del entorno no coincide',
	SCHEMA_BEHIND: 'El esquema tiene migraciones pendientes',
	SCHEMA_DRIFT: 'El historial de esquema presenta divergencia',
	SCHEMA_UNAVAILABLE: 'No se pudo verificar el esquema',
	AUTHORITATIVE_COUNT_MISMATCH: 'Los conteos autoritativos son contradictorios',
	INVITATION_IDENTITY_CONFLICT: 'Hay identidades de invitación duplicadas',
	INVITATION_MISSING: 'Falta una invitación publicada',
	CANONICAL_INVALID: 'La definición canónica no es válida',
	DRAFT_INVALID: 'El borrador administrado no es válido',
	BASELINE_UNAVAILABLE: 'No hay un baseline verificable',
	BASELINE_VERSION_INCOMPATIBLE: 'La versión del baseline no es compatible',
	MANAGED_DRIFT: 'Hay divergencia administrada',
	DELIVERY_SCOPE_BLOCKED: 'El alcance autorizado bloquea la entrega',
	LIFECYCLE_SEQUENCE_INVALID: 'La secuencia de promoción es inválida',
	LIFECYCLE_METADATA_STALE: 'El ciclo de vida declarado está obsoleto',
	REQUIRED_PUBLISHED_ASSET_MISSING: 'Falta un asset requerido por contenido publicado',
	UNPUBLISHED_ASSET_PENDING: 'Hay assets pendientes para trabajo no publicado',
	ASSET_IDENTITY_UNVERIFIED: 'No se pudo verificar la identidad de los assets existentes',
	CANONICAL_CHANGE_PENDING: 'Hay un cambio canónico pendiente',
	VALID_DRAFT_PENDING: 'Hay un borrador válido pendiente de entrega',
	PARTIAL_PROMOTION: 'La promoción parcial sigue una secuencia válida',
	DETAIL_BUDGET_EXCEEDED: 'El detalle excede el presupuesto seguro',
	SNAPSHOT_REFRESH_FAILED: 'Falló la actualización del snapshot',
};
const NEXT_STEP_LABELS: Record<ObservabilityNextStep, string> = {
	NONE: 'No se requiere acción.',
	RETRY_PROBE: 'Vuelva a intentar la comprobación.',
	AUDIT_SCHEMA: 'Ejecute la auditoría protegida del esquema.',
	RESOLVE_IDENTITY: 'Resuelva la identidad antes de continuar.',
	VERIFY_BASELINE: 'Verifique o adopte el baseline administrado.',
	RECONCILE_MANAGED_CONTENT: 'Use el flujo de reconciliación administrada.',
	APPLY_LOCAL: 'Aplique primero en Local.',
	PROMOTE_PREVIEW: 'Promueva el cambio a Preview.',
	PROMOTE_PRODUCTION: 'Promueva el cambio a Producción.',
	FIX_CANONICAL_DEFINITION: 'Corrija la definición mediante el contrato existente.',
	UPDATE_LIFECYCLE_METADATA: 'Actualice el ciclo de vida canónico.',
	PROVIDE_REQUIRED_ASSET: 'Proporcione el asset mediante el flujo administrado.',
	VERIFY_ASSET_EVIDENCE: 'Verifique o adopte la identidad administrada de los assets.',
};

function formatDate(value: string): string {
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function signalKey(item: ObservabilitySignal, index: number): string {
	return `${item.reasonCode}:${item.environment ?? 'global'}:${item.slug ?? 'global'}:${index}`;
}

function refreshLabel(loading: boolean, canRefresh: boolean): string {
	if (loading) return 'Actualizando…';
	if (canRefresh) return 'Actualizar estado';
	return 'Actualización disponible en breve';
}

function SignalList({ items, empty }: { items: ObservabilitySignal[]; empty: string }) {
	if (items.length === 0) return <p className="observability__empty">{empty}</p>;
	return (
		<ul className="observability__issues">
			{items.map((item, index) => (
				<li key={signalKey(item, index)} className="observability__issue">
					<div className="observability__issue-meta">
						<span className="dashboard-badge">
							{item.impact === 'OPERATIONAL' ? 'Operacional' : 'Entrega'}
						</span>
						{item.environment ? (
							<span>{ENVIRONMENT_LABELS[item.environment]}</span>
						) : null}
						{item.slug ? <span>{item.slug}</span> : null}
					</div>
					<h3>{REASON_LABELS[item.reasonCode]}</h3>
					<p>{NEXT_STEP_LABELS[item.nextStep]}</p>
					{item.affectedFieldCount > 0 ? (
						<span>
							{item.affectedFieldCount} campos · {item.affectedSectionCount} secciones
						</span>
					) : null}
				</li>
			))}
		</ul>
	);
}

interface ObservabilityPanelProps {
	initialSummary?: ObservabilitySummaryPayload | null;
}

export default function ObservabilityPanel({ initialSummary = null }: ObservabilityPanelProps) {
	const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [canRefresh, setCanRefresh] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadDetail = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await dashboardApi.get<ObservabilitySnapshot>(
			'/api/dashboard/observabilidad?mode=detail',
			{ timeoutMs: 30_000 },
		);
		if (!result.ok) {
			setError(result.message || 'No se pudo actualizar el estado operacional.');
			setLoading(false);
			return;
		}
		setSnapshot(result.data);
		setCanRefresh(false);
		setLoading(false);
	}, []);

	useEffect(() => void loadDetail(), [loadDetail]);
	useEffect(() => {
		if (!snapshot || canRefresh) return;
		const delay = Math.max(0, new Date(snapshot.cache.refreshAfter).getTime() - Date.now());
		const timer = window.setTimeout(() => setCanRefresh(true), delay);
		return () => window.clearTimeout(timer);
	}, [canRefresh, snapshot]);

	const operationalStatus = snapshot?.operationalStatus ?? initialSummary?.operationalStatus;
	const deliveryStatus = snapshot?.deliveryStatus ?? initialSummary?.deliveryStatus;
	const counts = snapshot
		? {
				invitations: snapshot.invitationSummaries.length,
				issues: snapshot.issues.length,
				workItems: snapshot.workItems.length,
			}
		: initialSummary?.counts;

	return (
		<section className="observability" aria-labelledby="observability-title">
			<header className="observability__header">
				<div className="observability__heading">
					<h1 id="observability-title">Observabilidad operacional</h1>
					<p>Separe la salud del sistema del progreso de entrega.</p>
				</div>
				<button
					type="button"
					className="btn-secondary observability__refresh"
					onClick={() => void loadDetail()}
					disabled={loading || !canRefresh}
				>
					{refreshLabel(loading, canRefresh)}
				</button>
			</header>

			{error ? (
				<div className="observability__error" role="alert">
					<strong>No se pudo actualizar.</strong>
					<span>{error}</span>
				</div>
			) : null}
			{loading && !snapshot ? (
				<div className="observability__loading" role="status">
					<strong>Comprobando señales operacionales…</strong>
				</div>
			) : null}

			{operationalStatus && deliveryStatus ? (
				<section
					className="observability__summary"
					aria-labelledby="observability-summary-title"
				>
					<div className="observability__overall">
						<span className="observability__status" data-status={operationalStatus}>
							Salud: {OPERATIONAL_LABELS[operationalStatus]}
						</span>
						<span className="observability__status" data-status={deliveryStatus}>
							Entrega: {DELIVERY_LABELS[deliveryStatus]}
						</span>
						<div>
							<h2 id="observability-summary-title">Estado del sistema</h2>
							{counts ? (
								<p>
									{counts.issues} incidencias y {counts.workItems} trabajos
									esperados en {counts.invitations} invitaciones.
								</p>
							) : null}
						</div>
					</div>
					{snapshot ? (
						<div className="observability__freshness">
							<span>Generado {formatDate(snapshot.generatedAt)}</span>
							<span>{FRESHNESS_LABELS[snapshot.freshness]}</span>
						</div>
					) : null}
				</section>
			) : null}

			{snapshot ? (
				<>
					<section
						className="observability__section"
						aria-labelledby="observability-issues-title"
					>
						<div className="observability__section-heading">
							<h2 id="observability-issues-title">Atención requerida</h2>
							<span>{snapshot.issues.length}</span>
						</div>
						<SignalList
							items={snapshot.issues}
							empty="No hay incidencias confirmadas."
						/>
					</section>

					<section
						className="observability__section"
						aria-labelledby="observability-work-title"
					>
						<div className="observability__section-heading">
							<h2 id="observability-work-title">Trabajo de entrega</h2>
							<span>{snapshot.workItems.length}</span>
						</div>
						<SignalList
							items={snapshot.workItems}
							empty="No hay trabajo de entrega pendiente."
						/>
					</section>

					<section
						className="observability__section"
						aria-labelledby="observability-coverage-title"
					>
						<h2 id="observability-coverage-title">Cobertura por entorno</h2>
						<dl className="observability__coverage">
							{snapshot.environmentSummaries.map((item) => (
								<div key={item.environment}>
									<dt>{ENVIRONMENT_LABELS[item.environment]}</dt>
									<dd>
										{item.coverage === 'AVAILABLE'
											? 'Disponible'
											: 'No disponible'}
									</dd>
									<span>
										{OPERATIONAL_LABELS[item.operationalStatus]} ·{' '}
										{DELIVERY_LABELS[item.deliveryStatus]}
									</span>
									<span>
										{item.counts.invitations} invitaciones ·{' '}
										{item.counts.issues} incidencias
									</span>
								</div>
							))}
						</dl>
					</section>
				</>
			) : null}
		</section>
	);
}
