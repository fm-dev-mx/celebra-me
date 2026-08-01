import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type {
	AssetHealthState,
	EvidenceFreshness,
	ObservabilitySnapshot,
	OverallStatus,
} from '@/lib/observability/types';

const OVERALL_LABELS: Record<OverallStatus, string> = {
	HEALTHY: 'Saludable',
	ATTENTION: 'Atención',
	BLOCKED: 'Bloqueado',
	UNVERIFIED: 'Sin verificar',
};

const FRESHNESS_LABELS: Record<EvidenceFreshness, string> = {
	PASS: 'Vigente (PASS)',
	FAIL: 'Falló (FAIL)',
	STALE: 'Obsoleta (STALE)',
	NOT_RUN: 'Sin ejecutar (NOT_RUN)',
	INVALID: 'Inválida (INVALID)',
};

const ASSET_LABELS: Record<AssetHealthState, string> = {
	OK: 'OK',
	PARTIAL: 'Parcial',
	MISSING: 'Faltante',
	REMOTE_REFERENCE: 'Referencia remota',
	UNVERIFIED: 'Sin verificar',
};

const ENV_LABELS = {
	local: 'Local',
	preview: 'Preview',
	production: 'Producción',
} as const;

function shortSha(sha: string | null | undefined): string {
	if (!sha) return '—';
	return sha.slice(0, 10);
}

function formatPending(pending: string[] | '—'): string {
	if (pending === '—') return '—';
	if (pending.length === 0) return '0';
	return `${pending.length}: ${pending.slice(0, 3).join(', ')}${pending.length > 3 ? '…' : ''}`;
}

function StatusBadge({ value }: { value: string }) {
	return (
		<span className="observability__badge" title={value}>
			{value}
		</span>
	);
}

