import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import {
	resolveMemoriesWindowState,
	type MemoriesSpaceRecord,
	type MemoriesWindowState,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ENTITLEMENTS,
	MEMORIES_LIMIT_PROFILES,
	type MemoriesEntitlement,
	type MemoriesLimitProfile,
	type MemoriesSpaceLimits,
} from '@/lib/memories/contract/limits';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import { formatMemoriesDateTime } from '@/lib/memories/copy';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';

type FormState = {
	eventId: string;
	publicSlug: string;
	timeZone: string;
	uploadStartsLocal: string;
	uploadEndsLocal: string;
	retentionEndsLocal: string;
	entitlement: MemoriesEntitlement;
	enabled: boolean;
	limits: MemoriesSpaceLimits;
};

const ENTITLEMENT_LABEL: Record<MemoriesEntitlement, string> = {
	package: 'Incluido en paquete',
	addon: 'Complemento',
	courtesy: 'Cortesía',
};

const WINDOW_LABEL: Record<MemoriesWindowState, string> = {
	disabled: 'Desactivado',
	before: 'Por abrir',
	open: 'Abierto',
	closed: 'Cerrado',
	expired: 'Caducado',
};

const WINDOW_BADGE: Record<MemoriesWindowState, string> = {
	disabled: 'dashboard-badge--disabled',
	before: 'dashboard-badge--draft',
	open: 'dashboard-badge--active',
	closed: 'dashboard-badge--archived',
	expired: 'dashboard-badge--expired',
};

const LIMIT_FIELDS: Array<{ key: keyof MemoriesSpaceLimits; label: string }> = [
	{ key: 'maxEventObjects', label: 'Archivos por evento' },
	{ key: 'maxEventBytes', label: 'Bytes por evento' },
	{ key: 'maxSessionFiles', label: 'Archivos por invitado' },
	{ key: 'maxSessionVideos', label: 'Videos por invitado' },
	{ key: 'maxSessionBytes', label: 'Bytes por invitado' },
];

function formFromCandidate(candidate: AdminSpaceCandidate): FormState {
	return {
		eventId: candidate.eventId,
		publicSlug: candidate.defaults.publicSlug,
		timeZone: candidate.defaults.timeZone,
		uploadStartsLocal: candidate.defaults.uploadStartsLocal,
		uploadEndsLocal: candidate.defaults.uploadEndsLocal,
		retentionEndsLocal: candidate.defaults.retentionEndsLocal,
		entitlement: 'addon',
		enabled: true,
		limits: { ...candidate.defaults.limits },
	};
}

function toLocalInput(iso: string, timeZone: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		}).formatToParts(new Date(iso));
		const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '00';
		return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
	} catch {
		return iso.slice(0, 16);
	}
}

function formFromSpace(space: MemoriesSpaceRecord): FormState {
	return {
		eventId: space.eventId,
		publicSlug: space.publicSlug,
		timeZone: space.timeZone,
		uploadStartsLocal: toLocalInput(space.uploadStartsAt, space.timeZone),
		uploadEndsLocal: toLocalInput(space.uploadEndsAt, space.timeZone),
		retentionEndsLocal: toLocalInput(space.retentionEndsAt, space.timeZone),
		entitlement: space.entitlement,
		enabled: space.enabled,
		limits: {
			maxEventObjects: space.maxEventObjects,
			maxEventBytes: space.maxEventBytes,
			maxSessionFiles: space.maxSessionFiles,
			maxSessionVideos: space.maxSessionVideos,
			maxSessionBytes: space.maxSessionBytes,
		},
	};
}

function readError(error: unknown, fallback: string): string {
	if (error instanceof MemoriesRequestError && error.code === 'validation_error') {
		return 'Revise los valores: la ventana, la retención o el slug no son válidos.';
	}
	if (error instanceof MemoriesRequestError && error.status === 409) {
		return 'El evento ya tiene recuerdos o el slug público está en uso.';
	}
	return fallback;
}

