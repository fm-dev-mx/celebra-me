import React, { useEffect, useState, type SyntheticEvent } from 'react';
import type { AdminEventListItemDTO } from '@/lib/rsvp-v2/types';
import { adminApi } from '@/lib/dashboard/adminApi';
import type { CreateEventDTO, UpdateEventDTO } from '@/lib/dashboard/dto/events';

const EventsAdminTable: React.FC = () => {
	const [items, setItems] = useState<AdminEventListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<AdminEventListItemDTO | null>(null);

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
		if (
			!window.confirm('¿Archivar este evento? Los datos se conservarán pero no será visible.')
		) {
			return;
		}
		try {
			await adminApi.archiveEvent(eventId);
			await loadEvents();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Error al archivar evento.');
		}
	};

	const handlePublish = async (eventId: string) => {
		if (!window.confirm('¿Publicar este evento? Será visible para los hosts asignados.')) {
			return;
		}
		try {
			await adminApi.publishEvent(eventId);
			await loadEvents();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Error al publicar evento.');
		}
	};

	return (
		<div className="dashboard-card">
			<div className="dashboard-card-header">
				<h2>Eventos Globales</h2>
				<button type="button" onClick={() => setCreateModalOpen(true)}>
					+ Nuevo Evento
				</button>
			</div>
			{error && <p className="dashboard-guests__error">{error}</p>}
			{loading && <p className="dashboard-guests__status">Cargando...</p>}
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

	const handleSubmit = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError('');
		try {
			if (mode === 'create') {
				await onSubmit({ title, slug, eventType, status });
			} else {
				await onSubmit({ title, slug, eventType, status });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar evento.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="dashboard-guests__modal-backdrop" role="dialog" aria-modal="true">
			<div className="dashboard-guests__modal">
				<h3>{mode === 'create' ? 'Nuevo Evento' : 'Editar Evento'}</h3>
				<form onSubmit={handleSubmit}>
					<label>
						Título
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							required
							disabled={busy}
						/>
					</label>
					<label>
						Slug (URL)
						<input
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							required
							disabled={busy}
							pattern="[a-z0-9-]+"
							title="Solo letras minúsculas, números y guiones"
						/>
						<p className="dashboard-form-help">Ejemplo: mi-boda-2024</p>
					</label>
					<label>
						Tipo de evento
						<select
							value={eventType}
							onChange={(e) =>
								setEventType(e.target.value as 'xv' | 'boda' | 'bautizo' | 'cumple')
							}
							disabled={busy}
							required
						>
							<option value="xv">XV Años</option>
							<option value="boda">Boda</option>
							<option value="bautizo">Bautizo</option>
							<option value="cumple">Cumpleaños</option>
						</select>
					</label>
					<label>
						Estado
						<select
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
					</label>
					{error && <p className="dashboard-guests__error">{error}</p>}
					<div className="dashboard-guests__modal-actions">
						<button type="button" onClick={onClose} disabled={busy}>
							Cancelar
						</button>
						<button type="submit" disabled={busy}>
							{busy ? 'Guardando...' : 'Guardar'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default EventsAdminTable;