export default function ObservabilityPanel() {
	const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await dashboardApi.get<ObservabilitySnapshot>(
			'/api/dashboard/observabilidad',
		);
		if (!result.ok) {
			setError(result.message || 'No se pudo cargar el estado operacional.');
			setSnapshot(null);
			setLoading(false);
			return;
		}
		setSnapshot(result.data);
		setLoading(false);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const assetBySlug = new Map(snapshot?.assets.map((row) => [row.slug, row]) ?? []);

	return (
		<section className="observability" aria-live="polite">
			<header className="observability__header">
				<div>
					<p className="observability__eyebrow">Solo lectura · entorno Local</p>
					<h1>Observabilidad operacional</h1>
					{snapshot ? (
						<p className="observability__meta">
							<span>
								Estado:{' '}
								<span
									className="observability__status"
									data-status={snapshot.overallStatus}
									aria-label={`Estado general: ${OVERALL_LABELS[snapshot.overallStatus]} (${snapshot.overallStatus})`}
								>
									{OVERALL_LABELS[snapshot.overallStatus]} (
									{snapshot.overallStatus})
								</span>
							</span>
							<span>Rama: {snapshot.source.branch ?? '—'}</span>
							<span>HEAD: {shortSha(snapshot.source.commitSha)}</span>
							<span>
								Árbol:{' '}
								{snapshot.source.workingTreeDirty === null
									? '—'
									: snapshot.source.workingTreeDirty
										? 'con cambios'
										: 'limpio'}
							</span>
							<span>
								Generado:{' '}
								{new Date(snapshot.generatedAt).toLocaleString('es-MX', {
									dateStyle: 'short',
									timeStyle: 'medium',
								})}
							</span>
						</p>
					) : null}
				</div>
				<div className="observability__actions">
					<button
						type="button"
						className="dashboard-button"
						onClick={() => void load()}
						disabled={loading}
					>
						{loading ? 'Actualizando…' : 'Actualizar estado'}
					</button>
				</div>
			</header>

			<p className="observability__muted">
				Esta vista no ejecuta pruebas, capturas, migraciones ni mutaciones. La evidencia
				proviene del último snapshot local generado por los comandos canónicos.
			</p>

			{error ? (
				<div className="observability__error" role="alert">
					{error}
				</div>
			) : null}

			{loading && !snapshot ? (
				<p className="observability__muted">Cargando estado operacional…</p>
			) : null}

			{snapshot ? (
				<>
					{snapshot.degradedNotes.length > 0 ? (
						<section className="observability__section" aria-label="Degradaciones">
							<h2>Señales degradadas</h2>
							<ul className="observability__note-list">
								{snapshot.degradedNotes.map((note) => (
									<li key={note}>{note}</li>
								))}
							</ul>
						</section>
					) : null}

					<section className="observability__section" aria-label="Matriz de entornos">
						<h2>Entornos</h2>
						<div className="observability__table-wrap">
							<table className="observability__table">
								<thead>
									<tr>
										<th scope="col">Señal</th>
										{snapshot.environments.map((env) => (
											<th key={env.environment} scope="col">
												{ENV_LABELS[env.environment]}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									<tr>
										<th scope="row">Conexión</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-conn`}>
												<StatusBadge value={env.connection} />
											</td>
										))}
									</tr>
									<tr>
										<th scope="row">Identidad runtime</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-id`}>
												{env.runtimeIdentity}
											</td>
										))}
									</tr>
									<tr>
										<th scope="row">Ciclo de esquema</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-schema`}>
												<StatusBadge value={env.schemaLifecycle} />
											</td>
										))}
									</tr>
									<tr>
										<th scope="row">Filas activas (todas)</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-rows`}>
												{env.activeInvitationRows}
											</td>
										))}
									</tr>
									<tr>
										<th scope="row">Corpus soportado</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-corpus`}>
												{env.supportedCorpusPresence}
											</td>
										))}
									</tr>
									<tr>
										<th scope="row">Paridad render-efectiva</th>
										{snapshot.environments.map((env) => (
											<td key={`${env.environment}-parity`}>
												<StatusBadge value={env.renderEffectiveParity} />
											</td>
										))}
									</tr>
								</tbody>
							</table>
						</div>
						<p className="observability__muted">
							Las filas activas incluyen demos y clientes; el corpus soportado son los
							13 clientes del Local Render Corpus. La salud de assets es evidencia a
							nivel corpus (inventario Local/repositorio), no una verificación
							independiente por entorno remoto.
						</p>
					</section>

					<section
						className="observability__section"
						aria-label="Salud de assets del corpus"
					>
						<h2>Assets del corpus (inventario Local)</h2>
						<div className="observability__table-wrap">
							<table className="observability__table">
								<thead>
									<tr>
										<th scope="col">Invitación</th>
										<th scope="col">Estrategia</th>
										<th scope="col">Estado</th>
										<th scope="col">Archivos locales</th>
										<th scope="col">Refs remotas</th>
									</tr>
								</thead>
								<tbody>
									{snapshot.assets.map((row) => (
										<tr key={row.slug}>
											<td>{row.slug}</td>
											<td>
												<StatusBadge value={row.assetStrategy} />
											</td>
											<td>
												<StatusBadge value={ASSET_LABELS[row.status]} />
											</td>
											<td>{row.localFileCount}</td>
											<td>{row.remoteMediaReferenceCount}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section className="observability__section" aria-label="Matriz de invitaciones">
						<h2>Invitaciones del corpus ({snapshot.invitations.length})</h2>
						<div className="observability__table-wrap">
							<table className="observability__table">
								<thead>
									<tr>
										<th scope="col">Invitación</th>
										<th scope="col">Referencia</th>
										<th scope="col">Local</th>
										<th scope="col">Preview</th>
										<th scope="col">Producción</th>
										<th scope="col">Assets</th>
									</tr>
								</thead>
								<tbody>
									{snapshot.invitations.map((row) => {
										const asset = assetBySlug.get(row.slug);
										return (
											<tr key={row.slug}>
												<td>
													<strong>{row.slug}</strong>
													<br />
													<span className="observability__muted">
														{row.eventType}
														{row.themeId ? ` · ${row.themeId}` : ''}
													</span>
												</td>
												<td>
													<StatusBadge
														value={row.referenceClassification}
													/>
												</td>
												<td>
													<StatusBadge
														value={row.environments.local.status}
													/>
												</td>
												<td>
													<StatusBadge
														value={row.environments.preview.status}
													/>
												</td>
												<td>
													<StatusBadge
														value={row.environments.production.status}
													/>
												</td>
												<td>
													<StatusBadge
														value={
															asset
																? ASSET_LABELS[asset.status]
																: 'Sin verificar'
														}
													/>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>

					<section className="observability__section" aria-label="Migraciones">
						<h2>Ciclo de migraciones</h2>
						<div className="observability__table-wrap">
							<table className="observability__table">
								<thead>
									<tr>
										<th scope="col">Fuente</th>
										<th scope="col">Aplicadas</th>
										<th scope="col">Pendientes</th>
										<th scope="col">Estado</th>
									</tr>
								</thead>
								<tbody>
									{snapshot.migrations.map((row) => (
										<tr key={row.environment}>
											<td>
												{row.environment === 'repository'
													? 'Repositorio'
													: ENV_LABELS[row.environment]}
											</td>
											<td>{row.appliedCount ?? '—'}</td>
											<td>{formatPending(row.pending)}</td>
											<td>
												<StatusBadge value={row.schemaLifecycle} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section
						className="observability__section"
						aria-label="Evidencia de validación"
					>
						<h2>Evidencia de validación</h2>
						<div className="observability__table-wrap">
							<table className="observability__table">
								<thead>
									<tr>
										<th scope="col">Tipo</th>
										<th scope="col">Frescura</th>
										<th scope="col">Comando</th>
										<th scope="col">Resultado</th>
										<th scope="col">Detalle</th>
									</tr>
								</thead>
								<tbody>
									{(
										[
											snapshot.validation.regression,
											snapshot.validation.screenshots,
										] as const
									).map((view) => (
										<tr key={view.validationType}>
											<td>{view.validationType}</td>
											<td>
												<StatusBadge
													value={FRESHNESS_LABELS[view.freshness]}
												/>
											</td>
											<td>
												<code>
													{view.snapshot?.command ??
														(view.validationType === 'regression'
															? 'pnpm test:local-render-corpus'
															: 'pnpm screenshot:local-render-corpus')}
												</code>
											</td>
											<td>
												{view.snapshot
													? `${view.snapshot.status} (${view.snapshot.passed}/${view.snapshot.total})`
													: '—'}
											</td>
											<td>{view.detail ?? '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section className="observability__section" aria-label="Comandos recomendados">
						<h2>Comandos recomendados (solo texto)</h2>
						<div className="observability__commands">
							{snapshot.recommendedCommands.map((cmd) => (
								<div key={cmd.id} className="observability__command">
									<strong>{cmd.label}</strong>
									<span className="observability__muted">{cmd.reason}</span>
									<code>{cmd.command}</code>
								</div>
							))}
						</div>
					</section>
				</>
			) : null}
		</section>
	);
}
