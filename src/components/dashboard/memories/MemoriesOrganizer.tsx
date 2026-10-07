import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import {
	isMemoriesCatalogVisibleStatus,
	type MemoriesOrganizerItem,
	type MemoriesOrganizerUploader,
} from '@/lib/memories/contract/catalog';
import { memoriesOrganizerApi, type OrganizerSpaceItem } from '@/lib/memories/client/api';
import { zonedDayBounds } from '@/lib/memories/client/zoned-date';
import MemoriesHostSummary from '@/components/dashboard/memories/MemoriesHostSummary';
import MemoriesGallery from '@/components/dashboard/memories/MemoriesGallery';
import MemoriesLightbox from '@/components/dashboard/memories/MemoriesLightbox';
import MemoriesFilters, {
	EMPTY_MEMORIES_FILTERS,
	hasMemoriesFilters,
	type MemoriesOrganizerFilters,
} from '@/components/dashboard/memories/MemoriesFilters';
import MemoriesExportWizard, {
	type MemoriesExportScope,
} from '@/components/dashboard/memories/MemoriesExportWizard';

const EVENT_STORAGE_KEY = 'memories-dashboard-event-id';

type OrganizerItem = MemoriesOrganizerItem;
type ConfirmAction = { type: 'delete' | 'block'; items: OrganizerItem[] };

