import React, { useState } from 'react';
import type { AdminEventListItemDTO } from '@/interfaces/dashboard/admin.interface';
import EventConfirmDialog from '@/components/dashboard/events/EventConfirmDialog';
import EventFormModal from '@/components/dashboard/events/EventFormModal';
import { getEventStatusLabel, getEventTypeLabel, useEventsAdmin } from '@/hooks/use-events-admin';
import type { CreateEventDTO, UpdateEventDTO } from '@/lib/dashboard/dto/events';

const EventsAdminTable: React.FC = () => {
	const { items, error, loading, createEvent, updateEvent, archiveEvent, publishEvent } =
		useEventsAdmin();
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

	const handleCreate = async (payload: CreateEventDTO | UpdateEventDTO) => {
		if (!payload.title || !payload.slug || !payload.eventType) {
			throw new Error('Título, slug y tipo de evento son obligatorios.');
		}

		await createEvent(payload as CreateEventDTO);
		setCreateModalOpen(false);
	};

	const handleUpdate = async (eventId: string, payload: UpdateEventDTO) => {
		await updateEvent(eventId, payload);
		setEditModalOpen(false);
		setEditingEvent(null);
	};

	const handleArchive = async (eventId: string) => {
		setConfirmModal({
			open: true,
			title: 'Archivar Evento',
			message:
				'¿Estás seguro de que deseas archivar este evento? Los datos se conservarán pero no será visible para los invitados.',
			confirmLabel: 'Archivar evento',
			variant: 'danger',
			onConfirm: async () => {
				await archiveEvent(eventId);
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
			confirmLabel: 'Publicar ahora',
			variant: 'primary',
			onConfirm: async () => {
				await publishEvent(eventId);
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
						<th>Responsable</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>{item.title}</td>
							<td>{item.slug}</td>
							<td>{getEventTypeLabel(item.eventType)}</td>
							<td>
								<span className={`dashboard-badge dashboard-badge--${item.status}`}>
									{getEventStatusLabel(item.status)}
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
				<EventConfirmDialog
					open={confirmModal.open}
					title={confirmModal.title}
					message={confirmModal.message}
					confirmLabel={confirmModal.confirmLabel}
					variant={confirmModal.variant}
					onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
					onConfirm={confirmModal.onConfirm}
				/>
			)}
		</div>
	);
};

export default EventsAdminTable;
