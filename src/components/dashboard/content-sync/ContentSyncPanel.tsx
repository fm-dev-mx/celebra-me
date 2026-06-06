import React, { useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type {
	DemoDriftItem,
	DemoDriftReport,
	SourceEnvironment,
} from '@/lib/content-publication/demo-drift';
import type { DemoDriftStatus } from '@/lib/content-publication/drift-status';
import type {
	DemoPublishDryRunResult,
	DemoPublishConfirmResult,
} from '@/lib/content-publication/demo-publish';

const STATUS_LABELS: Record<DemoDriftStatus, string> = {
	in_sync: 'Sin cambios',
	different: 'Cambios pendientes',
	missing_in_prod: 'No publicado',
	missing_locally: 'Solo en producción',
	schema_mismatch: 'Error de estructura',
	unsafe_target: 'Bloqueado',
};

const SUMMARY_ORDER: DemoDriftStatus[] = [
	'in_sync',
	'different',
	'missing_in_prod',
	'missing_locally',
	'schema_mismatch',
	'unsafe_target',
];

const SOURCE_LABELS: Record<SourceEnvironment, string> = {
	production: 'producción',
	preview: 'preview',
	local: 'local',
	unknown: 'desconocido',
};

const EMPTY_SUMMARY: Record<DemoDriftStatus, number> = {
	in_sync: 0,
	different: 0,
	missing_in_prod: 0,
	missing_locally: 0,
	schema_mismatch: 0,
	unsafe_target: 0,
};

const shortHash = (hash: string | null) => (hash ? hash.slice(0, 12) : '—');

const formatValue = (value: unknown): string => {
	if (value === null) return 'null';
	if (value === undefined) return '—';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return JSON.stringify(value);
};

const canPublishStatus = (status: DemoDriftStatus) =>
	status === 'different' || status === 'missing_in_prod';

const ContentSyncPanel: React.FC = () => {
	const [report, setReport] = useState<DemoDriftReport | null>(null);
	const [selected, setSelected] = useState<DemoDriftItem | null>(null);
	const [dryRunByRoute, setDryRunByRoute] = useState<Record<string, DemoPublishDryRunResult>>({});
	const [confirmTarget, setConfirmTarget] = useState<DemoDriftItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [busyRoute, setBusyRoute] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const summary = report?.summary ?? EMPTY_SUMMARY;
	const sortedItems = useMemo(
		() =>
			[...(report?.items ?? [])].sort((a, b) => a.route_key.localeCompare(b.route_key, 'es')),
		[report?.items],
	);

	const loadReport = async () => {
		setLoading(true);
		setError(null);
		const result = await dashboardApi.get<DemoDriftReport>(
			'/api/dashboard/admin/content-drift',
		);
		if (result.ok) {
			setReport(result.data);
			setSelected((current) =>
				current
					? (result.data.items.find((item) => item.route_key === current.route_key) ??
						null)
					: null,
			);
		} else {
			setError(result.message);
		}
		setLoading(false);
	};

	useEffect(() => {
		void loadReport();
	}, []);

	const selectItem = (item: DemoDriftItem) => {
		setSelected(item);
	};

	const runDryRun = async (item: DemoDriftItem) => {
		setBusyRoute(item.route_key);
		setError(null);
		setMessage(null);
		const result = await dashboardApi.post<DemoPublishDryRunResult>(
			'/api/dashboard/admin/demo-publish/dry-run',
			{ event_type: item.event_type, slug: item.slug },
		);
		if (result.ok) {
			setDryRunByRoute((current) => ({
				...current,
				[item.route_key]: result.data,
			}));
			setSelected((current) =>
				current?.route_key === item.route_key
					? {
							...current,
							status: result.data.status,
							local_hash: result.data.local_hash,
							prod_hash: result.data.prod_hash,
							changed_paths: result.data.changed_paths,
							diff_examples: result.data.diff_examples,
						}
					: current,
			);
			setMessage('Revisión completada. El hash de producción quedó listo para confirmar.');
		} else {
			setError(result.message);
		}
		setBusyRoute(null);
	};

	const confirmPublish = async () => {
		if (!confirmTarget) return;
		const dryRun = dryRunByRoute[confirmTarget.route_key];
		if (!dryRun?.expected_prod_hash) {
			setError('Ejecuta una revisión antes de publicar.');
			setConfirmTarget(null);
			return;
		}

		setBusyRoute(confirmTarget.route_key);
		setError(null);
		setMessage(null);
		const result = await dashboardApi.post<DemoPublishConfirmResult>(
			'/api/dashboard/admin/demo-publish/confirm',
			{
				event_type: confirmTarget.event_type,
				slug: confirmTarget.slug,
				expected_prod_hash: dryRun.expected_prod_hash,
			},
		);
		if (result.ok) {
			setMessage(
				`Demo publicado. Versión ${result.data.previous_version ?? '—'} → ${result.data.new_version}.`,
			);
			setDryRunByRoute((current) => {
				const next = { ...current };
				delete next[confirmTarget.route_key];
				return next;
			});
			setConfirmTarget(null);
			await loadReport();
		} else {
			setError(result.message);
			setConfirmTarget(null);
		}
		setBusyRoute(null);
	};

	return (
		<section className="content-sync">
			<div className="content-sync__header">
				<div>
					<p className="content-sync__eyebrow">Contenido publicado</p>
					<h1>Publicación de demos</h1>
				</div>
				<button type="button" className="btn-secondary" onClick={() => void loadReport()}>
					Actualizar
				</button>
			</div>

			<div className="content-sync__environment" aria-live="polite">
				<span>Fuente: {SOURCE_LABELS[report?.source_environment ?? 'unknown']}</span>
				<span>Base de datos destino: producción</span>
				{report?.source_environment === 'local' && (
					<strong>Estás comparando contenido local contra producción.</strong>
				)}
			</div>

			{error && <p className="dashboard-error">{error}</p>}
			{message && <p className="dashboard-status">{message}</p>}
			{loading && <p className="dashboard-status">Cargando demos...</p>}

			<div className="content-sync__summary">
				{SUMMARY_ORDER.map((status) => (
					<div key={status} className="content-sync__summary-item">
						<span>{STATUS_LABELS[status]}</span>
						<strong>{summary[status]}</strong>
					</div>
				))}
			</div>

			<div className="content-sync__grid">
				<div className="dashboard-card content-sync__table-card">
					<table className="dashboard-table content-sync__table">
						<thead>
							<tr>
								<th>Demo</th>
								<th>Tipo</th>
								<th>Slug</th>
								<th>Estado</th>
								<th>Cambios</th>
								<th>Hash local</th>
								<th>Hash producción</th>
								<th>Acciones</th>
							</tr>
						</thead>
						<tbody>
							{sortedItems.map((item) => {
								const dryRun = dryRunByRoute[item.route_key];
								const publishEnabled =
									canPublishStatus(item.status) &&
									dryRun?.can_publish === true &&
									Boolean(dryRun.expected_prod_hash);
								const isBusy = busyRoute === item.route_key;
								return (
									<tr key={item.route_key}>
										<td>{item.route_key}</td>
										<td>{item.event_type}</td>
										<td>{item.slug}</td>
										<td>
											<span
												className={`content-sync__status content-sync__status--${item.status}`}
											>
												{STATUS_LABELS[item.status]}
											</span>
										</td>
										<td>{item.changed_paths.length}</td>
										<td>
											<code>{shortHash(item.local_hash)}</code>
										</td>
										<td>
											<code>{shortHash(item.prod_hash)}</code>
										</td>
										<td>
											<div className="content-sync__actions">
												<button
													type="button"
													className="btn-secondary"
													onClick={() => selectItem(item)}
												>
													Ver diferencias
												</button>
												<button
													type="button"
													className="btn-secondary"
													disabled={
														isBusy || !canPublishStatus(item.status)
													}
													onClick={() => void runDryRun(item)}
												>
													Ejecutar revisión
												</button>
												<button
													type="button"
													className="btn-primary"
													disabled={isBusy || !publishEnabled}
													onClick={() => setConfirmTarget(item)}
												>
													Publicar cambios
												</button>
											</div>
										</td>
									</tr>
								);
							})}
							{sortedItems.length === 0 && !loading && (
								<tr>
									<td colSpan={8}>No hay demos para comparar.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<aside className="dashboard-card content-sync__detail">
					{selected ? (
						<>
							<p className="content-sync__eyebrow">Ruta: {selected.route_key}</p>
							<h2>{STATUS_LABELS[selected.status]}</h2>
							<dl className="content-sync__hashes">
								<div>
									<dt>Hash local</dt>
									<dd>{selected.local_hash ?? '—'}</dd>
								</div>
								<div>
									<dt>Hash producción</dt>
									<dd>{selected.prod_hash ?? '—'}</dd>
								</div>
							</dl>
							<h3>Cambios detectados</h3>
							{selected.changed_paths.length > 0 ? (
								<ul className="content-sync__paths">
									{selected.changed_paths.map((path) => (
										<li key={path}>
											<code>{path}</code>
										</li>
									))}
								</ul>
							) : (
								<p>Sin rutas modificadas.</p>
							)}
							{selected.diff_examples.length > 0 && (
								<div className="content-sync__examples">
									{selected.diff_examples.map((example) => (
										<div key={example.path} className="content-sync__example">
											<strong>{example.path}</strong>
											<p>
												<span>- {formatValue(example.before)}</span>
												<span>+ {formatValue(example.after)}</span>
											</p>
										</div>
									))}
								</div>
							)}
						</>
					) : (
						<p>Selecciona un demo para ver diferencias compactas.</p>
					)}
				</aside>
			</div>

			{confirmTarget && (
				<div className="content-sync__modal-backdrop" role="presentation">
					<div className="content-sync__modal" role="dialog" aria-modal="true">
						<h2>Confirmar publicación</h2>
						<p>
							Vas a publicar cambios en producción para el demo{' '}
							<strong>{confirmTarget.route_key}</strong>.
						</p>
						<p>Esta acción actualizará únicamente:</p>
						<ul>
							<li>published_invitation_content.content</li>
							<li>published_invitation_content.version</li>
							<li>published_invitation_content.published_at</li>
						</ul>
						<p>No se tocarán invitados, RSVP, usuarios, roles, pagos ni analíticas.</p>
						<div className="content-sync__modal-actions">
							<button
								type="button"
								className="btn-secondary"
								onClick={() => setConfirmTarget(null)}
							>
								Cancelar
							</button>
							<button
								type="button"
								className="btn-primary"
								onClick={() => void confirmPublish()}
							>
								Publicar cambios
							</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
};

export default ContentSyncPanel;
