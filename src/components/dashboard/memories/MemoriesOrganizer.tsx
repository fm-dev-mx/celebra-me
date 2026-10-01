/* eslint-disable max-lines -- The catalog and guarded export workflow remain colocated until the dashboard interaction contract stabilizes. */
import { useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import {
	MEMORIES_MEDIA_STATUSES,
	isMemoriesCatalogVisibleStatus,
	type MemoriesMediaStatus,
	type MemoriesOrganizerItem,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ARCHIVE_MAX_BYTES,
	MEMORIES_ARCHIVE_MAX_FILES,
	MEMORIES_MAX_CAPTION_LENGTH,
	MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH,
} from '@/lib/memories/contract/limits';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import { formatMemoriesDateTime, formatMemoriesFileSize } from '@/lib/memories/copy';
import { memoriesOrganizerApi, type OrganizerSpaceItem } from '@/lib/memories/client/api';
import {
	createEncryptedMemoriesZip,
	generateBulkZipPassphrase,
	partitionMemoriesExport,
	type BulkExportProgress,
} from '@/lib/memories/client/export';
import { zonedDayBounds } from '@/lib/memories/client/zoned-date';

const EVENT_STORAGE_KEY = 'memories-dashboard-event-id';

type OrganizerItem = MemoriesOrganizerItem;
type ExportScope = 'all' | 'selected';
type ExportStep = 'confirm' | 'password' | 'processing' | 'complete';

export type MemoriesOrganizerCatalogFilters = {
	status: 'all' | MemoriesMediaStatus;
	uploader: string;
	createdOn: string;
};

type ConfirmAction = { type: 'reject' | 'delete' | 'block'; item: OrganizerItem };

type MemoriesOrganizerProps = {
	spaces: OrganizerSpaceItem[];
	initialEventId?: string;
};

const EMPTY_FILTERS: MemoriesOrganizerCatalogFilters = {
	status: 'all',
	uploader: '',
	createdOn: '',
};

const statusLabel: Record<MemoriesMediaStatus, string> = {
	uploading: 'Subiendo',
	validating: 'Pendiente de validación',
	accepted: 'Aprobado',
	rejected: 'Rechazado',
	deleted: 'Eliminado',
	duplicate: 'Duplicado',
};

const statusBadgeClass: Record<MemoriesMediaStatus, string> = {
	uploading: 'dashboard-badge--disabled',
	validating: 'dashboard-badge--draft',
	accepted: 'dashboard-badge--active',
	rejected: 'dashboard-badge--inconsistent',
	deleted: 'dashboard-badge--archived',
	duplicate: 'dashboard-badge--generated',
};

function readStoredEventId(): string {
	try {
		return window.localStorage.getItem(EVENT_STORAGE_KEY) ?? '';
	} catch {
		return '';
	}
}

function resolvePreferredEventId(initialEventId: string, spaces: OrganizerSpaceItem[]): string {
	const candidates = [initialEventId, readStoredEventId(), spaces[0]?.eventId ?? ''].filter(
		Boolean,
	);
	return (
		candidates.find((candidate) => spaces.some((space) => space.eventId === candidate)) ?? ''
	);
}

function toApiFilters(filters: MemoriesOrganizerCatalogFilters, timeZone: string) {
	const bounds = zonedDayBounds(filters.createdOn, timeZone);
	return {
		status: filters.status,
		uploader: filters.uploader,
		createdFrom: bounds?.createdFrom,
		createdTo: bounds?.createdTo,
	};
}

function downloadBlob(blob: Blob, publicSlug: string, batchIndex: number): void {
	const downloadUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = downloadUrl;
	link.download = `recuerdos-${publicSlug}-${new Date().toISOString().slice(0, 10)}-parte-${batchIndex + 1}.zip`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(downloadUrl);
}

// eslint-disable-next-line complexity -- Each explicit dashboard state is rendered fail-closed in one owner-only surface.
export default function MemoriesOrganizer({ spaces, initialEventId = '' }: MemoriesOrganizerProps) {
	const [eventId, setEventId] = useState(() => resolvePreferredEventId(initialEventId, spaces));
	const space = useMemo(
		() => spaces.find((entry) => entry.eventId === eventId) ?? null,
		[spaces, eventId],
	);
	const [items, setItems] = useState<OrganizerItem[]>([]);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
	const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
	const [selectedById, setSelectedById] = useState<Record<string, OrganizerItem>>({});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [caption, setCaption] = useState('');
	const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
	const [actionBusy, setActionBusy] = useState(false);

	const [exportScope, setExportScope] = useState<ExportScope | null>(null);
	const [exportStep, setExportStep] = useState<ExportStep>('confirm');
	const [exportItems, setExportItems] = useState<OrganizerItem[]>([]);
	const [exportBatches, setExportBatches] = useState<OrganizerItem[][]>([]);
	const [exportPassphrase, setExportPassphrase] = useState('');
	const [passphraseCopied, setPassphraseCopied] = useState(false);
	const [passphraseConfirmed, setPassphraseConfirmed] = useState(false);
	const [exportProgress, setExportProgress] = useState<BulkExportProgress | null>(null);
	const [exportBatchIndex, setExportBatchIndex] = useState(0);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);
	const loadAbortRef = useRef<AbortController | null>(null);

	const selectedItems = useMemo(() => Object.values(selectedById), [selectedById]);
	const filtersActive =
		appliedFilters.status !== 'all' ||
		Boolean(appliedFilters.uploader) ||
		Boolean(appliedFilters.createdOn);
	const draftFiltersActive =
		draftFilters.status !== 'all' ||
		Boolean(draftFilters.uploader) ||
		Boolean(draftFilters.createdOn);

	const load = async (page = 0, append = false, filters = appliedFilters): Promise<boolean> => {
		if (!space) return false;
		loadAbortRef.current?.abort();
		const controller = new AbortController();
		loadAbortRef.current = controller;
		setLoading(true);
		try {
			const payload = await memoriesOrganizerApi.listItems(
				space.eventId,
				page,
				toApiFilters(filters, space.timeZone),
				controller.signal,
			);
			const loadedItems = payload.items.filter((item) =>
				isMemoriesCatalogVisibleStatus(item.status),
			);
			setItems((current) => (append ? [...current, ...loadedItems] : loadedItems));
			setNextPage(typeof payload.nextPage === 'number' ? payload.nextPage : null);
			setError(null);
			return true;
		} catch (caught) {
			if (caught instanceof DOMException && caught.name === 'AbortError') return false;
			if (controller.signal.aborted) return false;
			const status = (caught as { status?: number }).status;
			setError(
				status === 403
					? 'No tiene autorización para este evento.'
					: 'No se pudo cargar el catálogo de recuerdos.',
			);
			return false;
		} finally {
			if (loadAbortRef.current === controller) setLoading(false);
		}
	};

	useEffect(() => {
		if (!eventId) return;
		try {
			window.localStorage.setItem(EVENT_STORAGE_KEY, eventId);
		} catch {
			// Storage is a convenience only.
		}
		setSelectedById({});
		setDraftFilters(EMPTY_FILTERS);
		setAppliedFilters(EMPTY_FILTERS);
		void load(0, false, EMPTY_FILTERS);
		return () => loadAbortRef.current?.abort();
		// The catalog reloads only when the selected space changes.
	}, [eventId]);

	const applyFilters = (event: { preventDefault(): void }) => {
		event.preventDefault();
		const normalized = {
			...draftFilters,
			uploader: draftFilters.uploader.replace(/\s+/g, ' ').trim(),
		};
		setAppliedFilters(normalized);
		void load(0, false, normalized);
	};

	const clearFilters = () => {
		setDraftFilters(EMPTY_FILTERS);
		setAppliedFilters(EMPTY_FILTERS);
		void load(0, false, EMPTY_FILTERS);
	};

	const updateItem = async (item: OrganizerItem, body: { caption?: string; status?: string }) => {
		if (!space) return false;
		try {
			await memoriesOrganizerApi.updateItem(space.eventId, item.id, body);
		} catch {
			setError('No se pudo actualizar el recuerdo.');
			return false;
		}
		await load(0, false, appliedFilters);
		return true;
	};

	const removeItem = async (item: OrganizerItem) => {
		if (!space) return false;
		try {
			await memoriesOrganizerApi.deleteItem(space.eventId, item.id);
		} catch {
			setError('No se pudo eliminar el recuerdo.');
			return false;
		}
		setSelectedById((current) => {
			const next = { ...current };
			delete next[item.id];
			return next;
		});
		await load(0, false, appliedFilters);
		return true;
	};

	const revokeUploader = async (item: OrganizerItem) => {
		if (!space) return false;
		try {
			await memoriesOrganizerApi.revokeUploader(space.eventId, item.uploader.guestAlias);
			return true;
		} catch {
			setError('No se pudo bloquear la sesión del invitado.');
			return false;
		}
	};

	const confirmSecondaryAction = async () => {
		if (!confirmAction) return;
		setActionBusy(true);
		try {
			let completed = false;
			if (confirmAction.type === 'reject')
				completed = await updateItem(confirmAction.item, { status: 'rejected' });
			if (confirmAction.type === 'delete') completed = await removeItem(confirmAction.item);
			if (confirmAction.type === 'block')
				completed = await revokeUploader(confirmAction.item);
			if (completed) setConfirmAction(null);
		} finally {
			setActionBusy(false);
		}
	};

	const toggleSelected = (item: OrganizerItem) => {
		if (item.status !== 'accepted') return;
		setSelectedById((current) => {
			const next = { ...current };
			if (next[item.id]) delete next[item.id];
			else next[item.id] = item;
			return next;
		});
	};

	const fetchAllAccepted = async (): Promise<OrganizerItem[]> => {
		if (!space) return [];
		let page = 0;
		const accepted: OrganizerItem[] = [];
		let hasNextPage = true;
		while (hasNextPage) {
			const payload = await memoriesOrganizerApi.listItems(space.eventId, page, {
				status: 'accepted',
			});
			accepted.push(...payload.items);
			hasNextPage = typeof payload.nextPage === 'number';
			if (hasNextPage) page = payload.nextPage as number;
		}
		return accepted;
	};

	const openExport = async (scope: ExportScope) => {
		if (scope === 'selected' && selectedItems.length === 0) {
			setError('Seleccione al menos un recuerdo aprobado.');
			return;
		}
		setExportScope(scope);
		setExportStep('confirm');
		setExportItems([]);
		setExportBatches([]);
		setExportPassphrase('');
		setPassphraseCopied(false);
		setPassphraseConfirmed(false);
		setExportProgress(null);
		setExportBatchIndex(0);
		setExportError(null);
		setExporting(true);
		try {
			const candidates =
				scope === 'all'
					? await fetchAllAccepted()
					: selectedItems.filter((item) => item.status === 'accepted');
			if (candidates.length === 0)
				throw new Error('No hay recuerdos aprobados en este alcance.');
			setExportItems(candidates);
			setExportBatches(partitionMemoriesExport(candidates));
		} catch (caught) {
			setExportError(
				caught instanceof Error ? caught.message : 'No se pudo preparar la exportación.',
			);
		} finally {
			setExporting(false);
		}
	};

	const createExportPassword = () => {
		if (!exportScope || exportItems.length === 0 || exportBatches.length === 0) return;
		setExportError(null);
		try {
			setExportPassphrase(generateBulkZipPassphrase());
			setExportStep('password');
		} catch (caught) {
			setExportError(
				caught instanceof Error ? caught.message : 'No se pudo preparar la exportación.',
			);
		}
	};

	const copyPassphrase = async () => {
		try {
			await navigator.clipboard.writeText(exportPassphrase);
			setPassphraseCopied(true);
		} catch {
			setExportError('No se pudo copiar automáticamente. Seleccione y copie la contraseña.');
		}
	};

	const runExport = async () => {
		if (!space || !passphraseConfirmed || !exportPassphrase || exportBatches.length === 0)
			return;
		setExporting(true);
		setExportStep('processing');
		setExportError(null);
		let unavailableItemId: string | null = null;
		let activeBatchIndex = exportBatchIndex;
		try {
			for (let index = exportBatchIndex; index < exportBatches.length; index += 1) {
				activeBatchIndex = index;
				setExportBatchIndex(index);
				const batch = exportBatches[index];
				if (batch.length === 0) {
					setExportBatchIndex(index + 1);
					continue;
				}
				const completedBefore = exportBatches
					.slice(0, index)
					.reduce((total, current) => total + current.length, 0);
				const blob = await createEncryptedMemoriesZip({
					folderName: `recuerdos-${space.publicSlug}`,
					items: batch,
					passphrase: exportPassphrase,
					fetchItemBlob: async (item) => {
						try {
							return await memoriesOrganizerApi.fetchItemBlob(space.eventId, item.id);
						} catch {
							unavailableItemId = item.id;
							throw new Error(
								'Un recuerdo dejó de estar disponible. Revise el alcance y reintente este lote.',
							);
						}
					},
					onProgress: (progress) =>
						setExportProgress({
							completed: completedBefore + progress.completed,
							total: exportItems.length,
							currentFileName: progress.currentFileName,
						}),
				});
				downloadBlob(blob, space.publicSlug, index);
				setExportBatchIndex(index + 1);
			}
			setExportProgress({
				completed: exportItems.length,
				total: exportItems.length,
				currentFileName: 'Completado',
			});
			setExportStep('complete');
		} catch (caught) {
			if (unavailableItemId) {
				const unavailableId = unavailableItemId;
				setExportItems((current) => current.filter((item) => item.id !== unavailableId));
				setExportBatches((current) =>
					current.map((batch, index) =>
						index === activeBatchIndex
							? batch.filter((item) => item.id !== unavailableId)
							: batch,
					),
				);
			}
			setExportError(
				caught instanceof Error ? caught.message : 'No se pudo generar el lote cifrado.',
			);
		} finally {
			setExporting(false);
		}
	};

	const closeExport = () => {
		if (exporting) return;
		setExportScope(null);
		setExportPassphrase('');
		setExportItems([]);
		setExportBatches([]);
		setExportError(null);
	};

	const confirmCopy = confirmAction
		? {
				reject: {
					title: 'Rechazar recuerdo',
					body: 'El archivo dejará de estar disponible para descarga. Puede eliminarlo después si corresponde.',
					button: 'Rechazar recuerdo',
				},
				delete: {
					title: 'Eliminar recuerdo',
					body: 'Esta acción inicia el ciclo de eliminación del archivo y no se puede deshacer desde el panel.',
					button: 'Eliminar recuerdo',
				},
				block: {
					title: 'Bloquear futuras cargas',
					body: `Se bloquearán futuras cargas de ${confirmAction.item.uploader.displayName}. Los archivos existentes no cambian.`,
					button: 'Bloquear sesión',
				},
			}[confirmAction.type]
		: null;

	if (!space) {
		return (
			<section
				className="dashboard-card dashboard-memories"
				aria-label="Catálogo de recuerdos"
			>
				<p className="dashboard-memories__empty">
					Seleccione un evento con recuerdos activos.
				</p>
			</section>
		);
	}

	return (
		<section className="dashboard-card dashboard-memories" aria-label="Catálogo de recuerdos">
			<div className="dashboard-memories__topbar">
				<div>
					<p className="dashboard-memories__eyebrow">Catálogo privado</p>
					<p>Revise y descargue los recuerdos enviados por sus invitados.</p>
					<p>
						Disponible hasta el{' '}
						{formatMemoriesDateTime(space.retentionEndsAt, space.timeZone)}.
					</p>
				</div>
				<div className="dashboard-memories__header-actions">
					{spaces.length > 1 ? (
						<label>
							Evento
							<select
								value={eventId}
								onChange={(event) => setEventId(event.target.value)}
							>
								{spaces.map((entry) => (
									<option key={entry.eventId} value={entry.eventId}>
										{entry.eventTitle}
									</option>
								))}
							</select>
						</label>
					) : (
						<strong>{space.eventTitle}</strong>
					)}
					<button type="button" className="btn-secondary" onClick={() => void load()}>
						Actualizar
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={() => void openExport('all')}
					>
						Descargar todos los aprobados
					</button>
				</div>
			</div>

			<form className="dashboard-memories__toolbar" onSubmit={applyFilters}>
				<label>
					Estado
					<select
						value={draftFilters.status}
						onChange={(event) =>
							setDraftFilters((current) => ({
								...current,
								status: event.target.value as typeof current.status,
							}))
						}
					>
						<option value="all">Todos los estados</option>
						{MEMORIES_MEDIA_STATUSES.filter(isMemoriesCatalogVisibleStatus).map(
							(status) => (
								<option key={status} value={status}>
									{statusLabel[status]}
								</option>
							),
						)}
					</select>
				</label>
				<label>
					Invitado
					<input
						value={draftFilters.uploader}
						maxLength={MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH}
						onChange={(event) =>
							setDraftFilters((current) => ({
								...current,
								uploader: event.target.value,
							}))
						}
						placeholder="Nombre o alias"
					/>
				</label>
				<label>
					Fecha del evento
					<input
						type="date"
						value={draftFilters.createdOn}
						onChange={(event) =>
							setDraftFilters((current) => ({
								...current,
								createdOn: event.target.value,
							}))
						}
					/>
				</label>
				<div className="dashboard-memories__filter-actions">
					<button type="submit" className="btn-primary" disabled={loading}>
						Aplicar filtros
					</button>
					<button
						type="button"
						className="btn-ghost"
						onClick={clearFilters}
						disabled={!filtersActive && !draftFiltersActive}
					>
						Limpiar filtros
					</button>
				</div>
			</form>

			<div className="dashboard-memories__selection-bar" aria-live="polite">
				<p>
					<strong>{selectedItems.length}</strong>{' '}
					{selectedItems.length === 1
						? 'recuerdo aprobado seleccionado'
						: 'recuerdos aprobados seleccionados'}
				</p>
				<div>
					<button
						type="button"
						className="btn-ghost"
						disabled={selectedItems.length === 0}
						onClick={() => setSelectedById({})}
					>
						Limpiar selección
					</button>
					<button
						type="button"
						className="btn-primary"
						disabled={selectedItems.length === 0}
						onClick={() => void openExport('selected')}
					>
						Descargar seleccionados
					</button>
				</div>
			</div>

			{error ? (
				<p role="alert" className="dashboard-memories__error">
					{error}
				</p>
			) : null}
			{loading && items.length === 0 ? (
				<p className="dashboard-memories__empty" aria-live="polite">
					Cargando recuerdos…
				</p>
			) : items.length === 0 ? (
				<div className="dashboard-memories__empty">
					<strong>{filtersActive ? 'No hay resultados' : 'Aún no hay recuerdos'}</strong>
					<p>
						{filtersActive
							? 'Cambie o limpie los filtros para revisar el catálogo.'
							: 'Los archivos aparecerán aquí cuando sus invitados los envíen.'}
					</p>
				</div>
			) : (
				<>
					<div className="dashboard-memories__grid" aria-busy={loading}>
						{items.map((item) => {
							const accepted = item.status === 'accepted';
							const selected = Boolean(selectedById[item.id]);
							const previewUrl = memoriesOrganizerApi.itemMediaUrl(
								space.eventId,
								item.id,
								'preview',
							);
							return (
								<article className="dashboard-memories__item" key={item.id}>
									<label className="dashboard-memories__select">
										<input
											type="checkbox"
											checked={selected}
											disabled={!accepted}
											onChange={() => toggleSelected(item)}
											aria-label={`Seleccionar recuerdo de ${item.uploader.displayName}`}
										/>
										<span>{accepted ? 'Seleccionar' : 'No descargable'}</span>
									</label>
									<div className="dashboard-memories__media">
										{accepted ? (
											isMemoriesVideoMime(item.mimeType) ? (
												<video
													controls
													preload="metadata"
													src={previewUrl}
												/>
											) : (
												<img
													loading="lazy"
													src={previewUrl}
													alt={
														item.caption ||
														`Recuerdo de ${item.uploader.displayName}`
													}
												/>
											)
										) : (
											<div className="dashboard-memories__placeholder">
												<span aria-hidden="true">◇</span>
												{statusLabel[item.status]}
											</div>
										)}
									</div>
									<div className="dashboard-memories__meta">
										<span
											className={`dashboard-badge ${statusBadgeClass[item.status]}`}
										>
											{statusLabel[item.status]}
										</span>
										<strong>{item.uploader.displayName}</strong>
										<span>Alias: {item.uploader.guestAlias}</span>
										<small>
											{formatMemoriesDateTime(item.createdAt, space.timeZone)}{' '}
											· {formatMemoriesFileSize(item.sizeBytes)}
										</small>
									</div>
									{editingId === item.id ? (
										<div className="dashboard-memories__edit">
											<label htmlFor={`caption-${item.id}`}>
												Descripción
											</label>
											<textarea
												id={`caption-${item.id}`}
												value={caption}
												maxLength={MEMORIES_MAX_CAPTION_LENGTH}
												onChange={(event) => setCaption(event.target.value)}
											/>
											<div>
												<button
													type="button"
													className="btn-primary"
													onClick={() =>
														void updateItem(item, { caption }).then(
															(updated) => {
																if (updated) setEditingId(null);
															},
														)
													}
												>
													Guardar
												</button>
												<button
													type="button"
													className="btn-ghost"
													onClick={() => setEditingId(null)}
												>
													Cancelar
												</button>
											</div>
										</div>
									) : (
										<p className="dashboard-memories__caption">
											{item.caption || 'Sin descripción'}
										</p>
									)}
									<div className="dashboard-memories__primary-actions">
										{accepted ? (
											<a
												className="btn-primary"
												href={memoriesOrganizerApi.itemMediaUrl(
													space.eventId,
													item.id,
												)}
												download
											>
												Descargar archivo
											</a>
										) : (
											<span>{statusLabel[item.status]}</span>
										)}
									</div>
									<details className="dashboard-memories__more-actions">
										<summary>Más acciones</summary>
										<div>
											<button
												type="button"
												className="btn-secondary"
												onClick={() => {
													setEditingId(item.id);
													setCaption(item.caption);
												}}
											>
												Editar descripción
											</button>
											{item.status === 'validating' || accepted ? (
												<button
													type="button"
													className="btn-secondary"
													onClick={() =>
														setConfirmAction({ type: 'reject', item })
													}
												>
													Rechazar
												</button>
											) : null}
											{item.status !== 'deleted' ? (
												<button
													type="button"
													className="btn-secondary"
													onClick={() =>
														setConfirmAction({ type: 'delete', item })
													}
												>
													Eliminar
												</button>
											) : null}
											<button
												type="button"
												className="btn-secondary"
												onClick={() =>
													setConfirmAction({ type: 'block', item })
												}
											>
												Bloquear sesión
											</button>
										</div>
									</details>
								</article>
							);
						})}
					</div>
					{nextPage !== null ? (
						<div className="dashboard-memories__load-more">
							<button
								type="button"
								className="btn-secondary"
								disabled={loading}
								onClick={() => void load(nextPage, true)}
							>
								{loading ? 'Cargando…' : 'Cargar más recuerdos'}
							</button>
						</div>
					) : null}
				</>
			)}

			{confirmAction && confirmCopy ? (
				<ModalShell
					title={confirmCopy.title}
					variant="confirm"
					size="sm"
					descriptionId="memories-confirm-description"
					disableClose={actionBusy}
					onClose={() => setConfirmAction(null)}
					footer={
						<>
							<button
								type="button"
								className="btn-secondary"
								disabled={actionBusy}
								onClick={() => setConfirmAction(null)}
							>
								Cancelar
							</button>
							<button
								type="button"
								className="btn-primary"
								disabled={actionBusy}
								onClick={() => void confirmSecondaryAction()}
							>
								{actionBusy ? 'Procesando…' : confirmCopy.button}
							</button>
						</>
					}
				>
					<p id="memories-confirm-description">{confirmCopy.body}</p>
				</ModalShell>
			) : null}

			{exportScope ? (
				<ModalShell
					title="Descargar recuerdos cifrados"
					subtitle={
						exportScope === 'all'
							? 'Todos los recuerdos aprobados, sin aplicar los filtros visibles.'
							: 'Solo los recuerdos aprobados que seleccionó.'
					}
					size="lg"
					descriptionId="memories-export-description"
					disableClose={exporting}
					onClose={closeExport}
					footer={
						exportStep === 'confirm' ? (
							<>
								<button
									type="button"
									className="btn-secondary"
									onClick={closeExport}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={exporting || exportItems.length === 0}
									onClick={createExportPassword}
								>
									{exporting
										? 'Calculando alcance…'
										: 'Continuar y crear contraseña'}
								</button>
							</>
						) : exportStep === 'password' ? (
							<>
								<button
									type="button"
									className="btn-secondary"
									onClick={closeExport}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={!passphraseConfirmed || exporting}
									onClick={() => void runExport()}
								>
									Generar{' '}
									{exportBatches.length === 1
										? 'ZIP'
										: `${exportBatches.length} ZIP`}
								</button>
							</>
						) : exportStep === 'processing' && exportError ? (
							<>
								<button
									type="button"
									className="btn-secondary"
									onClick={closeExport}
								>
									Cerrar
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={exporting}
									onClick={() => void runExport()}
								>
									Reintentar lote {exportBatchIndex + 1}
								</button>
							</>
						) : exportStep === 'complete' ? (
							<button type="button" className="btn-primary" onClick={closeExport}>
								Finalizar
							</button>
						) : null
					}
				>
					<div className="dashboard-memories__export" id="memories-export-description">
						<ol
							className="dashboard-memories__steps"
							aria-label="Progreso de exportación"
						>
							<li aria-current={exportStep === 'confirm' ? 'step' : undefined}>
								1. Alcance
							</li>
							<li aria-current={exportStep === 'password' ? 'step' : undefined}>
								2. Contraseña
							</li>
							<li
								aria-current={
									exportStep === 'processing' || exportStep === 'complete'
										? 'step'
										: undefined
								}
							>
								3. Archivos ZIP
							</li>
						</ol>
						{exportStep === 'confirm' ? (
							<div>
								<h4>Confirme el alcance</h4>
								<p>
									{exporting
										? 'Calculando cantidad y particiones…'
										: `${exportItems.length} archivos aprobados en ${exportBatches.length} ${exportBatches.length === 1 ? 'lote' : 'lotes'}.`}
								</p>
								<p>
									Cada ZIP conserva los límites de {MEMORIES_ARCHIVE_MAX_FILES}{' '}
									archivos y {MEMORIES_ARCHIVE_MAX_BYTES / 1024 / 1024} MiB.
								</p>
							</div>
						) : null}
						{exportStep === 'password' ? (
							<div className="dashboard-memories__password">
								<h4>Guarde la contraseña antes de continuar</h4>
								<p>
									La contraseña se generó en este navegador. No se guarda ni se
									envía al servidor y será necesaria para abrir cada ZIP.
								</p>
								<div className="dashboard-memories__password-value">
									<code tabIndex={0}>{exportPassphrase}</code>
									<button
										type="button"
										className="btn-secondary"
										onClick={() => void copyPassphrase()}
									>
										{passphraseCopied
											? 'Contraseña copiada'
											: 'Copiar contraseña'}
									</button>
								</div>
								<p>
									{exportItems.length} archivos en {exportBatches.length}{' '}
									{exportBatches.length === 1 ? 'lote' : 'lotes'}.
								</p>
								<label className="dashboard-memories__password-confirm">
									<input
										type="checkbox"
										checked={passphraseConfirmed}
										onChange={(event) =>
											setPassphraseConfirmed(event.target.checked)
										}
									/>
									<span>
										Confirmo que guardé la contraseña en un lugar seguro.
									</span>
								</label>
							</div>
						) : null}
						{exportStep === 'processing' || exportStep === 'complete' ? (
							<div className="dashboard-memories__progress" aria-live="polite">
								<h4>
									{exportStep === 'complete'
										? 'Descarga preparada'
										: `Generando lote ${Math.min(exportBatchIndex + 1, exportBatches.length)} de ${exportBatches.length}`}
								</h4>
								<progress
									value={exportProgress?.completed ?? 0}
									max={Math.max(exportProgress?.total ?? exportItems.length, 1)}
								/>
								<p>
									{exportProgress
										? `${exportProgress.completed} de ${exportProgress.total}: ${exportProgress.currentFileName}`
										: 'Preparando archivos…'}
								</p>
								<p className="dashboard-memories__password-reminder">
									Contraseña: <code>{exportPassphrase}</code>
								</p>
							</div>
						) : null}
						{exportError ? (
							<p role="alert" className="dashboard-memories__error">
								{exportError}
							</p>
						) : null}
					</div>
				</ModalShell>
			) : null}
		</section>
	);
}