function MemoriesAdmin() {
	const [spaces, setSpaces] = useState<MemoriesSpaceRecord[]>([]);
	const [candidates, setCandidates] = useState<AdminSpaceCandidate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [mode, setMode] = useState<'create' | 'edit' | null>(null);
	const [form, setForm] = useState<FormState | null>(null);
	const [busy, setBusy] = useState(false);
	const now = useMemo(() => new Date(), [spaces]);

	const load = async () => {
		setLoading(true);
		try {
			const payload = await memoriesAdminApi.list();
			setSpaces(payload.items);
			setCandidates(payload.candidates);
			setError(null);
		} catch {
			setError('No se pudieron cargar los espacios de recuerdos.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, []);

	const startCreate = (candidate: AdminSpaceCandidate) => {
		setMode('create');
		setForm(formFromCandidate(candidate));
		setNotice(null);
	};

	const startEdit = (space: MemoriesSpaceRecord) => {
		setMode('edit');
		setForm(formFromSpace(space));
		setNotice(null);
	};

	const applyProfile = (profile: MemoriesLimitProfile) => {
		setForm((current) =>
			current ? { ...current, limits: { ...MEMORIES_LIMIT_PROFILES[profile] } } : current,
		);
	};

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!form || !mode) return;
		setBusy(true);
		setError(null);
		try {
			const body = {
				timeZone: form.timeZone,
				uploadStartsLocal: form.uploadStartsLocal,
				uploadEndsLocal: form.uploadEndsLocal,
				retentionEndsLocal: form.retentionEndsLocal,
				entitlement: form.entitlement,
				enabled: form.enabled,
				limits: form.limits,
			};
			if (mode === 'create') {
				const created = await memoriesAdminApi.create({
					...body,
					eventId: form.eventId,
					publicSlug: form.publicSlug,
				});
				setNotice(
					`Espacio creado. URL pública: ${buildMemoriesPublicUrl(created.publicSlug)}`,
				);
			} else {
				await memoriesAdminApi.update(form.eventId, body);
				setNotice('Espacio actualizado.');
			}
			setMode(null);
			setForm(null);
			await load();
		} catch (caught) {
			setError(readError(caught, 'No se pudo guardar el espacio de recuerdos.'));
		} finally {
			setBusy(false);
		}
	};

	const toggleEnabled = async (space: MemoriesSpaceRecord) => {
		setBusy(true);
		try {
			await memoriesAdminApi.update(space.eventId, { enabled: !space.enabled });
			await load();
		} catch (caught) {
			setError(readError(caught, 'No se pudo cambiar el estado del espacio.'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="dashboard-main">
			<div className="dashboard-card">
				<div className="dashboard-card-header">
					<h2>Activar recuerdos para un evento</h2>
				</div>
				<p>
					Solo eventos publicados sin espacio. La URL impresa en el QR se fija con el slug
					público y no cambia después.
				</p>
				{candidates.length === 0 ? (
					<p className="dashboard-form-help">
						No hay eventos publicados pendientes de activar.
					</p>
				) : (
					<div className="dashboard-actions">
						{candidates.map((candidate) => (
							<button
								key={candidate.eventId}
								type="button"
								className="btn-secondary"
								disabled={busy}
								onClick={() => startCreate(candidate)}
							>
								{candidate.eventTitle}
							</button>
						))}
					</div>
				)}
				{error ? <p className="dashboard-error">{error}</p> : null}
				{notice ? <p className="dashboard-status">{notice}</p> : null}
			</div>

			{form && mode ? (
				<form className="dashboard-card" onSubmit={submit}>
					<div className="dashboard-card-header">
						<h2>
							{mode === 'create'
								? 'Nuevo espacio de recuerdos'
								: 'Editar espacio de recuerdos'}
						</h2>
					</div>
					<div className="dashboard-form-grid">
						<div className="dashboard-form-field">
							<label htmlFor="memories-public-slug">Slug público</label>
							<input
								id="memories-public-slug"
								value={form.publicSlug}
								disabled={mode === 'edit'}
								onChange={(event) =>
									setForm({ ...form, publicSlug: event.target.value })
								}
							/>
							<small className="dashboard-form-help">
								URL: {buildMemoriesPublicUrl(form.publicSlug || '…')}
							</small>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-time-zone">Zona horaria</label>
							<input
								id="memories-time-zone"
								value={form.timeZone}
								onChange={(event) =>
									setForm({ ...form, timeZone: event.target.value })
								}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-upload-starts">Apertura de carga</label>
							<input
								id="memories-upload-starts"
								type="datetime-local"
								value={form.uploadStartsLocal}
								onChange={(event) =>
									setForm({ ...form, uploadStartsLocal: event.target.value })
								}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-upload-ends">Cierre de carga</label>
							<input
								id="memories-upload-ends"
								type="datetime-local"
								value={form.uploadEndsLocal}
								onChange={(event) =>
									setForm({ ...form, uploadEndsLocal: event.target.value })
								}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-retention-ends">Fin de retención</label>
							<input
								id="memories-retention-ends"
								type="datetime-local"
								value={form.retentionEndsLocal}
								onChange={(event) =>
									setForm({ ...form, retentionEndsLocal: event.target.value })
								}
							/>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-entitlement">Origen comercial</label>
							<select
								id="memories-entitlement"
								value={form.entitlement}
								onChange={(event) =>
									setForm({
										...form,
										entitlement: event.target.value as MemoriesEntitlement,
									})
								}
							>
								{MEMORIES_ENTITLEMENTS.map((entitlement) => (
									<option key={entitlement} value={entitlement}>
										{ENTITLEMENT_LABEL[entitlement]}
									</option>
								))}
							</select>
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="memories-profile">Perfil de límites</label>
							<select
								id="memories-profile"
								defaultValue=""
								onChange={(event) => {
									if (event.target.value)
										applyProfile(event.target.value as MemoriesLimitProfile);
								}}
							>
								<option value="">Personalizado</option>
								{Object.keys(MEMORIES_LIMIT_PROFILES).map((profile) => (
									<option key={profile} value={profile}>
										{profile}
									</option>
								))}
							</select>
						</div>
						{LIMIT_FIELDS.map((field) => (
							<div className="dashboard-form-field" key={field.key}>
								<label htmlFor={`memories-${field.key}`}>{field.label}</label>
								<input
									id={`memories-${field.key}`}
									type="number"
									min={0}
									value={form.limits[field.key]}
									onChange={(event) =>
										setForm({
											...form,
											limits: {
												...form.limits,
												[field.key]: Number(event.target.value),
											},
										})
									}
								/>
							</div>
						))}
						<div className="dashboard-form-field">
							<label htmlFor="memories-enabled">
								<input
									id="memories-enabled"
									type="checkbox"
									checked={form.enabled}
									onChange={(event) =>
										setForm({ ...form, enabled: event.target.checked })
									}
								/>{' '}
								Habilitado
							</label>
						</div>
					</div>
					<div className="dashboard-actions">
						<button type="submit" className="btn-primary" disabled={busy}>
							{busy ? 'Guardando…' : 'Guardar'}
						</button>
						<button
							type="button"
							className="btn-ghost"
							disabled={busy}
							onClick={() => {
								setMode(null);
								setForm(null);
							}}
						>
							Cancelar
						</button>
					</div>
				</form>
			) : null}

			<div className="dashboard-card">
				<div className="dashboard-card-header">
					<h2>Espacios activos</h2>
				</div>
				{loading ? <p className="dashboard-status">Cargando…</p> : null}
				{!loading && spaces.length === 0 ? (
					<p>Todavía no hay espacios de recuerdos.</p>
				) : null}
				{spaces.length > 0 ? (
					<table className="dashboard-table">
						<thead>
							<tr>
								<th>Evento</th>
								<th>URL pública</th>
								<th>Ventana</th>
								<th>Retención</th>
								<th>Origen</th>
								<th>Estado</th>
								<th>Acciones</th>
							</tr>
						</thead>
						<tbody>
							{spaces.map((space) => {
								const windowState = resolveMemoriesWindowState(space, now);
								return (
									<tr key={space.eventId}>
										<td>{space.eventTitle}</td>
										<td>
											<code>{buildMemoriesPublicUrl(space.publicSlug)}</code>
										</td>
										<td>
											{formatMemoriesDateTime(
												space.uploadStartsAt,
												space.timeZone,
											)}{' '}
											→{' '}
											{formatMemoriesDateTime(
												space.uploadEndsAt,
												space.timeZone,
											)}
										</td>
										<td>
											{formatMemoriesDateTime(
												space.retentionEndsAt,
												space.timeZone,
											)}
										</td>
										<td>{ENTITLEMENT_LABEL[space.entitlement]}</td>
										<td>
											<span
												className={`dashboard-badge ${WINDOW_BADGE[windowState]}`}
											>
												{WINDOW_LABEL[windowState]}
											</span>
										</td>
										<td>
											<div className="dashboard-actions">
												<button
													type="button"
													className="btn-secondary"
													disabled={busy}
													onClick={() => startEdit(space)}
												>
													Editar
												</button>
												<button
													type="button"
													className="btn-ghost"
													disabled={busy}
													onClick={() => void toggleEnabled(space)}
												>
													{space.enabled ? 'Desactivar' : 'Activar'}
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				) : null}
			</div>
		</section>
	);
}

export default function MemoriesAdminWithErrorBoundary() {
	return (
		<ErrorBoundary>
			<MemoriesAdmin />
		</ErrorBoundary>
	);
}
