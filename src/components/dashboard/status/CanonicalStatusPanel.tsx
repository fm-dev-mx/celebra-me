import { useCallback, useMemo, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	AUTHORIZATION_LABELS,
	DIAGNOSTIC_LABELS,
	DISPOSABLE_LABELS,
	ENV_LABELS,
	EVIDENCE_LABELS,
	FRESHNESS_LABELS,
	MIGRATION_PRESENCE_LABELS,
	PUBLICATION_ACTION_LABELS,
	PUBLICATION_REASON_LABELS,
	READINESS_LABELS,
	SEMANTIC_LABELS,
} from '@/lib/status/labels';
import {
	formatSchemaMigrationsLabel,
	formatTransitionLabel,
} from '@/lib/status/presentation';
import {
	authorizationRemediation,
	diagnosticRemediation,
	disposableRemediation,
	evidenceRemediation,
	invitationAttentionRemediation,
	publicationQueueRemediation,
	publicationRemediation,
	readinessRemediation,
	schemaRemediation,
	type OperatorRemediation,
} from '@/lib/status/semantics';
import type {
	CanonicalDiagnostic,
	CanonicalPromotionRow,
	CanonicalStatusView,
	MigrationPresence,
	RecentMigrationRecord,
	StatusSemantic,
	TargetEnv,
} from '@/lib/status/types';
import { copyToClipboard } from '@/utils/clipboard';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function formatWhen(value: string | null): string {
	if (!value) return 'sin marca de tiempo';
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function CopyableCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="canonical-status__copy">
			<pre className="canonical-status__command">{command}</pre>
			<button
				type="button"
				className="btn-ghost"
				onClick={() => {
					void copyToClipboard(command).then((ok) => {
						if (!ok) return;
						setCopied(true);
						window.setTimeout(() => setCopied(false), 1600);
					});
				}}
			>
				{copied ? 'Copiado' : 'Copiar'}
			</button>
		</div>
	);
}

function SemanticBadge({ semantic }: { semantic: StatusSemantic }) {
	return (
		<span className={`canonical-status__badge canonical-status__badge--${semantic}`}>
			{SEMANTIC_LABELS[semantic]}
		</span>
	);
}

function StepTypeBadge({ stepType }: { stepType: string }) {
	const modifiers: Record<string, string> = {
		Diagnose: 'canonical-status__badge--amber',
		Verify: 'canonical-status__badge--cyan',
		Apply: 'canonical-status__badge--green',
		'Manual/HITL': 'canonical-status__badge--red',
	};
	const cls = modifiers[stepType] ?? 'canonical-status__badge--neutral';
	return <span className={`canonical-status__badge ${cls}`}>{stepType}</span>;
}

function RemediationDetails({
	remediation,
	summary,
}: {
	remediation: OperatorRemediation;
	summary: string;
}) {
	const hasOptional = Boolean(remediation.optionalDiagnosticCommand);
	const actionable = remediation.semantic === 'unverified' || remediation.semantic === 'blocked';
	if (!actionable && !hasOptional) return null;
	return (
		<details className="canonical-status__remediation">
			<summary>{summary}</summary>
			<div className="canonical-status__remediation-content">
				{actionable ? (
					<p className="canonical-status__remediation-action">
						{remediation.stepType ? <StepTypeBadge stepType={remediation.stepType} /> : null}
						<span>{remediation.nextAction}</span>
					</p>
				) : null}
				{remediation.noCanonicalRemediation ? (
					<p className="canonical-status__gap">
						No hay remediación canónica directa para este elemento.
					</p>
				) : null}
				{remediation.command ? (
					<div className="canonical-status__remediation-cmd">
						<CopyableCommand command={remediation.command} />
					</div>
				) : null}
				{remediation.optionalDiagnosticCommand ? (
					<div className="canonical-status__optional-diagnostic">
						<p>Diagnóstico opcional (no remedia UNKNOWN):</p>
						<CopyableCommand command={remediation.optionalDiagnosticCommand} />
					</div>
				) : null}
			</div>
		</details>
	);
}

