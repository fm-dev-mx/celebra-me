import { useCallback, useMemo, useState } from 'react';
import { refreshCanonicalStatusTwoWave } from '@/components/dashboard/status/refresh-canonical-status';
import {
	AUTHORIZATION_LABELS,
	DIAGNOSTIC_LABELS,
	DISPOSABLE_LABELS,
	ENV_LABELS,
	EVIDENCE_LABELS,
	FRESHNESS_LABELS,
	MIGRATION_PRESENCE_LABELS,
	PATCH_STATUS_LABELS,
	PUBLICATION_ACTION_LABELS,
	PUBLICATION_REASON_LABELS,
	READINESS_LABELS,
	SEMANTIC_LABELS,
} from '@/lib/status/labels';
import { CopyableCommand } from '@/components/dashboard/status/CopyableCommand';
import { formatSchemaMigrationsLabel, formatTransitionLabel } from '@/lib/status/presentation';
import {
	authorizationRemediation,
	diagnosticRemediation,
	disposableRemediation,
	evidenceRemediation,
	manualPatchRemediation,
	publicationRemediation,
	readinessRemediation,
	schemaRemediation,
	type OperatorActionStep,
} from '@/lib/status/semantics';
import {
	buildOperationalActionPlan,
	type OperationalAction,
	type OperationalActionDomain,
} from '@/lib/status/action-plan';
import type {
	CanonicalDiagnostic,
	CanonicalStatusView,
	MigrationPresence,
	RecentMigrationRecord,
	StatusSemantic,
	TargetEnv,
	ManualPatchStatus,
} from '@/lib/status/types';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];
const ACTION_DOMAIN_LABELS: Record<OperationalActionDomain, string> = {
	schema: 'Migraciones',
	readiness: 'Preparación',
	authorization: 'Autorización',
	evidence: 'Evidencia',
	publication: 'Publicación',
	patch: 'Parche manual',
	disposable: 'Prueba disposable',
};

