import React, { useEffect, useState, type SyntheticEvent } from 'react';
import type { AdminEventListItemDTO } from '@/lib/rsvp/core/types';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { CreateEventDTO, UpdateEventDTO } from '@/lib/dashboard/dto/events';

const EventsAdminTable: React.FC = () => {
	const [items, setItems] = useState<AdminEventListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<AdminEventListItemDTO | null>(null);
	const [confirmModal, setConfirmModal] = useState<{
		open: boolean;
		title: string;
		message: string;
		onConfirm: () => Promise<void>;
		confirmLabel?: string;
		variant?: 'primary' | 'danger';
	}>({
		open: false,
		title: '',
		message: '',
		onConfirm: async () => {},
	});

	const loadEvents = async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listEvents();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadEvents();
	}, []);

	const handleCreate = async (payload: CreateEventDTO | UpdateEventDTO) => {
		try {
			// For create, we need all required fields
			if (!payload.title || !payload.slug || !payload.eventType) {
				throw new Error('title, slug y eventType son obligatorios.');
			}
			await adminApi.createEvent(payload as CreateEventDTO);
			setCreateModalOpen(false);
			await loadEvents();
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al crear evento.');
		}
	};

	const handleUpdate = async (eventId: string, payload: UpdateEventDTO) => {
		try {
			await adminApi.updateEvent(eventId, payload);
			setEditModalOpen(false);
			setEditingEvent(null);
			await loadEvents();
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al actualizar evento.');
		}
	};

	const handleArchive = async (eventId: string) => {
		setConfirmModal({
			open: true,
			title: 'Archivar Evento',
			message:
				'¿Estás seguro de que deseas archivar este evento? Los datos se conservarán pero no será visible para los invitados.',
			confirmLabel: 'Archivar Evento',
			variant: 'danger',
			onConfirm: async () => {
				await adminApi.archiveEvent(eventId);
				await loadEvents();
				setConfirmModal((prev) => ({ ...prev, open: false }));
			},
		});
	};

	const handlePublish = async (eventId: string) => {
		setConfirmModal({
			open: true,
			title: 'Publicar Evento',
			message:
				'¿Deseas publicar este evento? Será visible para los hosts asignados y se podrán generar invitaciones.',
			confirmLabel: 'Publicar Ahora',
			variant: 'primary',
			onConfirm: async () => {
				await adminApi.publishEvent(eventId);
				await loadEvents();
				setConfirmModal((prev) => ({ ...prev, open: false }));
			},
		});
	};

	return (
		<div className="dashboard-card">
			<div className="dashboard-card-header">
				<h2>Eventos Globales</h2>
				<button type="button" onClick={() => setCreateModalOpen(true)}>
					+ Nuevo Evento
				</button>
			</div>
			{error && <p className="dashboard-error">{error}</p>}
			{loading && <p className="dashboard-status">Cargando...</p>}
			<table className="dashboard-table">
				<thead>
					<tr>
						<th>Título</th>
						<th>Slug</th>
						<th>Tipo</th>
						<th>Estado</th>
						<th>Owner</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>{item.title}</td>
							<td>{item.slug}</td>
							<td>{item.eventType}</td>
							<td>
								<span className={`dashboard-badge dashboard-badge--${item.status}`}>
									{item.status}
								</span>
							</td>
							<td>{item.ownerUserId.slice(0, 8)}...</td>
							<td>
								<div className="dashboard-actions">
									<button
										type="button"
										onClick={() => {
											setEditingEvent(item);
											setEditModalOpen(true);
										}}
									>
										Editar
									</button>
									{item.status === 'draft' && (
										<button
											type="button"
											onClick={() => handlePublish(item.id)}
										>
											Publicar
										</button>
									)}
									{item.status === 'published' && (
										<button
											type="button"
											onClick={() => handleArchive(item.id)}
										>
											Archivar
										</button>
									)}
									{item.status === 'archived' && (
										<button
											type="button"
											onClick={() => handlePublish(item.id)}
										>
											Restaurar
										</button>
									)}
								</div>
							</td>
						</tr>
					))}
					{items.length === 0 && !loading && (
						<tr>
							<td colSpan={6}>No hay eventos registrados.</td>
						</tr>
					)}
				</tbody>
			</table>

			{createModalOpen && (
				<EventFormModal
					mode="create"
					onClose={() => setCreateModalOpen(false)}
					onSubmit={handleCreate}
				/>
			)}

			{editModalOpen && editingEvent && (
				<EventFormModal
					mode="edit"
					initialEvent={editingEvent}
					onClose={() => {
						setEditModalOpen(false);
						setEditingEvent(null);
					}}
					onSubmit={(payload) => handleUpdate(editingEvent.id, payload)}
				/>
			)}

			{confirmModal.open && (
				<div
					className="dashboard-modal-backdrop"
					role="dialog"
					aria-modal="true"
					onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
				>
					<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
						<h3>{confirmModal.title}</h3>
						<p className="dashboard-confirm-message">{confirmModal.message}</p>
						<div className="dashboard-modal__actions">
							<button
								type="button"
								className="btn-secondary"
								onClick={() =>
									setConfirmModal((prev) => ({ ...prev, open: false }))
								}
							>
								Cancelar
							</button>
							<button
								type="button"
								className={`btn-primary ${confirmModal.variant === 'danger' ? 'btn-primary--danger' : ''}`}
								onClick={confirmModal.onConfirm}
							>
								{confirmModal.confirmLabel || 'Confirmar'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

interface EventFormModalProps {
	mode: 'create' | 'edit';
	initialEvent?: AdminEventListItemDTO | null;
	onClose: () => void;
	onSubmit: (payload: CreateEventDTO | UpdateEventDTO) => Promise<void>;
}

const EventFormModal: React.FC<EventFormModalProps> = ({
	mode,
	initialEvent,
	onClose,
	onSubmit,
}) => {
	const [title, setTitle] = useState(initialEvent?.title || '');
	const [slug, setSlug] = useState(initialEvent?.slug || '');
	const [eventType, setEventType] = useState<'xv' | 'boda' | 'bautizo' | 'cumple'>(
		initialEvent?.eventType || 'xv',
	);
	const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
		initialEvent?.status || 'draft',
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const SLUG_REGEX = /^[a-z0-9-]+$/;

	const handleSubmit = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (busy) return;

		// Validations
		if (title.trim().length < 3) {
			setError('El título debe tener al menos 3 caracteres.');
			return;
		}
		if (!SLUG_REGEX.test(slug)) {
			setError('El slug solo puede contener letras minúsculas, números y guiones.');
			return;
		}

		setBusy(true);
		setError('');
		try {
			await onSubmit({ title: title.trim(), slug: slug.trim(), eventType, status });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar evento.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
			<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
				<h3>{mode === 'create' ? 'Nuevo Evento' : 'Editar Evento'}</h3>
				<form onSubmit={handleSubmit} className="dashboard-form-grid">
					<div className="dashboard-form-field">
						<label htmlFor="event-title">Título</label>
						<input
							id="event-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Ej. Mi Boda Increíble"
							required
							disabled={busy}
						/>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="event-slug">Slug (URL)</label>
						<input
							id="event-slug"
							value={slug}
							onChange={(e) => setSlug(e.target.value.toLowerCase())}
							placeholder="ej-mi-boda-2024"
							required
							disabled={busy}
							pattern="[a-z0-9-]+"
						/>
						<p className="dashboard-form-help">
							Solo letras minúsculas, números y guiones.
						</p>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="event-type">Tipo de evento</label>
						<select
							id="event-type"
							value={eventType}
							onChange={(e) =>
								setEventType(e.target.value as 'xv' | 'boda' | 'bautizo' | 'cumple')
							}
							disabled={busy}
							required
						>
							<option value="xv">XV Años</option>
							<option value="boda">Boda</option>
							<option value="cumple">Cumpleaños</option>
							{eventType === 'bautizo' && <option value="bautizo">Bautizo</option>}
						</select>
						<p className="dashboard-form-help">
							Bautizo permanece compatible en backend, pero se oculta del flujo normal
							hasta contar con una plantilla premium aprobada.
						</p>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="event-status">Estado</label>
						<select
							id="event-status"
							value={status}
							onChange={(e) =>
								setStatus(e.target.value as 'draft' | 'published' | 'archived')
							}
							disabled={busy}
							required
						>
							<option value="draft">Borrador</option>
							<option value="published">Publicado</option>
							<option value="archived">Archivado</option>
						</select>
					</div>
					{error && <p className="dashboard-error dashboard-error--full">{error}</p>}
					<div className="dashboard-modal__actions dashboard-modal__actions--full">
						<button
							type="button"
							className="btn-secondary"
							onClick={onClose}
							disabled={busy}
						>
							Cancelar
						</button>
						<button type="submit" className="btn-primary" disabled={busy}>
							{busy ? 'Guardando...' : 'Guardar'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default EventsAdminTable;