function Indicator({
	remediation,
	label,
	detail,
}: {
	remediation: OperatorRemediation;
	label: string;
	detail?: string;
}) {
	return (
		<div className="canonical-status__indicator">
			<div className="canonical-status__indicator-head">
				<SemanticBadge semantic={remediation.semantic} />
				<span>{label}</span>
			</div>
			{detail ? <p className="canonical-status__indicator-detail">{detail}</p> : null}
			<RemediationDetails remediation={remediation} summary="Siguiente paso" />
		</div>
	);
}

function AttentionCard({ row }: { row: CanonicalPromotionRow }) {
	const remediation = publicationRemediation(row);
	return (
		<article className={`canonical-status__card canonical-status__card--${remediation.semantic}`}>
			<header className="canonical-status__card-head">
				<h3>
					{row.title} <span className="canonical-status__slug">({row.slug})</span>
				</h3>
				<p className="canonical-status__card-badges">
					<span>{formatTransitionLabel(row.source, row.destination)}</span>
					<span className="canonical-status__action">{PUBLICATION_ACTION_LABELS[row.action]}</span>
					{row.handoff.dryRunCommand ? (
						<StepTypeBadge stepType={row.handoff.dryRunStepType} />
					) : null}
					{row.handoff.applyCommand ? (
						<>
							<span>➔</span>
							<StepTypeBadge stepType={row.handoff.applyStepType} />
						</>
					) : null}
					<SemanticBadge semantic={remediation.semantic} />
				</p>
			</header>
			<p className="canonical-status__reason">{PUBLICATION_REASON_LABELS[row.reasonCode]}</p>
			{row.uncertaintyNotes.length > 0 ? (
				<p className="canonical-status__unverified">{row.uncertaintyNotes.join(' · ')}</p>
			) : null}
			<p className="canonical-status__evidence-line">
				Evidencia: <strong>{EVIDENCE_LABELS[row.evidence]}</strong>
				{row.handoff.ownerApplyRequired ? (
					<strong className="canonical-status__owner"> 🔒 OWNER / HITL REQUIRED</strong>
				) : null}
			</p>
			<p className="canonical-status__next-text">Paso inmediato: {remediation.nextAction}</p>

			{remediation.noCanonicalRemediation ? (
				<p className="canonical-status__gap">No hay una remediación canónica directa disponible.</p>
			) : null}

			{row.handoff.dryRunCommand ? (
				<div className="canonical-status__op-block">
					<p className="canonical-status__command-label">
						<StepTypeBadge stepType={row.handoff.dryRunStepType} />
						<span>
							{row.handoff.dryRunStepType === 'Diagnose'
								? 'Diagnóstico (solo lectura):'
								: 'Verificar (dry-run):'}
						</span>
					</p>
					<CopyableCommand command={row.handoff.dryRunCommand} />
				</div>
			) : null}

			{row.handoff.optionalDiagnosticCommand ? (
				<div className="canonical-status__optional-diagnostic">
					<p className="canonical-status__command-label">
						<span>Diagnóstico opcional (no remedia UNKNOWN):</span>
					</p>
					<CopyableCommand command={row.handoff.optionalDiagnosticCommand} />
				</div>
			) : null}

			{row.handoff.applyCommand ? (
				<div className="canonical-status__op-block">
					<p className="canonical-status__command-label">
						<StepTypeBadge stepType={row.handoff.applyStepType} />
						<span>
							{row.handoff.ownerApplyRequired
								? 'Aplicar (🔒 OWNER / HITL en TTY):'
								: 'Aplicar (autorizado):'}
						</span>
					</p>
					<CopyableCommand command={row.handoff.applyCommand} />
				</div>
			) : null}

			<p className="canonical-status__verify">Queda verificado cuando: {remediation.verifyWhen}</p>
			<details className="canonical-status__details">
				<summary>Detalle técnico</summary>
				<dl>
					<dt>Acción canónica</dt>
					<dd>{row.action}</dd>
					<dt>reasonCode</dt>
					<dd>{row.reasonCode}</dd>
					<dt>Estados</dt>
					<dd>
						Local {row.environments.local} · Preview {row.environments.preview} ·
						Producción {row.environments.production}
					</dd>
				</dl>
			</details>
		</article>
	);
}

