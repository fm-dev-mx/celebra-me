import React, { useEffect, useState, type SyntheticEvent } from 'react';
import type { CreateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';
import type { EventListItemDTO } from '@/lib/dashboard/dto/events';

interface ClaimCodeFormModalProps {
	events: EventListItemDTO[];
	loading: boolean;
	onCreate: (payload: CreateClaimCodeDTO) => Promise<void>;
}

const ClaimCodeFormModal: React.FC<ClaimCodeFormModalProps> = ({ events, loading, onCreate }) => {
	const [eventId, setEventId] = useState('');
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (events.length > 0 && !eventId) {
			setEventId(events[0].id);
		}
		if (events.length === 0 && eventId) {
			setEventId('');
		}
	}, [eventId, events]);

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
			setError(err instanceof Error ? err.message : 'Error al crear el código de acceso.');
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
			{error && <p className="dashboard-error dashboard-error--full">{error}</p>}
			<div className="dashboard-actions dashboard-actions--full">
				<button
					type="submit"
					className="btn-primary"
					disabled={busy || !eventId || events.length === 0}
				>
					{busy ? 'Generando...' : 'Generar código de acceso'}
				</button>
			</div>
		</form>
	);
};

export default ClaimCodeFormModal;
