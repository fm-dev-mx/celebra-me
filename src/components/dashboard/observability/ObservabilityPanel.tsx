import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type {
	AssetHealthState,
	EvidenceFreshness,
	ObservabilitySnapshot,
	ObservabilitySummaryPayload,
	OverallStatus,
} from '@/lib/observability/types';

const OVERALL_LABELS: Record<OverallStatus, string> = {
	HEALTHY: 'Saludable',
	ATTENTION: 'Atención requerida',
	BLOCKED: 'Bloqueado',
	UNVERIFIED: 'Sin verificar',
};

const FRESHNESS_LABELS: Record<EvidenceFreshness, string> = {
	PASS: 'Vigente',
	FAIL: 'Falló',
	STALE: 'Obsoleta',
	NOT_RUN: 'Sin ejecutar',
	INVALID: 'Inválida',
};

const ASSET_LABELS: Record<AssetHealthState, string> = {
	OK: 'Vigente',
	PARTIAL: 'Parcial',
	MISSING: 'Faltante',
	REMOTE_REFERENCE: 'Referencia remota',
	UNVERIFIED: 'Sin verificar',
};

const STATUS_CELL_LABELS: Record<string, string> = {
	MATCH_CANONICAL: 'Alineada (Canónico)',
	BEHIND_CANONICAL: 'Desactualizada',
	DIVERGED: 'Borrador activo',
	MATCH_REFERENCE: 'Coincide con referencia',
	DIVERGED_FROM_REFERENCE: 'Divergido de referencia',
	IDENTITY_CONFLICT: 'Conflicto de ID',
	UNVERIFIED: 'Sin verificar',
};

const ENV_LABELS = {
	local: 'Local',
	preview: 'Preview',
	production: 'Producción',
} as const;

const CATEGORY_LABELS = {
	DIAGNOSE: '🔍 Diagnosticar (Solo lectura)',
	VALIDATE: '🧪 Validar (Pruebas y evidencia)',
	REPAIR: '🔧 Corregir (Sincronización local)',
	PROMOTE: '🚀 Promover (Promoción a producción)',
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
	const label =
		STATUS_CELL_LABELS[value] ??
		FRESHNESS_LABELS[value as EvidenceFreshness] ??
		ASSET_LABELS[value as AssetHealthState] ??
		value;
	return (
		<span className="observability__badge" title={value}>
			{label}
		</span>
	);
}

function SectionResumen({ summary }: { summary: ObservabilitySummaryPayload['summary'] }) {
	return (
		<section className="observability__section" aria-label="Sección 1: Resumen">
			<h2>1. Resumen del sistema</h2>
			<div className="observability__cards-grid">
				<div className="observability__card">
					<h3>Corpus ({summary.invitations.totalCount})</h3>
					<p className="observability__card-text">
						<strong>{summary.invitations.alignedCount}</strong> alineadas ·{' '}
						<strong>{summary.invitations.divergedCount}</strong> con borrador ·{' '}
						<strong>{summary.invitations.behindCount}</strong> desactualizadas
					</p>
				</div>

				<div className="observability__card">
					<h3>Esquema & Migraciones</h3>
					<p className="observability__card-text">
						Estado Local: <StatusBadge value={summary.migrations.localLifecycle} />
					</p>
					<p className="observability__muted">
						{summary.migrations.hasPending
							? `${summary.migrations.pendingCount} migraciones pendientes`
							: 'Sin migraciones pendientes'}
					</p>
				</div>
			</div>
		</section>
	);
}

