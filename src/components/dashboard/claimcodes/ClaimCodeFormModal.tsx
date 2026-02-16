import React, { useEffect, useState, type SyntheticEvent } from 'react';
import { adminApi } from '@/lib/dashboard/adminApi';
import type { EventListItemDTO } from '@/lib/dashboard/dto/events';

interface ClaimCodeFormModalProps {
	onCreate: (payload: {
		eventId: string;
		maxUses: number;
		expiresAt: string | null;
	}) => Promise<void>;
}

const ClaimCodeFormModal: React.FC<ClaimCodeFormModalProps> = ({ onCreate }) => {
	const [events, setEvents] = useState<EventListItemDTO[]>([]);
	const [eventId, setEventId] = useState('');
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const loadEvents = async () => {
			setLoading(true);
			setError('');
			try {
				const result = await adminApi.listEvents();
				setEvents(result.items);
				if (result.items.length > 0 && !eventId) {
					setEventId(result.items[0].id);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'No se pudieron cargar eventos.');
			} finally {
				setLoading(false);
			}
		};

		void loadEvents();
	}, [eventId]);

	const handleSubmit = async (event: SyntheticEvent) => {
		event.preventDefault();
		if (busy || !eventId) return;
		setBusy(true);
		setError('');
		try {
			await onCreate({
				eventId: eventId.trim(),
				maxUses,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
			});
			setEventId(events.length > 0 ? events[0].id : '');
			setMaxUses(1);
			setExpiresAt('');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al crear claim code.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<form className="dashboard-form-grid" onSubmit={handleSubmit}>
			<div className="dashboard-form-field">
				<label htmlFor="claim-event">Evento</label>
				{loading ? (
					<select id="claim-event" disabled>
						<option>Cargando eventos...</option>
					</select>
				) : (
					<select
						id="claim-event"
						value={eventId}
						onChange={(event) => setEventId(event.target.value)}
						required
						disabled={events.length === 0}
					>
						<option value="">Selecciona un evento</option>
						{events.map((event) => (
							<option key={event.id} value={event.id}>
								{event.title} ({event.slug})
							</option>
						))}
					</select>
				)}
				{events.length === 0 && !loading && (
					<p className="dashboard-form-help">
						No hay eventos disponibles. Crea un evento primero.
					</p>
				)}
			</div>
			<div className="dashboard-form-field">
				<label htmlFor="claim-max-uses">Usos máximos</label>
				<input
					id="claim-max-uses"
					type="number"
					min={1}
					max={10000}
					value={maxUses}
					onChange={(event) => setMaxUses(Number.parseInt(event.target.value || '1', 10))}
					required
				/>
				<p className="dashboard-form-help">Mínimo 1, máximo 10000</p>
			</div>
			<div className="dashboard-form-field">
				<label htmlFor="claim-expires">Expira en (opcional)</label>
				<input
					id="claim-expires"
					type="datetime-local"
					value={expiresAt}
					onChange={(event) => setExpiresAt(event.target.value)}
					min={new Date().toISOString().slice(0, 16)}
				/>
				<p className="dashboard-form-help">Deja vacío para que no expire</p>
			</div>
			{error && (
				<p className="dashboard-guests__error" style={{ gridColumn: '1 / -1' }}>
					{error}
				</p>
			)}
			<div className="dashboard-actions" style={{ gridColumn: '1 / -1' }}>
				<button
					type="submit"
					className="btn-primary"
					disabled={busy || !eventId || events.length === 0}
				>
					{busy ? 'Generando...' : 'Generar Claim Code'}
				</button>
			</div>
		</form>
	);
};

export default ClaimCodeFormModal;
