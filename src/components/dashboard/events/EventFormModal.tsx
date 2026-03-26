import React, { useState, type SyntheticEvent } from 'react';
import type { AdminEventListItemDTO } from '@/interfaces/dashboard/admin.interface';
import type { CreateEventDTO, UpdateEventDTO } from '@/lib/dashboard/dto/events';
import type { EventStatus, EventType } from '@/hooks/use-events-admin';

interface EventFormModalProps {
	mode: 'create' | 'edit';
	initialEvent?: AdminEventListItemDTO | null;
	onClose: () => void;
	onSubmit: (payload: CreateEventDTO | UpdateEventDTO) => Promise<void>;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

const EventFormModal: React.FC<EventFormModalProps> = ({
	mode,
	initialEvent,
	onClose,
	onSubmit,
}) => {
	const [title, setTitle] = useState(initialEvent?.title || '');
	const [slug, setSlug] = useState(initialEvent?.slug || '');
	const [eventType, setEventType] = useState<EventType>(initialEvent?.eventType || 'xv');
	const [status, setStatus] = useState<EventStatus>(initialEvent?.status || 'draft');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async (event: SyntheticEvent) => {
		event.preventDefault();

		if (busy) {
			return;
		}

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
			setError(err instanceof Error ? err.message : 'Error al guardar el evento.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
			<div className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
				<h3>{mode === 'create' ? 'Nuevo evento' : 'Editar evento'}</h3>
				<form onSubmit={handleSubmit} className="dashboard-form-grid">
					<div className="dashboard-form-field">
						<label htmlFor="event-title">Título</label>
						<input
							id="event-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Ej. Mi boda increíble"
							required
							disabled={busy}
						/>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="event-slug">Slug (URL)</label>
						<input
							id="event-slug"
							value={slug}
							onChange={(event) => setSlug(event.target.value.toLowerCase())}
							placeholder="mi-boda-2026"
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
							onChange={(event) => setEventType(event.target.value as EventType)}
							disabled={busy}
							required
						>
							<option value="xv">XV años</option>
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
							onChange={(event) => setStatus(event.target.value as EventStatus)}
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

export default EventFormModal;