function SectionAttention({
	issueSlugs,
	totalCount,
}: {
	issueSlugs: string[];
	totalCount: number;
}) {
	if (issueSlugs.length > 0) {
		return (
			<section
				className="observability__section observability__section--attention"
				aria-label="Sección 2: Invitaciones que requieren atención"
			>
				<h2 className="observability__attention-title">
					2. Invitaciones que requieren atención ({issueSlugs.length})
				</h2>
				<p className="observability__muted">
					Las siguientes invitaciones requieren sincronización de paquete o revisión de
					contenido:
				</p>
				<ul className="observability__note-list">
					{issueSlugs.map((slug) => (
						<li key={slug}>
							<strong>{slug}</strong> — <code>pnpm dbs --compact {slug}</code>
						</li>
					))}
				</ul>
			</section>
		);
	}

	return (
		<section
			className="observability__section observability__section--aligned"
			aria-label="Sección 2: Invitaciones alineadas"
		>
			<h2 className="observability__aligned-title">
				2. Invitaciones que requieren atención (0)
			</h2>
			<p className="observability__muted">
				✓ Las {totalCount} invitaciones del corpus local coinciden con la definición
				canónica.
			</p>
		</section>
	);
}

function SectionEvidencia({
	validation,
}: {
	validation: ObservabilitySummaryPayload['summary']['validation'];
}) {
	return (
		<section className="observability__section" aria-label="Sección 3: Evidencia de validación">
			<h2>3. Evidencia de validación</h2>
			<div className="observability__cards-grid">
				<div className="observability__card">
					<h3>Pruebas de Regresión</h3>
					<p className="observability__card-text">
						Frescura: <StatusBadge value={validation.regressionFreshness} />
					</p>
					<p className="observability__muted">
						Comando: <code>pnpm test:local-render-corpus</code>
					</p>
				</div>
				<div className="observability__card">
					<h3>Capturas Visuales</h3>
					<p className="observability__card-text">
						Frescura: <StatusBadge value={validation.screenshotsFreshness} />
					</p>
					<p className="observability__muted">
						Comando: <code>pnpm screenshot:local-render-corpus</code>
					</p>
				</div>
			</div>
		</section>
	);
}

