import { useCallback, useMemo, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	DISPOSABLE_LABELS,
	ENV_LABELS,
	READINESS_LABELS,
} from '@/lib/status/labels';
import {
	formatPublicationReason,
	formatSchemaMigrationsLabel,
	formatTransitionLabel,
} from '@/lib/status/presentation';
import type { CanonicalPromotionRow, CanonicalStatusView, TargetEnv } from '@/lib/status/types';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function formatWhen(value: string | null): string {
	if (!value) return 'sin marca de tiempo';
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function AttentionCard({ row }: { row: CanonicalPromotionRow }) {
	return (
		<article className="canonical-status__card">
			<header className="canonical-status__card-head">
				<h3>{row.title}</h3>
				<p>
					{formatTransitionLabel(row.source, row.destination)}
					<span className="canonical-status__action">{row.action}</span>
				</p>
			</header>
			<p>{formatPublicationReason(row.environments, row.reasonCode)}</p>
			{row.uncertaintyNotes.length > 0 ? (
				<p className="canonical-status__unverified">{row.uncertaintyNotes.join(' · ')}</p>
			) : null}
			<p>
				Evidencia: {row.evidence}
				{row.handoff.ownerApplyRequired ? (
					<strong className="canonical-status__owner"> OWNER / HITL REQUIRED</strong>
				) : null}
			</p>
			<p>
				Siguiente: {row.handoff.steps.join(' → ')}
			</p>
			{row.handoff.dryRunCommand ? (
				<pre className="canonical-status__command">{row.handoff.dryRunCommand}</pre>
			) : null}
			{row.handoff.ownerApplyRequired && row.handoff.applyCommand ? (
				<pre className="canonical-status__command">{row.handoff.applyCommand}</pre>
			) : null}
			<details className="canonical-status__details">
				<summary>Detalle técnico</summary>
				<dl>
					<dt>reasonCode</dt>
					<dd>{row.reasonCode}</dd>
					<dt>Estados</dt>
					<dd>
						Local {row.environments.local} · Preview {row.environments.preview} ·
						Producción {row.environments.production}
					</dd>
					{row.handoff.applyCommand && !row.handoff.ownerApplyRequired ? (
						<>
							<dt>Apply autorizado</dt>
							<dd>
								<pre className="canonical-status__command">{row.handoff.applyCommand}</pre>
							</dd>
						</>
					) : null}
				</dl>
			</details>
		</article>
	);
}

interface CanonicalStatusPanelProps {
	initialView?: CanonicalStatusView | null;
}

export default function CanonicalStatusPanel({ initialView = null }: CanonicalStatusPanelProps) {
	const [view, setView] = useState<CanonicalStatusView | null>(initialView);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [envFilter, setEnvFilter] = useState<'all' | TargetEnv>('all');
	const [domainFilter, setDomainFilter] = useState<'all' | 'schema' | 'content'>('all');
	const [showInSync, setShowInSync] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		const params = new URLSearchParams({ refresh: '1' });
		if (envFilter !== 'all') params.set('env', envFilter);
		if (domainFilter !== 'all') params.set('domain', domainFilter);
		const result = await dashboardApi.get<CanonicalStatusView>(
			`/api/dashboard/estado?${params.toString()}`,
			{ timeoutMs: 30_000 },
		);
		if (!result.ok) {
			setError(result.message || 'No se pudo actualizar el estado.');
			setLoading(false);
			return;
		}
		setView(result.data);
		setLoading(false);
	}, [domainFilter, envFilter]);

	const generated = useMemo(
		() => (view ? formatWhen(view.generatedAt) : null),
		[view],
	);

	return (
		<section className="canonical-status" aria-labelledby="canonical-status-title">
			<header className="canonical-status__header">
				<div>
					<h1 id="canonical-status-title">Estado operacional</h1>
					<p>
						Esquema, publicación e idoneidad de operación se muestran por separado.
						Esta vista no aplica migraciones ni promociones.
					</p>
				</div>
				<div className="canonical-status__controls">
					<label>
						Entorno
						<select
							value={envFilter}
							onChange={(event) =>
								setEnvFilter(event.target.value as 'all' | TargetEnv)
							}
						>
							<option value="all">Todos</option>
							<option value="local">Local</option>
							<option value="preview">Preview</option>
							<option value="production">Producción</option>
						</select>
					</label>
					<label>
						Dominio
						<select
							value={domainFilter}
							onChange={(event) =>
								setDomainFilter(event.target.value as 'all' | 'schema' | 'content')
							}
						>
							<option value="all">Todos</option>
							<option value="schema">Esquema</option>
							<option value="content">Publicación</option>
						</select>
					</label>
					<button
						type="button"
						className="btn-secondary"
						onClick={() => void refresh()}
						disabled={loading}
					>
						{loading ? 'Actualizando…' : 'Actualizar evidencia remota'}
					</button>
				</div>
			</header>

			{error ? (
				<div className="canonical-status__error" role="alert">
					<strong>No se pudo actualizar.</strong>
					<span>{error}</span>
				</div>
			) : null}

			<p className="canonical-status__announcer" aria-live="polite">
				{loading
					? 'Consultando bases persistentes…'
					: view
						? `Evidencia ${view.evidence}. Generado ${generated}.`
						: 'Sin evidencia remota. Actualice para consultar Local, Preview y Production.'}
			</p>

			{view ? (
				<>
					<table className="canonical-status__matrix">
						<caption>Resumen por entorno persistente</caption>
						<thead>
							<tr>
								<th>Entorno</th>
								<th>Esquema</th>
								<th>Invitaciones</th>
								<th>Preparación</th>
								<th>Evidencia</th>
							</tr>
						</thead>
						<tbody>
							{ENVS.map((env) => {
								const row = view.environments[env];
								return (
									<tr key={env}>
										<th scope="row">{ENV_LABELS[env]}</th>
										<td>
											{formatSchemaMigrationsLabel(
												row.schemaLifecycle,
												row.appliedCount,
												row.expectedCount,
											)}
										</td>
										<td>{row.invitationAttentionCount} requieren atención</td>
										<td>{READINESS_LABELS[row.schemaOperationReadiness]}</td>
										<td>
											{row.evidence}
											{row.probedAt ? ` · ${formatWhen(row.probedAt)}` : ''}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					<aside className="canonical-status__disposable" aria-labelledby="disposable-title">
						<h2 id="disposable-title">Prueba disposable-test</h2>
						<p>
							Disposable proof: {DISPOSABLE_LABELS[view.disposableProof.status]}
						</p>
						<p>Requerida antes de futuras operaciones de migración.</p>
						<p>
							No indica deuda de esquema en Local, Preview o Production. Evidencia:{' '}
							{view.disposableProof.evidence}.
						</p>
					</aside>

					<section aria-labelledby="publication-title">
						<div className="canonical-status__section-head">
							<h2 id="publication-title">Cola de publicación</h2>
							<p>
								Registro: {view.registryCount}. En sync: {view.inSyncCount}. Atención:{' '}
								{view.promotions.length}. Filas activas en DB (no son el registro):
								Local {view.activeRowCounts.local} · Preview {view.activeRowCounts.preview}{' '}
								· Production {view.activeRowCounts.production}.
							</p>
						</div>
						{view.promotions.length === 0 ? (
							<p>No hay invitaciones del registro que requieran acción.</p>
						) : (
							<div className="canonical-status__queue">
								{view.promotions.map((row) => (
									<AttentionCard key={row.slug} row={row} />
								))}
							</div>
						)}
						{view.inSyncCount > 0 ? (
							<details
								className="canonical-status__details"
								open={showInSync}
								onToggle={(event) =>
									setShowInSync((event.target as HTMLDetailsElement).open)
								}
							>
								<summary>En sync ({view.inSyncCount})</summary>
								<ul>
									{view.inSyncSlugs.map((slug) => (
										<li key={slug}>{slug}</li>
									))}
								</ul>
							</details>
						) : null}
					</section>
				</>
			) : null}
		</section>
	);
}
