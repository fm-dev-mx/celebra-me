import type { FC } from 'react';
import { useState } from 'react';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { RsvpEventDTO } from '@/lib/dashboard/dto/intake';
import { RSVP_EVENT_STATUS_LABELS } from '@/lib/intake/labels';

interface Props {
	rsvpEvent: RsvpEventDTO | null;
	/** Called after the RSVP event is archived so the parent can reload its data. */
	onDeactivated: () => void | Promise<void>;
}

const STATUS_CLASSES: Record<string, string> = {
	published: 'rsvp-panel__badge--active',
	archived: 'rsvp-panel__badge--disabled',
	draft: 'rsvp-panel__badge--draft',
};

const DEACTIVATE_ERROR = 'No se pudo desactivar el RSVP. Inténtelo de nuevo.';

const InvitationRsvpPanel: FC<Props> = ({ rsvpEvent, onDeactivated }) => {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deactivating, setDeactivating] = useState(false);
	const [actionError, setActionError] = useState('');

	if (!rsvpEvent) {
		return (
			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">RSVP e invitados</h3>
				<p className="intake-detail__empty">Sin evento RSVP</p>
			</section>
		);
	}

	const handleDeactivate = async () => {
		setDeactivating(true);
		setActionError('');
		try {
			// Send only the status: omitted fields must keep their stored values.
			await adminApi.updateEvent(rsvpEvent.id, { status: 'archived' });
		} catch {
			setActionError(DEACTIVATE_ERROR);
			return;
		} finally {
			setDeactivating(false);
			setConfirmOpen(false);
		}
		await onDeactivated();
	};

	const badgeClass = STATUS_CLASSES[rsvpEvent.status] ?? '';
	const statusLabel = RSVP_EVENT_STATUS_LABELS[rsvpEvent.status] ?? rsvpEvent.status;

	return (
		<section className="intake-detail__section">
			<h3 className="intake-detail__section-title">RSVP e invitados</h3>
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
							onClick={() => {
								setActionError('');
								setConfirmOpen(true);
							}}
							disabled={deactivating}
						>
							{deactivating ? 'Desactivando...' : 'Desactivar RSVP'}
						</button>
					)}
				</div>
				<p className="intake-detail__empty">
					Desactivar RSVP no oculta la invitación pública.
				</p>

				{actionError && <p className="intake-detail__error">{actionError}</p>}
			</div>

			{confirmOpen && (
				<ConfirmModal
					title="¿Desactivar RSVP?"
					message="Los invitados ya no podrán confirmar asistencia. La invitación pública seguirá visible."
					confirmLabel="Desactivar RSVP"
					destructive
					loading={deactivating}
					onConfirm={() => void handleDeactivate()}
					onCancel={() => setConfirmOpen(false)}
				/>
			)}
		</section>
	);
};

export default InvitationRsvpPanel;
