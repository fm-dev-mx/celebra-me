import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type {
	EvidenceFreshness,
	ObservabilityAction,
	ObservabilityHealthDomain,
	ObservabilityIssueDomain,
	ObservabilityIssueSeverity,
	ObservabilitySnapshot,
	OverallStatus,
} from '@/lib/observability/types';

const OVERALL_LABELS: Record<OverallStatus, string> = {
	HEALTHY: 'Saludable',
	ATTENTION: 'Requiere atención',
	BLOCKED: 'Bloqueado',
	UNVERIFIED: 'Sin verificar',
};

const SEVERITY_LABELS: Record<ObservabilityIssueSeverity, string> = {
	blocking: 'Bloqueo',
	warning: 'Atención',
	unverified: 'Sin verificar',
};

const DOMAIN_LABELS: Record<ObservabilityIssueDomain, string> = {
	environment: 'Entorno',
	invitation: 'Invitación',
	migration: 'Migraciones',
	asset: 'Assets',
	validation: 'Validación',
	source: 'Fuente',
	data_quality: 'Calidad de datos',
};

const HEALTH_LABELS: Record<ObservabilityHealthDomain, string> = {
	environments: 'Entornos',
	invitations: 'Invitaciones',
	migrations: 'Migraciones',
	assets: 'Assets',
	validations: 'Validaciones',
};

const FRESHNESS_LABELS: Record<EvidenceFreshness, string> = {
	PASS: 'Vigente',
	FAIL: 'Falló',
	STALE: 'Obsoleta',
	NOT_RUN: 'Sin ejecutar',
	INVALID: 'Inválida',
};

function formatDate(value: string | null): string {
	if (!value) return 'Sin evidencia';
	return new Date(value).toLocaleString('es-MX', {
		dateStyle: 'short',
		timeStyle: 'short',
	});
}

