import type { FC } from 'react';
import { useState } from 'react';
import type { RsvpEventDTO } from '@/lib/dashboard/dto/intake';

interface Props {
	rsvpEvent: RsvpEventDTO | null;
}

const STATUS_LABELS: Record<string, string> = {
	published: 'Activo',
	archived: 'Desactivado',
	draft: 'Borrador',
};

const STATUS_CLASSES: Record<string, string> = {
	published: 'rsvp-panel__badge--active',
	archived: 'rsvp-panel__badge--disabled',
	draft: 'rsvp-panel__badge--draft',
};

const InvitationRsvpPanel: FC<Props> = ({ rsvpEvent }) => {
	const [deactivating, setDeactivating] = useState(false);
	const [actionError, setActionError] = useState('');

	if (!rsvpEvent) {
		return (
			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">RSVP</h3>
				<p className="intake-detail__empty">—</p>
			</section>
		);
	}

	const handleDeactivate = async () => {
		if (!window.confirm('¿Desactivar RSVP? Los invitados ya no podrán confirmar asistencia.'))
			return;
		setDeactivating(true);
		setActionError('');
		try {
			const res = await fetch(
				`/api/dashboard/admin/events/${encodeURIComponent(rsvpEvent.id)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: 'archived' }),
				},
			);
			if (!res.ok) throw new Error('Error al desactivar RSVP.');
			window.location.reload();
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al desactivar RSVP.');
		} finally {
			setDeactivating(false);
		}
	};

	const badgeClass = STATUS_CLASSES[rsvpEvent.status] ?? '';
	const statusLabel = STATUS_LABELS[rsvpEvent.status] ?? rsvpEvent.status;

	return (
		<section className="intake-detail__section">
			<h3 className="intake-detail__section-title">RSVP</h3>
			<div className="rsvp-panel">
				<div className="rsvp-panel__status">
					<span className={`rsvp-panel__badge ${badgeClass}`}>{statusLabel}</span>
				</div>

				<div className="rsvp-panel__counts">
					<div className="rsvp-panel__count">
						<span className="rsvp-panel__count-value">{rsvpEvent.guestCount}</span>
						<span className="rsvp-panel__count-label">Total invitados</span>
					</div>
					<div className="rsvp-panel__count">
						<span className="rsvp-panel__count-value rsvp-panel__count-value--confirmed">
							{rsvpEvent.confirmedCount}
						</span>
						<span className="rsvp-panel__count-label">Confirmados</span>
					</div>
					<div className="rsvp-panel__count">
						<span className="rsvp-panel__count-value rsvp-panel__count-value--declined">
							{rsvpEvent.declinedCount}
						</span>
						<span className="rsvp-panel__count-label">Rechazados</span>
					</div>
					<div className="rsvp-panel__count">
						<span className="rsvp-panel__count-value rsvp-panel__count-value--pending">
							{rsvpEvent.pendingCount}
						</span>
						<span className="rsvp-panel__count-label">Pendientes</span>
					</div>
				</div>

				{rsvpEvent.claimCodeCount > 0 && (
					<div className="rsvp-panel__codes">
						<span className="rsvp-panel__codes-count">{rsvpEvent.claimCodeCount}</span>
						<span className="rsvp-panel__codes-label">códigos de acceso</span>
					</div>
				)}

				<div className="rsvp-panel__actions">
					<a
						href={`/dashboard/invitados?eventId=${rsvpEvent.id}`}
						className="intake-detail__review-link"
					>
						Gestionar invitados
					</a>
					{rsvpEvent.status !== 'archived' && (
						<button
							type="button"
							className="intake-detail__generate-btn intake-detail__generate-btn--danger"
							onClick={handleDeactivate}
							disabled={deactivating}
						>
							{deactivating ? 'Desactivando...' : 'Desactivar RSVP'}
						</button>
					)}
				</div>

				{actionError && <p className="intake-detail__error">{actionError}</p>}
			</div>
		</section>
	);
};

export default InvitationRsvpPanel;