function DiagnosticsList({ items }: { items: CanonicalDiagnostic[] }) {
	if (items.length === 0) {
		return <p>No hay diagnósticos adicionales. La cola de publicación es la autoridad operativa.</p>;
	}
	return (
		<ul className="canonical-status__diagnostics">
			{items.map((item, index) => {
				const remediation = diagnosticRemediation(item);
				return (
					<li key={`${item.code}:${item.environment ?? ''}:${item.slug ?? ''}:${index}`}>
						<div className="canonical-status__indicator-head">
							<SemanticBadge semantic={remediation.semantic} />
							<strong>{DIAGNOSTIC_LABELS[item.code]}</strong>
						</div>
						<p>
							{[item.environment ? ENV_LABELS[item.environment] : null, item.slug]
								.filter(Boolean)
								.join(' · ')}
						</p>
						<p className="canonical-status__diagnostic-provenance">
							Dominio: {item.domain === 'schema' ? 'Esquema' : 'Publicación'} · Evidencia:{' '}
							{EVIDENCE_LABELS[item.evidence]}
						</p>
						<p>{item.cause}</p>
						<RemediationDetails remediation={remediation} summary="Qué hacer" />
						{item.semanticPaths.length > 0 ? (
							<details>
								<summary>Ver detalle semántico</summary>
								<p>{item.semanticPaths.join(', ')}</p>
							</details>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

function MigrationPresenceCell({
	presence,
	verifiedAt,
}: {
	presence: MigrationPresence;
	verifiedAt: string | null;
}) {
	const modifier =
		presence === 'APPLIED' ? 'yes' : presence === 'NOT_APPLIED' ? 'no' : 'unverified';
	return (
		<span className={`canonical-status__applied-badge canonical-status__applied-badge--${modifier}`}>
			{MIGRATION_PRESENCE_LABELS[presence]}
			{verifiedAt && presence !== 'UNVERIFIED' ? (
				<span className="canonical-status__probe-time"> Sonda: {formatWhen(verifiedAt)}</span>
			) : null}
		</span>
	);
}

function RecentMigrationsSection({ items }: { items?: RecentMigrationRecord[] }) {
	if (!items || items.length === 0) return null;
	return (
		<section className="canonical-status__recent-migrations" aria-labelledby="migrations-title">
			<div className="canonical-status__section-head">
				<h2 id="migrations-title">Migraciones recientes autoritativas</h2>
				<p>
					Registro de <code>supabase_migrations.schema_migrations</code> en cada base de datos
					persistente (últimas 5 migraciones). La marca de tiempo es la de la sonda, no de
					aplicación.
				</p>
			</div>
			<table className="canonical-status__matrix">
				<thead>
					<tr>
						<th>Versión / Nombre</th>
						<th>Local</th>
						<th>Preview</th>
						<th>Producción</th>
					</tr>
				</thead>
				<tbody>
					{items.map((rec) => (
						<tr key={rec.version}>
							<th scope="row">
								<strong>{rec.version}</strong>
								{rec.name ? (
									<span className="canonical-status__migration-name"> · {rec.name}</span>
								) : null}
							</th>
							<td>
								<MigrationPresenceCell
									presence={rec.presence.local}
									verifiedAt={rec.verifiedAt.local}
								/>
							</td>
							<td>
								<MigrationPresenceCell
									presence={rec.presence.preview}
									verifiedAt={rec.verifiedAt.preview}
								/>
							</td>
							<td>
								<MigrationPresenceCell
									presence={rec.presence.production}
									verifiedAt={rec.verifiedAt.production}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
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
	const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
	const [showInSync, setShowInSync] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		const params = new URLSearchParams({ refresh: '1' });
		if (envFilter !== 'all') params.set('env', envFilter);
		if (domainFilter !== 'all') params.set('domain', domainFilter);
		if (includeDiagnostics) params.set('diagnostics', '1');
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
	}, [domainFilter, envFilter, includeDiagnostics]);

	const generated = useMemo(() => (view ? formatWhen(view.generatedAt) : null), [view]);
	const queueRemediation = view ? publicationQueueRemediation(view) : null;

	const freshnessLabel = useMemo(() => {
		if (!view?.freshnessMeta) return null;
		const when = formatWhen(view.freshnessMeta.lastVerifiedAt);
		switch (view.freshnessMeta.status) {
			case 'LIVE':
				return `${FRESHNESS_LABELS.LIVE} (sonda de esta consulta)`;
			case 'CACHED':
				return `${FRESHNESS_LABELS.CACHED} (verificado ${when})`;
			case 'STALE':
				return `${FRESHNESS_LABELS.STALE} (verificado ${when}; revalide para evidencia vigente)`;
			case 'REVALIDATING':
				return `${FRESHNESS_LABELS.REVALIDATING}…`;
			default:
				return FRESHNESS_LABELS.UNVERIFIED;
		}
	}, [view]);

	return (
		<section className="canonical-status" aria-labelledby="canonical-status-title">
			<header className="canonical-status__header">
				<div>
					<h1 id="canonical-status-title">Estado operacional</h1>
					<p>
						Esquema, publicación, idoneidad de operación y autorización de Production se
						muestran por separado. Esta vista no aplica migraciones ni promociones. El color
						lo determina la evidencia, no el hecho de consultar.
					</p>
					{freshnessLabel ? (
						<p
							className="canonical-status__freshness"
							data-freshness={view?.freshnessMeta?.status ?? 'UNVERIFIED'}
						>
							<strong>Frescura de evidencia:</strong> {freshnessLabel}
						</p>
					) : null}
				</div>
				<div className="canonical-status__controls">
					<label>
						Entorno
						<select
							value={envFilter}
							onChange={(event) => setEnvFilter(event.target.value as 'all' | TargetEnv)}
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
					<label className="canonical-status__check">
						<input
							type="checkbox"
							checked={includeDiagnostics}
							onChange={(event) => setIncludeDiagnostics(event.target.checked)}
						/>
						Diagnóstico avanzado
					</label>
					<button
						type="button"
						className="btn-secondary"
						onClick={() => void refresh()}
						disabled={loading}
						title="Revalida evidencia remota de solo lectura."
					>
						{loading ? 'Consultando evidencia…' : 'Revalidar ahora'}
					</button>
				</div>
			</header>

			<ul className="canonical-status__legend" aria-label="Semántica de estado">
				<li>
					<SemanticBadge semantic="verified" /> evidencia suficiente y vigente
				</li>
				<li>
					<SemanticBadge semantic="unverified" /> evidencia ausente, incompleta o no vigente
				</li>
				<li>
					<SemanticBadge semantic="blocked" /> la evidencia confirma un bloqueo
				</li>
				<li>
					<SemanticBadge semantic="neutral" /> el control no aplica; no es un fallo
				</li>
			</ul>

			{error ? (
				<div className="canonical-status__error" role="alert">
					<strong>No se pudo actualizar.</strong>
					<span>
						{error} La vista duradera anterior se conserva. Consultar no implica éxito.
					</span>
				</div>
			) : null}

			<p className="canonical-status__announcer" aria-live="polite">
				{loading
					? 'Consulta de solo lectura a bases persistentes. El resultado de la evidencia determinará cada indicador.'
					: view
						? `Evidencia ${EVIDENCE_LABELS[view.evidence]}. Generado ${generated}.`
						: 'Sin evidencia remota. Revalide para consultar Local, Preview y Production.'}
			</p>

			{view ? (
				<>
					{view.environments.production.authorizationIntegrity === 'MISSING' ? (
						<div className="canonical-status__auth-gap" role="status">
							<strong>Autorización de Production ausente.</strong>
							<span>
								La paridad de esquema CURRENT no es evidencia de autorización. Faltan
								registros de apply del propietario
								{view.environments.production.authorizationMissingVersions.length > 0
									? `: ${view.environments.production.authorizationMissingVersions.join(', ')}`
									: '.'}{' '}
								No hay un comando canónico para registrar applies históricos.
							</span>
						</div>
					) : null}
					<table className="canonical-status__matrix">
						<caption>Resumen por entorno persistente</caption>
						<thead>
							<tr>
								<th>Entorno</th>
								<th>Esquema</th>
								<th>Invitaciones</th>
								<th>Preparación</th>
								<th>Autorización</th>
								<th>Evidencia</th>
							</tr>
						</thead>
						<tbody>
							{ENVS.map((env) => {
								const row = view.environments[env];
								return (
									<tr key={env}>
										<th scope="row">
											{ENV_LABELS[env]}
											{!row.environmentIdentityOk ? (
												<p className="canonical-status__identity-warn">
													Identidad de entorno no coincide
												</p>
											) : null}
										</th>
										<td>
											<Indicator
												remediation={schemaRemediation(row)}
												label={formatSchemaMigrationsLabel(
													row.schemaLifecycle,
													row.appliedCount,
													row.expectedCount,
												)}
											/>
										</td>
										<td className="canonical-status__attention-count">
											<Indicator
												remediation={invitationAttentionRemediation(row)}
												label={
													row.evidence === 'UNVERIFIED'
														? 'Publicación sin verificar'
														: `${row.invitationAttentionCount} requieren atención`
												}
											/>
										</td>
										<td>
											<Indicator
												remediation={readinessRemediation(row)}
												label={READINESS_LABELS[row.schemaOperationReadiness]}
											/>
										</td>
										<td>
											<Indicator
												remediation={authorizationRemediation(row)}
												label={AUTHORIZATION_LABELS[row.authorizationIntegrity]}
											/>
										</td>
										<td>
											<Indicator
												remediation={evidenceRemediation(row)}
												label={EVIDENCE_LABELS[row.evidence]}
												detail={row.probedAt ? formatWhen(row.probedAt) : 'sin marca de tiempo'}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					<section aria-labelledby="publication-title">
						<div className="canonical-status__section-head">
							<h2 id="publication-title">Cola de publicación</h2>
							<p>
								Registro: {view.registryCount}. En sync: {view.inSyncCount}. Atención:{' '}
								{view.promotions.length}. Filas activas en DB (no son el registro):
								Local {view.activeRowCounts.local} · Preview {view.activeRowCounts.preview}{' '}
								· Production {view.activeRowCounts.production}
								{(view.identityConflictCounts.local > 0 ||
									view.identityConflictCounts.preview > 0 ||
									view.identityConflictCounts.production > 0) && (
									<>
										. Conflictos de identidad: Local {view.identityConflictCounts.local} ·
										Preview {view.identityConflictCounts.preview} · Production{' '}
										{view.identityConflictCounts.production}
									</>
								)}
								.
							</p>
						</div>
						{queueRemediation ? (
							<Indicator
								remediation={queueRemediation}
								label={queueRemediation.meaning}
							/>
						) : null}
						{view.promotions.length === 0 ? null : (
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

					<RecentMigrationsSection items={view.recentMigrations} />

					<aside className="canonical-status__disposable" aria-labelledby="disposable-title">
						<h2 id="disposable-title">Prueba disposable-test</h2>
						<Indicator
							remediation={disposableRemediation(view.disposableProof)}
							label={`Disposable proof: ${DISPOSABLE_LABELS[view.disposableProof.status]}`}
							detail="No indica deuda de esquema en Local, Preview o Production."
						/>
						<p>
							Evidencia: {EVIDENCE_LABELS[view.disposableProof.evidence]}. Requerida antes
							de futuras operaciones de migración.
						</p>
					</aside>

					<section aria-labelledby="diagnostics-title">
						<details className="canonical-status__details">
							<summary id="diagnostics-title">
								Diagnóstico avanzado ({view.diagnostics.length})
							</summary>
							<p>
								Estas señales explican el estado canónico. No cambian la cola de
								publicación ni la idoneidad de migración.
							</p>
							<DiagnosticsList items={view.diagnostics} />
						</details>
					</section>
				</>
			) : null}
		</section>
	);
}