function CommandItem({
	cmd,
	copiedId,
	onCopy,
}: {
	cmd: ObservabilitySummaryPayload['categorizedCommands'][number];
	copiedId: string | null;
	onCopy: (id: string, text: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const isMutating = cmd.category === 'REPAIR' || cmd.category === 'PROMOTE';

	return (
		<div className="observability__command">
			<div className="observability__command-header">
				<div>
					<strong>{cmd.label}</strong>
					{isMutating ? (
						<span className="observability__badge observability__badge--mutating">
							Modificación en consola
						</span>
					) : null}
				</div>
				<div className="observability__actions">
					<button
						type="button"
						className="dashboard-button observability__command-btn"
						onClick={() => setExpanded(!expanded)}
					>
						{expanded ? 'Ocultar comando' : 'Ver comando'}
					</button>
					<button
						type="button"
						className="dashboard-button observability__command-btn"
						onClick={() => onCopy(cmd.id, cmd.command)}
					>
						{copiedId === cmd.id ? '¡Copiado!' : 'Copiar'}
					</button>
				</div>
			</div>
			<span className="observability__muted">{cmd.reason}</span>
			{expanded ? <code>{cmd.command}</code> : null}
		</div>
	);
}

function CategorizedCommands({
	commands,
	copiedId,
	onCopy,
}: {
	commands: ObservabilitySummaryPayload['categorizedCommands'];
	copiedId: string | null;
	onCopy: (id: string, text: string) => void;
}) {
	return (
		<div className="observability__commands">
			{(['DIAGNOSE', 'VALIDATE', 'REPAIR', 'PROMOTE'] as const).map((cat) => {
				const cmds = commands.filter((c) => c.category === cat);
				if (cmds.length === 0) return null;
				return (
					<div key={cat}>
						<h3 className="observability__category-title">{CATEGORY_LABELS[cat]}</h3>
						{cmds.map((cmd) => (
							<CommandItem
								key={cmd.id}
								cmd={cmd}
								copiedId={copiedId}
								onCopy={onCopy}
							/>
						))}
					</div>
				);
			})}
		</div>
	);
}

function DetailMatrix({ snapshot }: { snapshot: ObservabilitySnapshot }) {
	const assetBySlug = new Map(snapshot.assets.map((row) => [row.slug, row]));

	return (
		<div className="observability__detail-grid">
			<div>
				<h3>Entornos</h3>
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
								<th scope="row">Ciclo de esquema</th>
								{snapshot.environments.map((env) => (
									<td key={`${env.environment}-schema`}>
										<StatusBadge value={env.schemaLifecycle} />
									</td>
								))}
							</tr>
							<tr>
								<th scope="row">Filas activas</th>
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
			</div>

			<div>
				<h3>Invitaciones del corpus ({snapshot.invitations.length})</h3>
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
											<StatusBadge value={row.referenceClassification} />
										</td>
										<td>
											<StatusBadge value={row.environments.local.status} />
										</td>
										<td>
											<StatusBadge value={row.environments.preview.status} />
										</td>
										<td>
											<StatusBadge
												value={row.environments.production.status}
											/>
										</td>
										<td>
											<StatusBadge value={asset?.status ?? 'UNVERIFIED'} />
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div>
				<h3>Migraciones</h3>
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
											: (ENV_LABELS[
													row.environment as keyof typeof ENV_LABELS
												] ?? row.environment)}
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
			</div>
		</div>
	);
}

function SectionDiagnostico({
	commands,
	snapshot,
	totalCount,
	copiedId,
	showDetail,
	loadingDetail,
	onCopy,
	onToggleDetail,
}: {
	commands: ObservabilitySummaryPayload['categorizedCommands'];
	snapshot: ObservabilitySnapshot | null;
	totalCount: number;
	copiedId: string | null;
	showDetail: boolean;
	loadingDetail: boolean;
	onCopy: (id: string, text: string) => void;
	onToggleDetail: () => void;
}) {
	return (
		<section className="observability__section" aria-label="Sección 4: Diagnóstico y comandos">
			<h2>4. Diagnóstico & Comandos recomendados</h2>
			<CategorizedCommands commands={commands} copiedId={copiedId} onCopy={onCopy} />

			<div className="observability__detail-header">
				<div>
					<h3>Matriz Detallada del Corpus</h3>
					<p className="observability__muted">
						Inspecciona la matriz de {totalCount} invitaciones, estados de entorno y
						migraciones.
					</p>
				</div>
				<button
					type="button"
					className="dashboard-button"
					onClick={onToggleDetail}
					disabled={loadingDetail}
				>
					{loadingDetail
						? 'Cargando detalle…'
						: showDetail
							? 'Ocultar detalle'
							: 'Ver detalle completo'}
				</button>
			</div>

			{showDetail && snapshot ? <DetailMatrix snapshot={snapshot} /> : null}
		</section>
	);
}

function PanelContent({
	summary,
	snapshot,
	copiedId,
	showDetail,
	loadingDetail,
	onCopy,
	onToggleDetail,
}: {
	summary: ObservabilitySummaryPayload;
	snapshot: ObservabilitySnapshot | null;
	copiedId: string | null;
	showDetail: boolean;
	loadingDetail: boolean;
	onCopy: (id: string, text: string) => void;
	onToggleDetail: () => void;
}) {
	return (
		<>
			{summary.degradedNotes.length > 0 ? (
				<section className="observability__section" aria-label="Degradaciones">
					<h2>Señales degradadas</h2>
					<ul className="observability__note-list">
						{summary.degradedNotes.map((note) => (
							<li key={note}>{note}</li>
						))}
					</ul>
				</section>
			) : null}

			<SectionResumen summary={summary.summary} />
			<SectionAttention
				issueSlugs={summary.summary.invitations.issueSlugs}
				totalCount={summary.summary.invitations.totalCount}
			/>
			<SectionEvidencia validation={summary.summary.validation} />
			<SectionDiagnostico
				commands={summary.categorizedCommands}
				snapshot={snapshot}
				totalCount={summary.summary.invitations.totalCount}
				copiedId={copiedId}
				showDetail={showDetail}
				loadingDetail={loadingDetail}
				onCopy={onCopy}
				onToggleDetail={onToggleDetail}
			/>
		</>
	);
}

function HeaderMeta({
	overallStatus,
	source,
	generatedAt,
}: {
	overallStatus?: OverallStatus;
	source?: ObservabilitySummaryPayload['source'];
	generatedAt?: string;
}) {
	if (!overallStatus || !source) return null;
	return (
		<p className="observability__meta">
			<span>
				Estado:{' '}
				<span
					className="observability__status"
					data-status={overallStatus}
					aria-label={`Estado general: ${OVERALL_LABELS[overallStatus]} (${overallStatus})`}
				>
					{OVERALL_LABELS[overallStatus]} ({overallStatus})
				</span>
			</span>
			<span>Rama: {source.branch ?? '—'}</span>
			<span>Commit HEAD: {shortSha(source.commitSha)}</span>
			<span>
				Árbol:{' '}
				{source.workingTreeDirty === null
					? '—'
					: source.workingTreeDirty
						? 'con cambios'
						: 'limpio'}
			</span>
			{generatedAt ? (
				<span data-generated-at={generatedAt}>
					Generado:{' '}
					{new Date(generatedAt).toLocaleString('es-MX', {
						dateStyle: 'short',
						timeStyle: 'medium',
					})}
				</span>
			) : null}
		</p>
	);
}

interface ObservabilityPanelProps {
	initialSummary?: ObservabilitySummaryPayload | null;
}

export default function ObservabilityPanel({ initialSummary = null }: ObservabilityPanelProps) {
	const [summary, setSummary] = useState<ObservabilitySummaryPayload | null>(initialSummary);
	const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
	const [loading, setLoading] = useState(!initialSummary);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const loadSummary = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await dashboardApi.get<ObservabilitySummaryPayload>(
			'/api/dashboard/observabilidad?mode=summary',
			{ timeoutMs: 60_000 },
		);
		if (!result.ok) {
			setError(
				result.message ||
					'No se pudo actualizar el estado. Se conservan los datos de la última lectura.',
			);
			setLoading(false);
			return;
		}
		setSummary(result.data);
		setSnapshot(null);
		setShowDetail(false);
		setLoading(false);
	}, []);

	const loadDetail = useCallback(async (): Promise<boolean> => {
		if (snapshot) return true;
		if (loadingDetail) return false;
		setLoadingDetail(true);
		const result = await dashboardApi.get<ObservabilitySnapshot>(
			'/api/dashboard/observabilidad?mode=detail',
			{ timeoutMs: 300_000 },
		);
		if (!result.ok) {
			setError(result.message || 'No se pudo cargar la matriz detallada.');
			setLoadingDetail(false);
			return false;
		}
		setSnapshot(result.data);
		setLoadingDetail(false);
		return true;
	}, [snapshot, loadingDetail]);

	useEffect(() => {
		if (!initialSummary) {
			void loadSummary();
		}
	}, [initialSummary, loadSummary]);

	const copyCommand = (id: string, text: string) => {
		void navigator.clipboard.writeText(text);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const handleToggleDetail = () => {
		if (showDetail) {
			setShowDetail(false);
			return;
		}
		void loadDetail().then((ok) => {
			if (ok) setShowDetail(true);
		});
	};

	const overallStatus = summary?.overallStatus;
	const source = summary?.source;
	const generatedAt = summary?.generatedAt;

	return (
		<section className="observability" aria-live="polite">
			<header className="observability__header">
				<div>
					<p className="observability__eyebrow">Solo lectura · entorno Local</p>
					<h1>Observabilidad operacional</h1>
					<HeaderMeta
						overallStatus={overallStatus}
						source={source}
						generatedAt={generatedAt}
					/>
				</div>
				<div className="observability__actions">
					<button
						type="button"
						className="dashboard-button"
						onClick={() => void loadSummary()}
						disabled={loading}
					>
						{loading ? 'Actualizando…' : 'Actualizar estado'}
					</button>
				</div>
			</header>

			{error ? (
				<div className="observability__error" role="alert">
					{error}
				</div>
			) : null}

			{loading && !summary ? (
				<p className="observability__muted">Cargando resumen operacional…</p>
			) : null}

			{summary ? (
				<PanelContent
					summary={summary}
					snapshot={snapshot}
					copiedId={copiedId}
					showDetail={showDetail}
					loadingDetail={loadingDetail}
					onCopy={copyCommand}
					onToggleDetail={handleToggleDetail}
				/>
			) : null}
		</section>
	);
}