type MemoriesOrganizerProps = {
	spaces: OrganizerSpaceItem[];
	initialEventId?: string;
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

function toApiFilters(filters: MemoriesOrganizerFilters, timeZone: string) {
	const bounds = zonedDayBounds(filters.createdOn, timeZone);
	return {
		status: 'all' as const,
		uploader: '',
		uploaderAlias: filters.uploaderAlias,
		kind: filters.kind,
		visibility: filters.hiddenOnly ? 'hidden' : '',
		createdFrom: bounds?.createdFrom,
		createdTo: bounds?.createdTo,
	};
}

function confirmCopy(action: ConfirmAction) {
	const count = action.items.length;
	if (action.type === 'delete') {
		return count === 1
			? {
					title: 'Eliminar recuerdo',
					body: 'El archivo se eliminará y no podrá recuperarlo desde el panel.',
					button: 'Eliminar recuerdo',
				}
			: {
					title: `Eliminar ${count} recuerdos`,
					body: 'Los archivos se eliminarán y no podrá recuperarlos desde el panel.',
					button: `Eliminar ${count} recuerdos`,
				};
	}
	const name = action.items[0]?.uploader.displayName ?? '';
	return {
		title: 'Bloquear a este invitado',
		body: `${name} ya no podrá subir más archivos. Lo que ya compartió no cambia.`,
		button: 'Bloquear invitado',
	};
}

/** Host memories page: summary, QR, a day-grouped gallery, the viewer and downloads. */
export default function MemoriesOrganizer({ spaces, initialEventId = '' }: MemoriesOrganizerProps) {
	const [eventId, setEventId] = useState(() => resolvePreferredEventId(initialEventId, spaces));
	const space = useMemo(
		() => spaces.find((entry) => entry.eventId === eventId) ?? null,
		[spaces, eventId],
	);
	const [items, setItems] = useState<OrganizerItem[]>([]);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [filters, setFilters] = useState(EMPTY_MEMORIES_FILTERS);
	const [selecting, setSelecting] = useState(false);
	const [selectedById, setSelectedById] = useState<Record<string, OrganizerItem>>({});
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
	const [actionBusy, setActionBusy] = useState(false);
	const [summaryRefresh, setSummaryRefresh] = useState(0);
	const [exportScope, setExportScope] = useState<MemoriesExportScope | null>(null);
	const [uploaders, setUploaders] = useState<MemoriesOrganizerUploader[]>([]);
	const loadAbortRef = useRef<AbortController | null>(null);

	const selectedItems = useMemo(() => Object.values(selectedById), [selectedById]);
	const filtersActive = hasMemoriesFilters(filters);

	const load = async (page = 0, append = false, applied = filters): Promise<boolean> => {
		if (!space) return false;
		loadAbortRef.current?.abort();
		const controller = new AbortController();
		loadAbortRef.current = controller;
		setLoading(true);
		try {
			const payload = await memoriesOrganizerApi.listItems(
				space.eventId,
				page,
				toApiFilters(applied, space.timeZone),
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
					: 'No se pudo cargar la galería. Revise su conexión; sus recuerdos siguen guardados.',
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
		setSelecting(false);
		setSelectedById({});
		setViewerIndex(null);
		setFilters(EMPTY_MEMORIES_FILTERS);
		void load(0, false, EMPTY_MEMORIES_FILTERS);
		return () => loadAbortRef.current?.abort();
		// The catalog reloads only when the selected space changes.
	}, [eventId]);

	useEffect(() => {
		if (!eventId) return;
		const controller = new AbortController();
		memoriesOrganizerApi
			.uploaders(eventId, controller.signal)
			.then(setUploaders)
			.catch(() => {
				// The guest filter is optional; the gallery still works without it.
			});
		return () => controller.abort();
	}, [eventId, summaryRefresh]);

	const applyFilters = (next: MemoriesOrganizerFilters) => {
		setFilters(next);
		setViewerIndex(null);
		void load(0, false, next);
	};

	const refresh = () => {
		setSummaryRefresh((value) => value + 1);
		void load();
	};

	const saveCaption = async (item: OrganizerItem, caption: string): Promise<boolean> => {
		if (!space) return false;
		try {
			await memoriesOrganizerApi.updateItem(space.eventId, item.id, { caption });
		} catch {
			setError('No se pudo guardar la descripción.');
			return false;
		}
		setItems((current) =>
			current.map((entry) => (entry.id === item.id ? { ...entry, caption } : entry)),
		);
		return true;
	};

	/** Hides or shows files one request at a time, keeping the per-item audit trail. */
	const setHidden = async (targets: OrganizerItem[], hidden: boolean): Promise<boolean> => {
		if (!space) return false;
		const changed = new Set<string>();
		try {
			for (const item of targets) {
				if (item.status !== 'accepted' || item.hidden === hidden) continue;
				await memoriesOrganizerApi.updateItem(space.eventId, item.id, { hidden });
				changed.add(item.id);
			}
			return true;
		} catch {
			setError(
				hidden
					? 'No se pudieron ocultar todos los recuerdos.'
					: 'No se pudieron mostrar todos los recuerdos.',
			);
			return false;
		} finally {
			setItems((current) =>
				current.map((entry) => (changed.has(entry.id) ? { ...entry, hidden } : entry)),
			);
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

	const stopSelecting = () => {
		setSelecting(false);
		setSelectedById({});
	};

	const runConfirmedAction = async () => {
		if (!confirmAction || !space) return;
		setActionBusy(true);
		try {
			if (confirmAction.type === 'block') {
				await memoriesOrganizerApi.revokeUploader(
					space.eventId,
					confirmAction.items[0].uploader.guestAlias,
				);
			} else {
				// One request per item keeps the existing per-item contract and its audit trail.
				for (const item of confirmAction.items) {
					await memoriesOrganizerApi.deleteItem(space.eventId, item.id);
				}
				stopSelecting();
				setSummaryRefresh((value) => value + 1);
				await load(0, false, filters);
			}
			setConfirmAction(null);
		} catch {
			setError(
				confirmAction.type === 'block'
					? 'No se pudo bloquear al invitado.'
					: 'No se pudieron eliminar todos los recuerdos. Revise la galería e intente de nuevo.',
			);
			setConfirmAction(null);
			await load(0, false, filters);
		} finally {
			setActionBusy(false);
		}
	};

	const closeViewer = useCallback(() => setViewerIndex(null), []);

	if (!space) {
		return (
			<section className="dashboard-card dashboard-memories" aria-label="Recuerdos">
				<p className="dashboard-memories__empty">
					Seleccione un evento con recuerdos activos.
				</p>
			</section>
		);
	}

	const previewUrl = (item: OrganizerItem) =>
		memoriesOrganizerApi.itemMediaUrl(space.eventId, item.id, 'preview');
	const thumbnailUrl = (item: OrganizerItem) =>
		memoriesOrganizerApi.itemMediaUrl(space.eventId, item.id, 'thumb');
	const downloadUrl = (item: OrganizerItem) =>
		memoriesOrganizerApi.itemMediaUrl(space.eventId, item.id);

	return (
		<section className="dashboard-memories" aria-label="Recuerdos">
			<div className="dashboard-memories__topbar">
				<EventPicker spaces={spaces} space={space} onChange={setEventId} />
				<div className="dashboard-memories__header-actions">
					<button type="button" className="btn-secondary" onClick={refresh}>
						Actualizar
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={() => setExportScope('all')}
					>
						Descargar todo
					</button>
				</div>
			</div>

			<MemoriesHostSummary eventId={space.eventId} refreshKey={summaryRefresh} />

			<section
				className="dashboard-memories__gallery"
				aria-labelledby="memories-gallery-title"
			>
				<div className="dashboard-memories__gallery-head">
					<h2 id="memories-gallery-title">Galería</h2>
					{items.length > 0 ? (
						<button
							type="button"
							className="btn-secondary"
							onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
						>
							{selecting ? 'Cancelar selección' : 'Seleccionar'}
						</button>
					) : null}
				</div>

				{items.length > 0 || filtersActive ? (
					<MemoriesFilters
						applied={filters}
						uploaders={uploaders}
						disabled={loading}
						onApply={applyFilters}
					/>
				) : null}

				{error ? (
					<div role="alert" className="memories-notice memories-notice--danger">
						<p>{error}</p>
						<button type="button" className="btn-secondary" onClick={() => void load()}>
							Reintentar
						</button>
					</div>
				) : null}

				{items.length === 0 ? (
					<EmptyGallery
						loading={loading}
						hasError={Boolean(error)}
						filtered={filtersActive}
					/>
				) : (
					<>
						<div aria-busy={loading}>
							<MemoriesGallery
								items={items}
								timeZone={space.timeZone}
								mediaUrl={thumbnailUrl}
								selecting={selecting}
								selectedIds={selectedById}
								onOpen={(item) =>
									setViewerIndex(items.findIndex((entry) => entry.id === item.id))
								}
								onToggle={toggleSelected}
							/>
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
			</section>

			{selecting ? (
				<SelectionBar
					count={selectedItems.length}
					allHidden={
						selectedItems.length > 0 && selectedItems.every((item) => item.hidden)
					}
					onToggleHidden={() => {
						const hide = !selectedItems.every((item) => item.hidden);
						void setHidden(selectedItems, hide).then((done) => {
							if (done) stopSelecting();
						});
					}}
					onDelete={() => setConfirmAction({ type: 'delete', items: selectedItems })}
					onDownload={() => setExportScope('selected')}
				/>
			) : null}

			{viewerIndex !== null && items[viewerIndex] ? (
				<MemoriesLightbox
					items={items}
					index={viewerIndex}
					timeZone={space.timeZone}
					previewUrl={previewUrl}
					downloadUrl={downloadUrl}
					onIndexChange={setViewerIndex}
					onClose={closeViewer}
					onSaveCaption={saveCaption}
					onToggleHidden={(item) => setHidden([item], !item.hidden)}
					onRequestDelete={(item) => {
						setViewerIndex(null);
						setConfirmAction({ type: 'delete', items: [item] });
					}}
					onRequestBlock={(item) => {
						setViewerIndex(null);
						setConfirmAction({ type: 'block', items: [item] });
					}}
				/>
			) : null}

			{confirmAction ? (
				<ConfirmDialog
					action={confirmAction}
					busy={actionBusy}
					onCancel={() => setConfirmAction(null)}
					onConfirm={() => void runConfirmedAction()}
				/>
			) : null}

			{exportScope ? (
				<MemoriesExportWizard
					space={space}
					scope={exportScope}
					selectedItems={selectedItems}
					onClose={() => setExportScope(null)}
				/>
			) : null}
		</section>
	);
}

function EventPicker(props: {
	spaces: OrganizerSpaceItem[];
	space: OrganizerSpaceItem;
	onChange: (eventId: string) => void;
}) {
	if (props.spaces.length < 2)
		return <p className="dashboard-memories__event-title">{props.space.eventTitle}</p>;
	return (
		<label className="dashboard-memories__event">
			<span>Evento</span>
			<select
				value={props.space.eventId}
				onChange={(event) => props.onChange(event.target.value)}
			>
				{props.spaces.map((entry) => (
					<option key={entry.eventId} value={entry.eventId}>
						{entry.eventTitle}
					</option>
				))}
			</select>
		</label>
	);
}

function EmptyGallery(props: { loading: boolean; hasError: boolean; filtered: boolean }) {
	if (props.loading) {
		return (
			<p className="dashboard-memories__empty" aria-live="polite">
				Cargando recuerdos…
			</p>
		);
	}
	if (props.hasError) return null;
	return (
		<div className="dashboard-memories__empty">
			<strong>{props.filtered ? 'No hay resultados' : 'Aún no hay recuerdos'}</strong>
			<p>
				{props.filtered
					? 'Cambie o limpie los filtros para ver más recuerdos.'
					: 'Aparecerán aquí en cuanto sus invitados escaneen el QR. Asegúrese de que esté a la vista.'}
			</p>
		</div>
	);
}

function SelectionBar(props: {
	count: number;
	allHidden: boolean;
	onToggleHidden: () => void;
	onDelete: () => void;
	onDownload: () => void;
}) {
	return (
		<div
			className="dashboard-memories__selection-bar"
			role="region"
			aria-label="Acciones para la selección"
		>
			<p aria-live="polite">
				<strong>{props.count}</strong>{' '}
				{props.count === 1 ? 'seleccionado' : 'seleccionados'}
			</p>
			<div>
				<button
					type="button"
					className="btn-secondary"
					disabled={props.count === 0}
					onClick={props.onToggleHidden}
				>
					{props.allHidden ? 'Mostrar' : 'Ocultar'}
				</button>
				<button
					type="button"
					className="btn-secondary"
					disabled={props.count === 0}
					onClick={props.onDelete}
				>
					Eliminar
				</button>
				<button
					type="button"
					className="btn-primary"
					disabled={props.count === 0}
					onClick={props.onDownload}
				>
					Descargar
				</button>
			</div>
		</div>
	);
}

function ConfirmDialog(props: {
	action: ConfirmAction;
	busy: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const copy = confirmCopy(props.action);
	return (
		<ModalShell
			title={copy.title}
			variant="confirm"
			size="sm"
			descriptionId="memories-confirm-description"
			disableClose={props.busy}
			onClose={props.onCancel}
			footer={
				<>
					<button
						type="button"
						className="btn-secondary"
						disabled={props.busy}
						onClick={props.onCancel}
					>
						Cancelar
					</button>
					<button
						type="button"
						className="btn-primary btn-primary--danger"
						disabled={props.busy}
						onClick={props.onConfirm}
					>
						{props.busy ? 'Procesando…' : copy.button}
					</button>
				</>
			}
		>
			<p id="memories-confirm-description">{copy.body}</p>
		</ModalShell>
	);
}