function formatWhen(value: string | null): string {
	if (!value) return 'sin marca de tiempo';
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SemanticBadge({ semantic }: { semantic: StatusSemantic }) {
	return (
		<span className={`canonical-status__badge canonical-status__badge--${semantic}`}>
			{SEMANTIC_LABELS[semantic]}
		</span>
	);
}

function StepTypeBadge({ type }: { type: OperatorActionStep['type'] }) {
	const modifiers: Record<OperatorActionStep['type'], string> = {
		Diagnose: 'canonical-status__badge--cyan',
		Verify: 'canonical-status__badge--cyan',
		Plan: 'canonical-status__badge--amber',
		Apply: 'canonical-status__badge--green',
		'Manual/HITL': 'canonical-status__badge--red',
	};
	return <span className={`canonical-status__badge ${modifiers[type]}`}>{type}</span>;
}

function ActionSteps({ steps }: { steps: OperatorActionStep[] }) {
	if (steps.length === 0)
		return (
			<p className="canonical-status__gap">
				No hay un comando canónico; requiere revisión manual.
			</p>
		);
	return (
		<ol className="canonical-status__action-steps">
			{steps.map((step, index) => (
				<li
					key={`${step.type}:${step.command ?? 'manual'}:${index}`}
					className="canonical-status__action-step"
				>
					<div className="canonical-status__action-step-head">
						<StepTypeBadge type={step.type} />
						<strong>{step.label}</strong>
						{step.optional ? (
							<span className="canonical-status__optional">Opcional</span>
						) : null}
						{step.requiresOwner ? (
							<span className="canonical-status__owner">🔒 OWNER / HITL</span>
						) : null}
					</div>
					{step.prerequisite ? (
						<p className="canonical-status__prerequisite">
							Prerequisito: {step.prerequisite}
						</p>
					) : null}
					{step.command ? (
						<CopyableCommand command={step.command} />
					) : (
						<p className="canonical-status__manual-step">
							Intervención manual requerida; no se recomienda aplicar nada
							automáticamente.
						</p>
					)}
				</li>
			))}
		</ol>
	);
}

function OperationalHealthHero({
	plan,
	generated,
	freshnessLabel,
	onRefresh,
	loading,
}: {
	plan: ReturnType<typeof buildOperationalActionPlan>;
	generated: string | null;
	freshnessLabel: string | null;
	onRefresh: () => void;
	loading: boolean;
}) {
	const modifier =
		plan.health.status === 'GREEN'
			? 'green'
			: plan.health.status === 'ACTION_REQUIRED'
				? 'amber'
				: 'cyan';
	return (
		<div className={`canonical-status__health canonical-status__health--${modifier}`}>
			<div className="canonical-status__health-copy">
				<span className="canonical-status__health-icon" aria-hidden="true">
					{plan.health.status === 'GREEN'
						? '✓'
						: plan.health.status === 'ACTION_REQUIRED'
							? '!'
							: '?'}
				</span>
				<div>
					<p className="canonical-status__eyebrow">Salud global</p>
					<h2>{plan.health.label}</h2>
					<p>{plan.health.summary}</p>
					<p className="canonical-status__health-meta">
						{freshnessLabel ? (
							<span>
								<strong>Frescura:</strong> {freshnessLabel}
							</span>
						) : null}
						{generated ? (
							<span>
								<strong>Evidencia:</strong> {generated}
							</span>
						) : null}
					</p>
				</div>
			</div>
			<button
				type="button"
				className="btn-primary"
				onClick={onRefresh}
				disabled={loading}
				title="Revalida evidencia remota de solo lectura."
			>
				{loading ? 'Revalidando…' : 'Revalidar todo'}
			</button>
		</div>
	);
}

function ActionCard({ action }: { action: OperationalAction }) {
	const modifier =
		action.semantic === 'blocked'
			? 'blocked'
			: action.semantic === 'unverified'
				? 'unverified'
				: 'neutral';
	return (
		<article className={`canonical-status__action canonical-status__action--${modifier}`}>
			<header className="canonical-status__action-head">
				<div>
					<p className="canonical-status__action-domain">
						{ACTION_DOMAIN_LABELS[action.domain]}
					</p>
					<h3>{action.title}</h3>
				</div>
				<SemanticBadge semantic={action.semantic} />
			</header>
			<p className="canonical-status__action-summary">{action.summary}</p>
			{action.environments.length > 0 ? (
				<p className="canonical-status__action-env">
					Alcance: {action.environments.join(' · ')}
				</p>
			) : null}
			{action.why ? <p className="canonical-status__reason">{action.why}</p> : null}
			<ActionSteps steps={action.steps} />
			<p className="canonical-status__verify">Queda verificado cuando: {action.verifyWhen}</p>
			{action.noCanonicalRemediation ? (
				<p className="canonical-status__gap">
					No hay remediación canónica directa para este elemento.
				</p>
			) : null}
		</article>
	);
}

function ActionQueue({ actions }: { actions: OperationalAction[] }) {
	return (
		<section className="canonical-status__action-queue" aria-labelledby="action-queue-title">
			<div className="canonical-status__section-head">
				<h2 id="action-queue-title">Qué hacer ahora</h2>
				<p>
					{actions.length === 0
						? 'No hay acciones pendientes. Los controles aplicables están verificados.'
						: 'Comandos ordenados por bloqueo, riesgo y dependencia. Esta vista solo permite copiar instrucciones.'}
				</p>
			</div>
			{actions.length > 0 ? (
				<div className="canonical-status__action-list">
					{actions.map((action) => (
						<ActionCard key={action.id} action={action} />
					))}
				</div>
			) : (
				<p className="canonical-status__empty-success">
					✓ No hay migraciones, publicaciones ni parches pendientes.
				</p>
			)}
		</section>
	);
}

function StatusRow({
	label,
	semantic,
	value,
	detail,
}: {
	label: string;
	semantic: StatusSemantic;
	value: string;
	detail?: string;
}) {
	return (
		<div className="canonical-status__status-row">
			<div>
				<SemanticBadge semantic={semantic} />
				<strong>{label}</strong>
			</div>
			<span>{value}</span>
			{detail ? <small>{detail}</small> : null}
		</div>
	);
}

function EnvironmentCards({ view }: { view: CanonicalStatusView }) {
	return (
		<section aria-labelledby="environment-title">
			<div className="canonical-status__section-head">
				<h2 id="environment-title">Controles por entorno</h2>
				<p>Resumen compacto; los comandos y prerrequisitos viven en la cola superior.</p>
			</div>
			<div className="canonical-status__environment-grid">
				{ENVS.map((env) => {
					const row = view.environments[env];
					return (
						<article
							className={`canonical-status__environment-card canonical-status__environment-card--${row.evidence === 'LIVE' ? 'live' : 'unverified'}`}
							key={env}
						>
							<header>
								<div>
									<p className="canonical-status__eyebrow">Entorno</p>
									<h3>{ENV_LABELS[env]}</h3>
								</div>
								<SemanticBadge
									semantic={row.evidence === 'LIVE' ? 'verified' : 'unverified'}
								/>
							</header>
							<dl>
								<StatusRow
									label="Esquema"
									semantic={schemaRemediation(row).semantic}
									value={formatSchemaMigrationsLabel(
										row.schemaLifecycle,
										row.appliedCount,
										row.expectedCount,
									)}
								/>
								<StatusRow
									label="Preparación"
									semantic={readinessRemediation(row).semantic}
									value={READINESS_LABELS[row.schemaOperationReadiness]}
								/>
								<StatusRow
									label="Autorización"
									semantic={authorizationRemediation(row).semantic}
									value={AUTHORIZATION_LABELS[row.authorizationIntegrity]}
								/>
								<StatusRow
									label="Evidencia"
									semantic={evidenceRemediation(row).semantic}
									value={EVIDENCE_LABELS[row.evidence]}
									detail={row.probedAt ? formatWhen(row.probedAt) : undefined}
								/>
							</dl>
							<p className="canonical-status__attention-count">
								Publicación: <strong>{row.invitationAttentionCount}</strong>{' '}
								requiere(n) atención · conflictos: {row.identityConflictsCount}
							</p>
						</article>
					);
				})}
			</div>
		</section>
	);
}

function PublicationDetails({ view }: { view: CanonicalStatusView }) {
	return (
		<details className="canonical-status__details canonical-status__secondary">
			<summary id="publication-title">
				Publicación · registro {view.registryCount} · en sync {view.inSyncCount} · atención{' '}
				{view.promotions.length}
			</summary>
			<p>
				Evidencia de estados por invitación. Las acciones viven una sola vez en la cola
				superior.
			</p>
			{view.promotions.length > 0 ? (
				<div className="canonical-status__queue">
					{view.promotions.map((row) => {
						const remediation = publicationRemediation(row);
						return (
							<article
								className={`canonical-status__card canonical-status__card--${remediation.semantic}`}
								key={row.slug}
							>
								<header className="canonical-status__card-head">
									<h3>
										{row.title}{' '}
										<span className="canonical-status__slug">({row.slug})</span>
									</h3>
									<SemanticBadge semantic={remediation.semantic} />
								</header>
								<p className="canonical-status__reason">
									{PUBLICATION_REASON_LABELS[row.reasonCode]}
								</p>
								<p>
									{formatTransitionLabel(row.source, row.destination)} ·{' '}
									{PUBLICATION_ACTION_LABELS[row.action]} · Evidencia:{' '}
									<strong>{EVIDENCE_LABELS[row.evidence]}</strong>
								</p>
								{row.uncertaintyNotes.length > 0 ? (
									<p className="canonical-status__unverified">
										{row.uncertaintyNotes.join(' · ')}
									</p>
								) : null}
								<details className="canonical-status__details">
									<summary>Detalle técnico</summary>
									<dl>
										<dt>reasonCode</dt>
										<dd>{row.reasonCode}</dd>
										<dt>Estados</dt>
										<dd>
											Local {row.environments.local} · Preview{' '}
											{row.environments.preview} · Producción{' '}
											{row.environments.production}
										</dd>
									</dl>
								</details>
							</article>
						);
					})}
				</div>
			) : (
				<p className="canonical-status__empty-success">
					✓ No hay invitaciones que requieran promoción.
				</p>
			)}
			{view.inSyncCount > 0 ? (
				<details className="canonical-status__details">
					<summary>Invitaciones en sync ({view.inSyncCount})</summary>
					<ul>
						{view.inSyncSlugs.map((slug) => (
							<li key={slug}>{slug}</li>
						))}
					</ul>
				</details>
			) : null}
		</details>
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
		<span
			className={`canonical-status__applied-badge canonical-status__applied-badge--${modifier}`}
		>
			{MIGRATION_PRESENCE_LABELS[presence]}
			{verifiedAt && presence !== 'UNVERIFIED' ? (
				<span className="canonical-status__probe-time">
					{' '}
					· Sonda: {formatWhen(verifiedAt)}
				</span>
			) : null}
		</span>
	);
}

function RecentMigrationsSection({ items }: { items?: RecentMigrationRecord[] }) {
	if (!items || items.length === 0) return null;
	return (
		<details
			className="canonical-status__details canonical-status__secondary"
			aria-labelledby="migrations-title"
		>
			<summary id="migrations-title">
				Historial de migraciones recientes ({items.length})
			</summary>
			<p>
				Registro autoritativo; la marca de tiempo corresponde a la sonda, no a la
				aplicación.
			</p>
			<div className="canonical-status__table-wrap">
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
										<span className="canonical-status__migration-name">
											{' '}
											· {rec.name}
										</span>
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
			</div>
		</details>
	);
}
function ManualPatchesSection({ items }: { items: ManualPatchStatus[] }) {
	const pending = items.filter(
		(item) => item.environments.production.status === 'PENDING',
	).length;
	const blocked = items.filter(
		(item) => item.environments.production.status === 'BLOCKED',
	).length;
	const unverified = items.filter(
		(item) => item.environments.production.status === 'UNVERIFIED',
	).length;
	const notNeeded = items.filter(
		(item) => item.environments.production.status === 'NOT_NEEDED',
	).length;
	return (
		<details className="canonical-status__details canonical-status__secondary">
			<summary id="manual-patches-title">
				Parches manuales · {pending} pendiente(s) · {blocked} bloqueado(s) · {unverified} no
				verificado(s) · {notNeeded} no requerido(s)
			</summary>
			<p>
				Detectores activos, separados de las migraciones. «No requerido: 0 filas» es verde y
				no demuestra que el parche fue aplicado.
			</p>
			<div className="canonical-status__patch-list">
				{items.map((item) => {
					const production = item.environments.production;
					const productionRemediation = manualPatchRemediation(item, 'production');
					return (
						<article
							className={`canonical-status__card canonical-status__patch-card canonical-status__card--${productionRemediation.semantic}`}
							key={item.scriptId}
						>
							<header className="canonical-status__card-head">
								<div>
									<h3>{item.file.split('/').at(-1) ?? item.scriptId}</h3>
									<p className="canonical-status__slug">{item.scriptId}</p>
								</div>
								<SemanticBadge semantic={productionRemediation.semantic} />
							</header>
							<p>{item.purpose}</p>
							<p>
								Producción:{' '}
								<strong>{PATCH_STATUS_LABELS[production.status]}</strong>
								{production.matchingRowCount !== null
									? ` · ${production.matchingRowCount} filas (rango ${item.expectedRowsMin}–${item.expectedRowsMax})`
									: ''}{' '}
								· Evidencia: {EVIDENCE_LABELS[production.evidence]}
							</p>
							{production.affectedRows?.length ? (
								<p className="canonical-status__patch-note">
									Filas detectadas:{' '}
									{production.affectedRows
										.map(
											(row) =>
												`${row.store}/${row.slug ?? row.key}${row.version === null ? '' : ` · versión ${row.version}`}`,
										)
										.join(', ')}
								</p>
							) : null}
							<details className="canonical-status__details">
								<summary>Rango y evidencia</summary>
								<dl>
									<dt>Rango aprobado</dt>
									<dd>
										{item.expectedRowsMin}–{item.expectedRowsMax} filas
									</dd>
									<dt>Motivo técnico</dt>
									<dd>{production.reason}</dd>
									{production.verifiedAt ? (
										<>
											<dt>Última verificación LIVE</dt>
											<dd>{production.verifiedAt}</dd>
										</>
									) : null}
									{production.projectRef ? (
										<>
											<dt>Proyecto</dt>
											<dd>{production.projectRef}</dd>
										</>
									) : null}
								</dl>
							</details>
						</article>
					);
				})}
			</div>
		</details>
	);
}
function DiagnosticsList({ items }: { items: CanonicalDiagnostic[] }) {
	if (items.length === 0)
		return (
			<p>
				No hay diagnósticos adicionales. La cola de publicación es la autoridad operativa.
			</p>
		);
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
							Dominio: {item.domain === 'schema' ? 'Esquema' : 'Publicación'} ·
							Evidencia: {EVIDENCE_LABELS[item.evidence]}
						</p>
						<p>{item.cause}</p>
						<details>
							<summary>Ver detalle semántico</summary>
							<p>
								{item.semanticPaths.join(', ') ||
									'Sin rutas semánticas adicionales.'}
							</p>
						</details>
					</li>
				);
			})}
		</ul>
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
	const [domainFilter, setDomainFilter] = useState<'all' | 'schema' | 'content' | 'patch'>('all');
	const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
	const [scopeOpen, setScopeOpen] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await refreshCanonicalStatusTwoWave({
			envFilter,
			domainFilter,
			includeDiagnostics,
		});
		if (result.view) setView(result.view);
		setError(result.error);
		setLoading(false);
	}, [domainFilter, envFilter, includeDiagnostics]);

	const plan = useMemo(() => (view ? buildOperationalActionPlan(view) : null), [view]);
	const generated = useMemo(() => (view ? formatWhen(view.generatedAt) : null), [view]);
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
					<h2 id="canonical-status-title">Estado operacional</h2>
					<p>
						Salud global, acciones necesarias y evidencia por entorno. Esta vista es
						read-only: no aplica migraciones, parches ni promociones.
					</p>
				</div>
				<details
					className="canonical-status__scope"
					open={scopeOpen}
					onToggle={(event) => setScopeOpen((event.target as HTMLDetailsElement).open)}
				>
					<summary>Alcance de revalidación</summary>
					<p>
						Estos controles delimitan la próxima sonda; no filtran ni ocultan la
						información ya visible.
					</p>
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
									setDomainFilter(
										event.target.value as
											'all' | 'schema' | 'content' | 'patch',
									)
								}
							>
								<option value="all">Todos</option>
								<option value="schema">Esquema</option>
								<option value="content">Publicación</option>
								<option value="patch">Parches manuales</option>
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
					</div>
				</details>
			</header>

			{view && plan ? (
				<OperationalHealthHero
					plan={plan}
					generated={generated}
					freshnessLabel={freshnessLabel}
					onRefresh={() => void refresh()}
					loading={loading}
				/>
			) : null}
			<ul className="canonical-status__legend" aria-label="Semántica de estado">
				<li>
					<SemanticBadge semantic="verified" /> saludable / evidencia suficiente
				</li>
				<li>
					<SemanticBadge semantic="unverified" /> requiere verificación
				</li>
				<li>
					<SemanticBadge semantic="blocked" /> bloqueo confirmado
				</li>
				<li>
					<SemanticBadge semantic="neutral" /> no aplica
				</li>
			</ul>
			{error ? (
				<div className="canonical-status__error" role="alert">
					<strong>No se pudo actualizar.</strong>
					<span>{error} La vista duradera anterior se conserva.</span>
				</div>
			) : null}
			<p className="canonical-status__announcer" aria-live="polite">
				{loading
					? 'Consulta de solo lectura a bases persistentes.'
					: view
						? `Evidencia ${EVIDENCE_LABELS[view.evidence]}. Generado ${generated}.`
						: 'Sin evidencia remota. Revalide para consultar Local, Preview y Production.'}
			</p>
			{view && plan ? (
				<>
					<ActionQueue actions={plan.actions} />
					<EnvironmentCards view={view} />
					<PublicationDetails view={view} />
					<ManualPatchesSection items={view.manualPatches} />
					<details className="canonical-status__details canonical-status__secondary">
						<summary>
							Prueba disposable-test ·{' '}
							{DISPOSABLE_LABELS[view.disposableProof.status]}
						</summary>
						<p>{disposableRemediation(view.disposableProof).meaning}</p>
						<p>
							Evidencia: {EVIDENCE_LABELS[view.disposableProof.evidence]}. No indica
							deuda de esquema en Local, Preview o Production.
						</p>
					</details>
					<RecentMigrationsSection items={view.recentMigrations} />
					<details className="canonical-status__details canonical-status__secondary">
						<summary>Diagnóstico avanzado ({view.diagnostics.length})</summary>
						<p>
							Estas señales enriquecen la explicación; no cambian la salud global ni
							autorizan operaciones.
						</p>
						<DiagnosticsList items={view.diagnostics} />
					</details>
				</>
			) : null}
		</section>
	);
}
