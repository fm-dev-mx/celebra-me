import type { FC } from 'react';
import { useState } from 'react';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { RsvpEventDTO } from '@/lib/dashboard/dto/intake';
import { RSVP_EVENT_STATUS_LABELS } from '@/lib/intake/labels';

interface Props {
	rsvpEvent: RsvpEventDTO | null;
	/** Reactivation is offered only while the invitation is published. */
	invitationPublished: boolean;
	/** Called after the RSVP status changes so the parent can reload its data. */
	onStatusChanged: () => void | Promise<void>;
}

const STATUS_CLASSES: Record<string, string> = {
	published: 'rsvp-panel__badge--active',
	archived: 'rsvp-panel__badge--disabled',
	draft: 'rsvp-panel__badge--draft',
};

type RsvpAction = 'deactivate' | 'reactivate';

// Publishing the invitation keeps a disabled RSVP archived, so reactivation is explicit.
const RSVP_ACTIONS: Record<
	RsvpAction,
	{
		status: 'archived' | 'published';
		title: string;
		message: string;
		label: string;
		busyLabel: string;
		error: string;
		destructive: boolean;
	}
> = {
	deactivate: {
		status: 'archived',
		title: '¿Desactivar RSVP?',
		message:
			'Los invitados ya no podrán confirmar asistencia. La invitación pública seguirá visible y podrá reactivar el RSVP después desde este panel.',
		label: 'Desactivar RSVP',
		busyLabel: 'Desactivando...',
		error: 'No se pudo desactivar el RSVP. Inténtelo de nuevo.',
		destructive: true,
	},
	reactivate: {
		status: 'published',
		title: '¿Reactivar RSVP?',
		message: 'Los invitados podrán volver a confirmar asistencia desde la invitación pública.',
		label: 'Reactivar RSVP',
		busyLabel: 'Reactivando...',
		error: 'No se pudo reactivar el RSVP. Inténtelo de nuevo.',
		destructive: false,
	},
};

const InvitationRsvpPanel: FC<Props> = ({ rsvpEvent, invitationPublished, onStatusChanged }) => {
	const [pendingAction, setPendingAction] = useState<RsvpAction | null>(null);
	const [saving, setSaving] = useState(false);
	const [actionError, setActionError] = useState('');

	if (!rsvpEvent) {
		return (
			<section className="intake-detail__section">
				<h3 className="intake-detail__section-title">RSVP e invitados</h3>
				<p className="intake-detail__empty">Sin evento RSVP</p>
			</section>
		);
	}

	const runAction = async (action: RsvpAction) => {
		setSaving(true);
		setActionError('');
		try {
			// Send only the status: omitted fields must keep their stored values.
			await adminApi.updateEvent(rsvpEvent.id, { status: RSVP_ACTIONS[action].status });
		} catch {
			setActionError(RSVP_ACTIONS[action].error);
			return;
		} finally {
			setSaving(false);
			setPendingAction(null);
		}
		await onStatusChanged();
	};

	const openConfirm = (action: RsvpAction) => {
		setActionError('');
		setPendingAction(action);
	};

	const isArchived = rsvpEvent.status === 'archived';
	const confirmAction = pendingAction ? RSVP_ACTIONS[pendingAction] : null;

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
					{!isArchived && (
						<button
							type="button"
							className="intake-detail__generate-btn intake-detail__generate-btn--danger"
							onClick={() => openConfirm('deactivate')}
							disabled={saving}
						>
							{saving && pendingAction === 'deactivate'
								? RSVP_ACTIONS.deactivate.busyLabel
								: RSVP_ACTIONS.deactivate.label}
						</button>
					)}
					{isArchived && invitationPublished && (
						<button
							type="button"
							className="intake-detail__generate-btn"
							onClick={() => openConfirm('reactivate')}
							disabled={saving}
						>
							{saving && pendingAction === 'reactivate'
								? RSVP_ACTIONS.reactivate.busyLabel
								: RSVP_ACTIONS.reactivate.label}
						</button>
					)}
				</div>
				<p className="intake-detail__empty">
					{isArchived && !invitationPublished
						? 'Publique la invitación para poder reactivar el RSVP.'
						: 'Desactivar RSVP no oculta la invitación pública.'}
				</p>

				{actionError && <p className="intake-detail__error">{actionError}</p>}
			</div>

			{pendingAction && confirmAction && (
				<ConfirmModal
					title={confirmAction.title}
					message={confirmAction.message}
					confirmLabel={confirmAction.label}
					destructive={confirmAction.destructive}
					loading={saving}
					onConfirm={() => void runAction(pendingAction)}
					onCancel={() => setPendingAction(null)}
				/>
			)}
		</section>
	);
};

export default InvitationRsvpPanel;