export default function ObservabilityPanel() {
	const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [canRefresh, setCanRefresh] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await dashboardApi.get<ObservabilitySnapshot>(
			'/api/dashboard/observabilidad',
			{ timeoutMs: 35_000 },
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

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (!snapshot || canRefresh) return;
		const delay = Math.max(0, new Date(snapshot.cache.refreshAfter).getTime() - Date.now());
		const timer = window.setTimeout(() => setCanRefresh(true), delay);
		return () => window.clearTimeout(timer);
	}, [canRefresh, snapshot]);

	const actions = new Map<string, ObservabilityAction>(
		snapshot?.recommendedActions.map((action) => [action.id, action]) ?? [],
	);

	return (
		<section className="observability" aria-labelledby="observability-title">
			<header className="observability__header">
				<div className="observability__heading">
					<h1 id="observability-title">Observabilidad operacional</h1>
					<p>Detecte inconsistencias antes de validar, publicar o promover contenido.</p>
				</div>
				<button
					type="button"
					className="btn-secondary observability__refresh"
					onClick={() => void load()}
					disabled={loading || (!canRefresh && snapshot !== null)}
				>
					{loading
						? 'Actualizando…'
						: canRefresh
							? 'Actualizar estado'
							: 'Actualización disponible en breve'}
				</button>
			</header>

			<div className="observability__announcer" aria-live="polite" aria-atomic="true">
				{loading && snapshot
					? 'Actualizando el estado sin ocultar la evidencia anterior.'
					: null}
			</div>

			{error ? (
				<div className="observability__error" role="alert">
					<strong>No se pudo actualizar.</strong>
					<span>{error}</span>
					{snapshot ? <span>Se conserva la última evidencia visible.</span> : null}
				</div>
			) : null}

			{loading && !snapshot ? (
				<div className="observability__loading" role="status">
					<strong>Comprobando señales operacionales…</strong>
					<span>La primera lectura puede tardar algunos segundos.</span>
				</div>
			) : null}

			{snapshot ? (
				<>
					<section
						className="observability__summary"
						aria-labelledby="observability-summary-title"
					>
						<div className="observability__overall">
							<span
								className="observability__status"
								data-status={snapshot.overallStatus}
							>
								{OVERALL_LABELS[snapshot.overallStatus]}
							</span>
							<div>
								<h2 id="observability-summary-title">Estado del sistema</h2>
								<p>
									{snapshot.issues.length === 0
										? 'No se detectaron inconsistencias en las señales disponibles.'
										: `${snapshot.issues.length} señales requieren revisión.`}
								</p>
							</div>
						</div>
						<div className="observability__freshness">
							<span>Generado {formatDate(snapshot.generatedAt)}</span>
							<span>
								{snapshot.cache.state === 'fresh'
									? 'Snapshot vigente'
									: 'Último snapshot válido · actualización degradada'}
							</span>
						</div>
					</section>

					<section
						className="observability__section"
						aria-labelledby="observability-issues-title"
					>
						<div className="observability__section-heading">
							<h2 id="observability-issues-title">Atención requerida</h2>
							<span>{snapshot.issues.length}</span>
						</div>
						{snapshot.issues.length === 0 ? (
							<p className="observability__empty">No hay incidencias accionables.</p>
						) : (
							<ul className="observability__issues">
								{snapshot.issues.map((item) => (
									<li key={item.id} className="observability__issue">
										<div className="observability__issue-meta">
											<span
												className="dashboard-badge"
												data-severity={item.severity}
											>
												{SEVERITY_LABELS[item.severity]}
											</span>
											<span>{DOMAIN_LABELS[item.domain]}</span>
											<span>{item.scope}</span>
										</div>
										<h3>{item.title}</h3>
										<p>{item.description}</p>
										{item.actionIds.map((actionId) => {
											const action = actions.get(actionId);
											return action ? (
												<div
													key={action.id}
													className="observability__action"
												>
													<strong>{action.label}</strong>
													<code>{action.command}</code>
													<span>{action.reason}</span>
												</div>
											) : null;
										})}
									</li>
								))}
							</ul>
						)}
					</section>

					<div className="observability__supporting">
						<section
							className="observability__section"
							aria-labelledby="observability-coverage-title"
						>
							<h2 id="observability-coverage-title">Cobertura</h2>
							<dl className="observability__coverage">
								{(
									Object.entries(snapshot.health) as [
										ObservabilityHealthDomain,
										(typeof snapshot.health)[ObservabilityHealthDomain],
									][]
								).map(([domain, counts]) => (
									<div key={domain}>
										<dt>{HEALTH_LABELS[domain]}</dt>
										<dd>
											<strong>{counts.ok}</strong> de {counts.total} sin
											incidencias
										</dd>
										{counts.total - counts.ok > 0 ? (
											<span>
												{counts.blocking} bloqueos · {counts.warning}{' '}
												atención · {counts.unverified} sin verificar
											</span>
										) : (
											<span>Cobertura completa</span>
										)}
									</div>
								))}
							</dl>
						</section>

						<section
							className="observability__section"
							aria-labelledby="observability-evidence-title"
						>
							<h2 id="observability-evidence-title">Evidencia</h2>
							<ul className="observability__evidence">
								{snapshot.validationEvidence.map((view) => (
									<li key={view.type}>
										<div>
											<strong>
												{view.type === 'regression'
													? 'Regresión'
													: 'Capturas'}
											</strong>
											<span>{formatDate(view.completedAt)}</span>
										</div>
										<span className="dashboard-badge">
											{FRESHNESS_LABELS[view.freshness]}
										</span>
										<span>
											{view.total === null
												? 'Sin resultados'
												: `${view.passed ?? 0}/${view.total} correctas`}
										</span>
									</li>
								))}
							</ul>
						</section>
					</div>

					<details className="observability__context">
						<summary>Contexto técnico</summary>
						<dl>
							<div>
								<dt>Rama</dt>
								<dd>{snapshot.source.branch ?? 'Sin verificar'}</dd>
							</div>
							<div>
								<dt>Revisión</dt>
								<dd>{snapshot.source.commitShaShort ?? 'Sin verificar'}</dd>
							</div>
							<div>
								<dt>Árbol de trabajo</dt>
								<dd>
									{snapshot.source.workingTreeDirty === null
										? 'Sin verificar'
										: snapshot.source.workingTreeDirty
											? 'Con cambios'
											: 'Limpio'}
								</dd>
							</div>
						</dl>
					</details>
				</>
			) : null}
		</section>
	);
}
