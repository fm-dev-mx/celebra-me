import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DraftSection from '@/components/dashboard/intake/DraftSection';
import InvitationRsvpPanel from '@/components/dashboard/intake/InvitationRsvpPanel';
import { INVITATION_STATUS_LABELS } from '@/lib/intake/labels';
import { hasInconsistency, resolveRepairAction } from '@/lib/intake/display-status';

interface Props {
	invitationId: string;
}

const InvitationDetail: FC<Props> = ({ invitationId }) => {
	const {
		loading,
		error,
		currentInvitation,
		currentRsvpEvent,
		loadInvitationDetail,
		updateInvitation,
		loadDraft,
	} = useInvitationAdmin();

	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadInvitationDetail(invitationId);
		void loadDraft(invitationId);
	}, [invitationId, loadInvitationDetail, loadDraft]);

	const handleTogglePhotos = async () => {
		if (!currentInvitation) return;
		setActionError('');
		setActionSuccess('');
		try {
			await updateInvitation(invitationId, {
				photosReceived: !currentInvitation.photosReceived,
			});
			setActionSuccess(
				currentInvitation.photosReceived
					? 'Fotos marcadas como no recibidas.'
					: 'Fotos marcadas como recibidas.',
			);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al actualizar.');
		}
	};

	if (loading) {
		return <div className="intake-detail__loading">Cargando...</div>;
	}

	if (error) {
		return <div className="intake-detail__error">{error}</div>;
	}

	if (!currentInvitation) {
		return <div className="intake-detail__empty">Invitación no encontrada.</div>;
	}

	const inconsistencyDetected = hasInconsistency(currentInvitation);
	const repairAction = resolveRepairAction(currentInvitation);

	return (
		<div className="intake-detail">
			<header className="intake-detail__header">
				<div className="intake-detail__header-top">
					<a href="/dashboard/invitaciones" className="intake-detail__back">
						&larr; Volver
					</a>
				</div>
				<h2 className="intake-detail__title">{currentInvitation.title}</h2>
				<div className="intake-detail__meta">
					<span className="intake-detail__badge">
						{INVITATION_STATUS_LABELS[currentInvitation.status] ??
							currentInvitation.status}
					</span>
					<span className="intake-detail__type">{currentInvitation.eventType}</span>
				</div>

				{inconsistencyDetected && repairAction && (
					<div className="intake-detail__repair">
						<p className="intake-detail__repair-text">{repairAction.explanation}</p>
						{repairAction.href ? (
							<a href={repairAction.href} className="intake-detail__repair-link">
								{repairAction.text}
							</a>
						) : (
							<span className="intake-detail__repair-muted">{repairAction.text}</span>
						)}
					</div>
				)}
			</header>

			{currentInvitation.kind === 'client' && (
				<>
					<section className="intake-detail__section">
						<h3 className="intake-detail__section-title">Información del cliente</h3>
						<dl className="intake-detail__info">
							<div className="intake-detail__info-row">
								<dt>Cliente</dt>
								<dd>{currentInvitation.clientName || '—'}</dd>
							</div>
							<div className="intake-detail__info-row">
								<dt>WhatsApp</dt>
								<dd>{currentInvitation.clientWhatsapp || '—'}</dd>
							</div>
							<div className="intake-detail__info-row">
								<dt>Correo</dt>
								<dd>{currentInvitation.clientEmail || '—'}</dd>
							</div>
							<div className="intake-detail__info-row">
								<dt>Fotos del cliente recibidas</dt>
								<dd>
									<button
										type="button"
										className="intake-detail__toggle"
										onClick={handleTogglePhotos}
									>
										{currentInvitation.photosReceived ? 'Sí' : 'No'}
									</button>
								</dd>
							</div>
						</dl>
					</section>

					<InvitationRsvpPanel
						rsvpEvent={currentRsvpEvent}
						onDeactivated={() => loadInvitationDetail(invitationId)}
					/>
				</>
			)}

			<DraftSection invitationId={invitationId} />

			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</div>
	);
};

export default InvitationDetail;
