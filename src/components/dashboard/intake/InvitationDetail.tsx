import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import BlockSelector from '@/components/dashboard/intake/BlockSelector';
import IntakeLinkPanel from '@/components/dashboard/intake/IntakeLinkPanel';
import DraftSection from '@/components/dashboard/intake/DraftSection';
import SubmissionSection from '@/components/dashboard/intake/SubmissionSection';
import InvitationRsvpPanel from '@/components/dashboard/intake/InvitationRsvpPanel';
import type { IntakeBlockType } from '@/lib/intake/types';
import { INVITATION_STATUS_LABELS } from '@/lib/intake/labels';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { hasInconsistency, resolveRepairAction } from '@/lib/intake/display-status';

interface Props {
	invitationId: string;
}

const InvitationDetail: FC<Props> = ({ invitationId }) => {
	const {
		loading,
		error,
		currentInvitation,
		currentRequest,
		currentSubmission,
		currentRsvpEvent,
		loadInvitationDetail,
		updateInvitation,
		createIntakeRequest,
		regenerateToken,
		revokeToken,
		loadDraft,
	} = useInvitationAdmin();

	const [selectedBlocks, setSelectedBlocks] = useState<IntakeBlockType[]>([]);
	const [creatingRequest, setCreatingRequest] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [revoking, setRevoking] = useState(false);
	const [actionError, setActionError] = useState('');
	const [actionSuccess, setActionSuccess] = useState('');

	useEffect(() => {
		void loadInvitationDetail(invitationId);
		void loadDraft(invitationId);
	}, [invitationId, loadInvitationDetail, loadDraft]);

	useEffect(() => {
		if (currentRequest?.enabledBlocks) {
			setSelectedBlocks(currentRequest.enabledBlocks);
		} else if (currentInvitation) {
			const p = findDemoPreset(currentInvitation.baseDemoId);
			if (p) setSelectedBlocks(p.recommendedBlocks);
		}
	}, [currentRequest, currentInvitation]);

	const handleCreateRequest = async () => {
		if (selectedBlocks.length === 0) {
			setActionError('Selecciona al menos un bloque de captura.');
			return;
		}

		setCreatingRequest(true);
		setActionError('');
		setActionSuccess('');

		try {
			await createIntakeRequest(invitationId, {
				enabledBlocks: selectedBlocks,
			});
			setActionSuccess('Enlace para cliente generado exitosamente.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al generar el enlace.');
		} finally {
			setCreatingRequest(false);
		}
	};

	const handleRevoke = async () => {
		if (!window.confirm('Esto invalidará el enlace para cliente. ¿Continuar?')) return;

		setRevoking(true);
		setActionError('');
		setActionSuccess('');

		try {
			await revokeToken(invitationId);
			setActionSuccess('Link para cliente revocado.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al revocar el enlace.');
		} finally {
			setRevoking(false);
		}
	};

	const handleRegenerate = async () => {
		if (!window.confirm('Esto invalidará el enlace anterior. ¿Continuar?')) return;

		setRegenerating(true);
		setActionError('');
		setActionSuccess('');

		try {
			await regenerateToken(invitationId);
			setActionSuccess('Token regenerado. El enlace anterior ya no funciona.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Error al regenerar el token.');
		} finally {
			setRegenerating(false);
		}
	};

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

	const preset = findDemoPreset(currentInvitation.baseDemoId);

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
					{preset && <span className="intake-detail__demo">{preset.displayName}</span>}
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

					<section className="intake-detail__section">
						<h3 className="intake-detail__section-title">
							Solicitud al cliente (opcional)
						</h3>
						<p className="intake-detail__submission-hint">
							La edición interna está siempre disponible desde la lista de
							invitaciones. Este enlace solo es necesario si deseas solicitar datos al
							cliente.
						</p>
						<BlockSelector
							selectedBlocks={selectedBlocks}
							recommendedBlocks={preset?.recommendedBlocks}
							onChange={setSelectedBlocks}
							disabled={Boolean(currentRequest)}
						/>
						{!currentRequest && (
							<button
								type="button"
								className="intake-detail__generate-btn"
								onClick={handleCreateRequest}
								disabled={creatingRequest}
							>
								{creatingRequest ? 'Generando...' : 'Generar enlace para cliente'}
							</button>
						)}
						<IntakeLinkPanel
							request={currentRequest}
							onRegenerate={handleRegenerate}
							onRevoke={handleRevoke}
							regenerating={regenerating}
							revoking={revoking}
						/>
					</section>

					<InvitationRsvpPanel rsvpEvent={currentRsvpEvent} />
				</>
			)}

			{currentSubmission && (
				<SubmissionSection invitationId={invitationId} submission={currentSubmission} />
			)}

			<DraftSection invitationId={invitationId} />

			{actionError && <p className="intake-detail__error">{actionError}</p>}
			{actionSuccess && <p className="intake-detail__success">{actionSuccess}</p>}
		</div>
	);
};

export default InvitationDetail;
